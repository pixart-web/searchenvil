import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { MailerService } from "./mailer.service";
import { SessionAuthGuard } from "./guards/session-auth.guard";
import { OrgRolesGuard } from "./guards/org-roles.guard";

@Module({
  controllers: [AuthController],
  providers: [AuthService, MailerService, SessionAuthGuard, OrgRolesGuard],
  exports: [AuthService, SessionAuthGuard, OrgRolesGuard],
})
export class AuthModule {}
