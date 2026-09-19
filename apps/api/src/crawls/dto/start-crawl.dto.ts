import { IsInt, IsOptional, Max, Min } from "class-validator";

export class StartCrawlDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  maxPages?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  maxDepth?: number;
}
