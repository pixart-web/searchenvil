import { IsOptional, IsString, IsUrl, MaxLength, MinLength } from "class-validator";

export class UpdateSiteDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  displayName?: string;

  @IsOptional()
  @IsUrl({ protocols: ["http", "https"], require_protocol: true })
  @MaxLength(2048)
  rootUrl?: string;
}
