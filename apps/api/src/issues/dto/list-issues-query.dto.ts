import { Transform } from "class-transformer";
import { IsIn, IsOptional, IsString } from "class-validator";
import type { IssueCategory, IssueSeverity } from "@searchanvil/database";

const SEVERITIES: IssueSeverity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "NOTICE"];
const CATEGORIES: IssueCategory[] = [
  "TECHNICAL",
  "INDEXABILITY",
  "CONTENT",
  "PERFORMANCE",
  "INTERNAL_LINKING",
  "STRUCTURED_DATA",
];

function toArray(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value : String(value).split(",");
}

export class ListIssuesQueryDto {
  @IsOptional()
  @Transform(({ value }) => toArray(value))
  @IsIn(SEVERITIES, { each: true })
  severity?: IssueSeverity[];

  @IsOptional()
  @Transform(({ value }) => toArray(value))
  @IsIn(CATEGORIES, { each: true })
  category?: IssueCategory[];

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(["priority", "severity", "affectedPages"])
  sortBy?: "priority" | "severity" | "affectedPages";

  @IsOptional()
  @IsIn(["asc", "desc"])
  sortOrder?: "asc" | "desc";
}
