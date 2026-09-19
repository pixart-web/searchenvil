import { IsOptional, IsUUID } from "class-validator";

export class CompareCrawlQueryDto {
  @IsOptional()
  @IsUUID()
  baselineCrawlId?: string;
}
