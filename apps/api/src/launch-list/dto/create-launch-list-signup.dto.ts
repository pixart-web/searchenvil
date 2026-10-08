import { IsEmail, IsIn, IsOptional, IsString, MaxLength } from "class-validator";

/** Valid values for `source` — which marketing page/CTA the signup came from. Kept in sync
 *  with `apps/web/src/lib/site-config.ts`'s `LaunchListSource` union. */
const LAUNCH_LIST_SOURCES = [
  "homepage-hero",
  "homepage-pricing",
  "homepage-closing",
  "platform",
  "solutions-seo-professionals",
  "solutions-agencies",
  "solutions-in-house-teams",
  "pricing",
  "launch-list-page",
  "nav",
  "other",
] as const;

export class CreateLaunchListSignupDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  company?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  role?: string;

  @IsOptional()
  @IsIn(LAUNCH_LIST_SOURCES)
  source?: string;

  /**
   * Honeypot field. Real visitors never see or fill this input (it is visually
   * hidden and excluded from the tab order); a non-empty value strongly signals
   * an automated submission. Never persisted — see LaunchListService.create.
   */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  website?: string;
}
