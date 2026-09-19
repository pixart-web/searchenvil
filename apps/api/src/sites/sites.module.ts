import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ProjectsModule } from "../projects/projects.module";
import { SitesController } from "./sites.controller";
import { SitesService } from "./sites.service";

@Module({
  imports: [AuthModule, ProjectsModule],
  controllers: [SitesController],
  providers: [SitesService],
})
export class SitesModule {}
