import "reflect-metadata";
import { Test, type TestingModuleBuilder } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/configure-app";

export async function createTestApp(
  configureModule?: (builder: TestingModuleBuilder) => TestingModuleBuilder,
): Promise<INestApplication> {
  let builder = Test.createTestingModule({ imports: [AppModule] });
  if (configureModule) {
    builder = configureModule(builder);
  }
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return app;
}

export function uniqueEmail(label: string): string {
  return `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@searchenvil.test`;
}

/** Parses `Set-Cookie` response headers into a "name=value; name2=value2" Cookie header string. */
export function extractCookieHeader(setCookieHeaders: string[]): string {
  return setCookieHeaders.map((header) => header.split(";")[0]).join("; ");
}

export function extractCookieValue(setCookieHeaders: string[], name: string): string | undefined {
  const match = setCookieHeaders.find((header) => header.startsWith(`${name}=`));
  return match?.split(";")[0]?.split("=").slice(1).join("=");
}
