import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ProjectsModule } from "../projects/projects.module";
import { PerformanceController } from "./performance.controller";
import { PerformanceService } from "./performance.service";

@Module({
  imports: [AuthModule, ProjectsModule],
  controllers: [PerformanceController],
  providers: [PerformanceService],
})
export class PerformanceModule {}
