import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Public } from "../auth/decorators/public.decorator";
import { CreateLaunchListSignupDto } from "./dto/create-launch-list-signup.dto";
import { LaunchListService, type LaunchListSignupResult } from "./launch-list.service";

@Controller("launch-list")
export class LaunchListController {
  constructor(private readonly launchListService: LaunchListService) {}

  @Public()
  // Stricter than the global default (120/min): this is an unauthenticated,
  // write-only public endpoint, so it gets its own tight per-IP budget on
  // top of the global ThrottlerGuard.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post()
  create(@Body() dto: CreateLaunchListSignupDto): Promise<LaunchListSignupResult> {
    return this.launchListService.create(dto);
  }
}
