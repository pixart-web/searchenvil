import { describe, expect, it } from "vitest";
import { isBlockedAddress, createSafeLookup } from "./ssrf";

describe("isBlockedAddress", () => {
  it("blocks loopback", () => {
    expect(isBlockedAddress("127.0.0.1")).toBe(true);
    expect(isBlockedAddress("::1")).toBe(true);
  });

  it("blocks private IPv4 ranges", () => {
    expect(isBlockedAddress("10.0.0.5")).toBe(true);
    expect(isBlockedAddress("172.16.0.1")).toBe(true);
    expect(isBlockedAddress("172.31.255.255")).toBe(true);
    expect(isBlockedAddress("192.168.1.1")).toBe(true);
  });

  it("blocks link-local, including the cloud metadata endpoint", () => {
    expect(isBlockedAddress("169.254.169.254")).toBe(true);
    expect(isBlockedAddress("169.254.1.1")).toBe(true);
  });

  it("blocks unique-local and link-local IPv6", () => {
    expect(isBlockedAddress("fc00::1")).toBe(true);
    expect(isBlockedAddress("fd12:3456:789a::1")).toBe(true);
    expect(isBlockedAddress("fe80::1")).toBe(true);
  });

  it("blocks unspecified, multicast, and broadcast addresses", () => {
    expect(isBlockedAddress("0.0.0.0")).toBe(true);
    expect(isBlockedAddress("255.255.255.255")).toBe(true);
    expect(isBlockedAddress("224.0.0.1")).toBe(true);
    expect(isBlockedAddress("::")).toBe(true);
  });

  it("unwraps IPv4-mapped IPv6 addresses before checking", () => {
    expect(isBlockedAddress("::ffff:127.0.0.1")).toBe(true);
    expect(isBlockedAddress("::ffff:10.0.0.1")).toBe(true);
    expect(isBlockedAddress("::ffff:8.8.8.8")).toBe(false);
  });

  it("allows public IPv4 and IPv6 addresses", () => {
    expect(isBlockedAddress("8.8.8.8")).toBe(false);
    expect(isBlockedAddress("1.1.1.1")).toBe(false);
    expect(isBlockedAddress("93.184.216.34")).toBe(false);
    expect(isBlockedAddress("2606:4700:4700::1111")).toBe(false);
  });

  it("treats an unparseable value as blocked (fail closed)", () => {
    expect(isBlockedAddress("not-an-ip")).toBe(true);
  });
});

describe("createSafeLookup", () => {
  // Injects a deterministic fake DNS resolver so these tests are offline
  // and reproducible — no dependency on real DNS/network (see
  // docs/TESTING.md). Mirrors the real dns.lookup(hostname, options,
  // callback) signature that createSafeLookup always calls with all:true.
  function fakeResolver(
    addresses: { address: string; family: number }[],
  ): Parameters<typeof createSafeLookup>[0] {
    return ((_hostname: string, _opts: unknown, cb: unknown) => {
      (cb as (err: null, addrs: typeof addresses) => void)(null, addresses);
    }) as Parameters<typeof createSafeLookup>[0];
  }

  it("replies with the single-result shape when the caller didn't request all:true", async () => {
    const lookup = createSafeLookup(fakeResolver([{ address: "93.184.216.34", family: 4 }]));
    const result = await new Promise<{ address: unknown; family: unknown }>((resolve, reject) => {
      lookup("example.com", {}, (err, address, family) => {
        if (err) reject(err);
        else resolve({ address, family });
      });
    });
    expect(result).toEqual({ address: "93.184.216.34", family: 4 });
  });

  it("replies with the array shape when the caller requests all:true, matching Node's dns.lookup contract", async () => {
    const lookup = createSafeLookup(
      fakeResolver([
        { address: "2606:2800:220:1:248:1893:25c8:1946", family: 6 },
        { address: "93.184.216.34", family: 4 },
      ]),
    );
    const result = await new Promise<unknown>((resolve, reject) => {
      lookup("example.com", { all: true }, (err, addresses) => {
        if (err) reject(err);
        else resolve(addresses);
      });
    });
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);
  });

  it("rejects when any resolved address (in an all:true multi-answer response) is blocked", async () => {
    const lookup = createSafeLookup(
      fakeResolver([
        { address: "93.184.216.34", family: 4 },
        { address: "127.0.0.1", family: 4 },
      ]),
    );
    await expect(
      new Promise((resolve, reject) => {
        lookup("attacker.example", { all: true }, (err, addresses) => {
          if (err) reject(err);
          else resolve(addresses);
        });
      }),
    ).rejects.toThrow(/non-public/);
  });
});
