import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@searchanvil/database";
import { PrismaService } from "../common/prisma/prisma.service";
import { CreateLaunchListSignupDto } from "./dto/create-launch-list-signup.dto";

export interface LaunchListSignupResult {
  status: "confirmed";
}

/**
 * Prelaunch mailing-list capture. Deliberately unauthenticated (see @Public()
 * on the controller route) and deliberately narrow: this never creates a
 * User/Session/Organization and is never in the auth code path. It exists
 * purely so the marketing site's subscribe CTAs have somewhere real to send
 * an email address ahead of general availability — see docs/MARKETING_SITE.md.
 */
@Injectable()
export class LaunchListService {
  private readonly logger = new Logger(LaunchListService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateLaunchListSignupDto): Promise<LaunchListSignupResult> {
    // Honeypot: a filled `website` field means a bot filled in every input it
    // could find. Report success (so the bot doesn't retry/adapt) without
    // writing anything.
    if (dto.website && dto.website.trim().length > 0) {
      this.logger.debug("Discarded launch-list submission with a filled honeypot field.");
      return { status: "confirmed" };
    }

    const email = dto.email.trim().toLowerCase();

    try {
      await this.prisma.launchListSignup.create({
        data: {
          email,
          name: dto.name?.trim() || null,
          company: dto.company?.trim() || null,
          role: dto.role?.trim() || null,
          source: dto.source ?? null,
        },
      });
    } catch (error) {
      // Unique constraint on email: treat a repeat signup as an idempotent
      // success rather than leaking whether an address is already on the
      // list (and rather than erroring on someone who double-clicks submit).
      const isDuplicate =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
      if (!isDuplicate) {
        throw error;
      }
    }

    return { status: "confirmed" };
  }
}
