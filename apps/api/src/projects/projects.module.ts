import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ProjectsController } from "./projects.controller";
import { ProjectsService } from "./projects.service";
import { ProjectOverviewService } from "./project-overview.service";

@Module({
  imports: [AuthModule],
  controllers: [ProjectsController],
  providers: [ProjectsService, ProjectOverviewService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
