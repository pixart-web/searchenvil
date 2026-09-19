import { ValidationPipe, type INestApplication } from "@nestjs/common";
import cookieParser from "cookie-parser";

/**
 * Shared between the real bootstrap (main.ts) and the e2e test harness
 * (test/test-app.ts) so the two never drift apart on prefix/validation/
 * cookie behavior.
 */
export function configureApp(app: INestApplication): void {
  app.use(cookieParser());
  app.setGlobalPrefix("api/v1", { exclude: ["health", "ready"] });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}
