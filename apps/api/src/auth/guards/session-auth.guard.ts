import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request, Response } from "express";
import { AuthService } from "../auth.service";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

const SESSION_COOKIE_NAME = process.env.AUTH_SESSION_COOKIE_NAME ?? "searchenvil_session";
const CSRF_COOKIE_NAME = "searchenvil_csrf";
const CSRF_HEADER_NAME = "x-csrf-token";
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Global guard: every route requires a valid session unless annotated
 * @Public(). Also enforces double-submit CSRF protection on mutating
 * requests made against an authenticated (cookie-based) session — see
 * docs/SECURITY.md.
 */
@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const rawToken = request.cookies?.[SESSION_COOKIE_NAME] as string | undefined;

    if (isPublic) {
      return true;
    }

    if (!rawToken) {
      throw new UnauthorizedException("Authentication required.");
    }

    const result = await this.authService.validateSession(rawToken);
    if (!result) {
      response.clearCookie(SESSION_COOKIE_NAME);
      throw new UnauthorizedException("Session expired or invalid.");
    }

    if (MUTATING_METHODS.has(request.method)) {
      const csrfCookie = request.cookies?.[CSRF_COOKIE_NAME] as string | undefined;
      const csrfHeader = request.header(CSRF_HEADER_NAME);
      if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
        throw new ForbiddenException("Missing or invalid CSRF token.");
      }
    }

    (request as Request & { user: typeof result.user; sessionToken: string }).user = result.user;
    (request as Request & { sessionToken: string }).sessionToken = rawToken;
    return true;
  }
}
