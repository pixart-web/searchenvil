import { IsString, IsUrl, MaxLength, MinLength } from "class-validator";

export class CreateSiteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  displayName!: string;

  @IsUrl({ protocols: ["http", "https"], require_protocol: true })
  @MaxLength(2048)
  rootUrl!: string;
}
