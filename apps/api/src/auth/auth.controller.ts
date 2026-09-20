import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { AuthService, type AuthenticatedSession } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { RequestPasswordResetDto } from "./dto/request-password-reset.dto";
import { ConfirmPasswordResetDto } from "./dto/confirm-password-reset.dto";
import { Public } from "./decorators/public.decorator";
import { CurrentUser, type AuthenticatedUser } from "./decorators/current-user.decorator";
import { generateCsrfToken } from "./session.util";

const SESSION_COOKIE_NAME = process.env.AUTH_SESSION_COOKIE_NAME ?? "searchanvil_session";
const CSRF_COOKIE_NAME = "searchanvil_csrf";
const IS_PRODUCTION = process.env.NODE_ENV === "production";

function setSessionCookies(res: Response, session: AuthenticatedSession): void {
  const commonOptions = {
    secure: IS_PRODUCTION,
    sameSite: "lax" as const,
    expires: session.expiresAt,
    path: "/",
  };
  res.cookie(SESSION_COOKIE_NAME, session.token, { ...commonOptions, httpOnly: true });
  // Deliberately NOT httpOnly: the client must be able to read this and echo
  // it back in a header (double-submit CSRF pattern) — see SessionAuthGuard.
  res.cookie(CSRF_COOKIE_NAME, generateCsrfToken(), { ...commonOptions, httpOnly: false });
}

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("register")
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: AuthenticatedSession["user"] }> {
    const session = await this.authService.register(dto);
    setSessionCookies(res, session);
    return { user: session.user };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post("login")
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: AuthenticatedSession["user"] }> {
    const session = await this.authService.login(dto);
    setSessionCookies(res, session);
    return { user: session.user };
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post("logout")
  async logout(
    @Req() req: Request & { sessionToken?: string },
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    if (req.sessionToken) {
      await this.authService.logout(req.sessionToken);
    }
    res.clearCookie(SESSION_COOKIE_NAME);
    res.clearCookie(CSRF_COOKIE_NAME);
  }

  @Get("me")
  me(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.ACCEPTED)
  @Post("password-reset/request")
  async requestPasswordReset(@Body() dto: RequestPasswordResetDto): Promise<{ status: "ok" }> {
    await this.authService.requestPasswordReset(dto.email);
    return { status: "ok" };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post("password-reset/confirm")
  async confirmPasswordReset(@Body() dto: ConfirmPasswordResetDto): Promise<void> {
    await this.authService.confirmPasswordReset(dto.token, dto.newPassword);
  }
}
