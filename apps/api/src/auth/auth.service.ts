import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { slugify } from "@searchanvil/shared";
import type { Session, User } from "@searchanvil/database";
import { PrismaService } from "../common/prisma/prisma.service";
import { hashPassword, verifyPassword } from "./password.util";
import { generateSessionToken, hashSessionToken } from "./session.util";
import { MailerService } from "./mailer.service";

const SESSION_TTL_DAYS = Number(process.env.AUTH_SESSION_TTL_DAYS ?? 30);
const PASSWORD_RESET_TTL_MINUTES = 60;
const WEB_URL = process.env.WEB_URL ?? "http://localhost:3000";

export interface AuthenticatedSession {
  user: Omit<User, "passwordHash">;
  token: string;
  expiresAt: Date;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
  ) {}

  async register(input: {
    email: string;
    password: string;
    name: string;
    organizationName: string;
  }): Promise<AuthenticatedSession> {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new ConflictException("An account with this email already exists.");
    }

    const passwordHash = hashPassword(input.password);
    const slug = await this.uniqueOrganizationSlug(input.organizationName);

    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: { email: input.email, name: input.name, passwordHash },
      });

      await tx.organization.create({
        data: {
          name: input.organizationName,
          slug,
          members: { create: { userId: createdUser.id, role: "OWNER" } },
        },
      });

      return createdUser;
    });

    return this.createSession(user);
  }

  async login(input: { email: string; password: string }): Promise<AuthenticatedSession> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user || !verifyPassword(input.password, user.passwordHash)) {
      throw new UnauthorizedException("Invalid email or password.");
    }
    return this.createSession(user);
  }

  async logout(rawToken: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { tokenHash: hashSessionToken(rawToken) } });
  }

  async validateSession(
    rawToken: string,
  ): Promise<{ user: Omit<User, "passwordHash">; session: Session } | undefined> {
    const tokenHash = hashSessionToken(rawToken);
    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      return undefined;
    }

    const { user, ...sessionFields } = session;
    const { passwordHash: _passwordHash, ...safeUser } = user;
    return { user: safeUser, session: sessionFields as Session };
  }

  /** Always resolves without revealing whether the email exists (no user enumeration). */
  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      return;
    }

    const token = generateSessionToken();
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000);

    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hashSessionToken(token), expiresAt },
    });

    this.mailer.sendPasswordResetEmail(
      email,
      `${WEB_URL}/reset-password?token=${encodeURIComponent(token)}`,
    );
  }

  async confirmPasswordReset(rawToken: string, newPassword: string): Promise<void> {
    const tokenHash = hashSessionToken(rawToken);
    const resetToken = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      throw new UnauthorizedException("This password reset link is invalid or has expired.");
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash: hashPassword(newPassword) },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      // A password reset invalidates every existing session — the whole
      // point is recovering from a possibly-compromised credential.
      this.prisma.session.deleteMany({ where: { userId: resetToken.userId } }),
    ]);
  }

  private async createSession(user: User): Promise<AuthenticatedSession> {
    const token = generateSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

    await this.prisma.session.create({
      data: { userId: user.id, tokenHash: hashSessionToken(token), expiresAt },
    });

    const { passwordHash: _passwordHash, ...safeUser } = user;
    return { user: safeUser, token, expiresAt };
  }

  private async uniqueOrganizationSlug(name: string): Promise<string> {
    const base = slugify(name) || "organization";
    let candidate = base;
    let suffix = 1;
    // Collisions are rare in practice; a bounded loop keeps this from ever spinning forever.
    while (await this.prisma.organization.findUnique({ where: { slug: candidate } })) {
      suffix += 1;
      candidate = `${base}-${suffix}`;
      if (suffix > 1000) {
        throw new ConflictException("Could not generate a unique organization slug.");
      }
    }
    return candidate;
  }
}
