import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { User } from "@searchanvil/database";
import type { Request } from "express";

export type AuthenticatedUser = Omit<User, "passwordHash">;

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<Request & { user: AuthenticatedUser }>();
    return request.user;
  },
);
