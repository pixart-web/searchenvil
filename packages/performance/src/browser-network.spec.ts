import { request } from "node:http";
import { describe, expect, it } from "vitest";
import { createBrowserNetwork } from "./browser-network";

describe("performance browser network", () => {
  it("rejects a private target before opening an outbound connection", async () => {
    const proxy = await createBrowserNetwork(1000);
    try {
      const status = await new Promise<number | undefined>((resolve, reject) => {
        request(proxy.server, { path: "http://127.0.0.1:81/" }, (response) => {
          response.resume();
          resolve(response.statusCode);
        })
          .on("error", reject)
          .end();
      });
      expect(status).toBe(403);
    } finally {
      await proxy.close();
    }
  });
});
