import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { SitesModule } from "../sites/sites.module";
import { CrawlsController } from "./crawls.controller";
import { CrawlsService } from "./crawls.service";

@Module({
  imports: [AuthModule, SitesModule],
  controllers: [CrawlsController],
  providers: [CrawlsService],
})
export class CrawlsModule {}
