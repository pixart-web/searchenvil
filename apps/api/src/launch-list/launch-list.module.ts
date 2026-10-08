import { Module } from "@nestjs/common";
import { LaunchListController } from "./launch-list.controller";
import { LaunchListService } from "./launch-list.service";

@Module({
  controllers: [LaunchListController],
  providers: [LaunchListService],
})
export class LaunchListModule {}
