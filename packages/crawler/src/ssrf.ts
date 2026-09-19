import { isIPv4, isIPv6 } from "node:net";
import { lookup as dnsLookup } from "node:dns";
import type { LookupOptions, LookupOneOptions, LookupAllOptions } from "node:dns";

/**
 * Blocks the crawler from reaching loopback, private, link-local, and other
 * non-public network destinations — including the cloud metadata endpoint
 * (169.254.169.254, covered by the link-local range). See docs/CRAWLER.md
 * and docs/SECURITY.md for the threat model.
 */

interface CidrV4 {
  base: number;
  bits: number;
}

interface CidrV6 {
  base: bigint;
  bits: number;
}

function ipv4ToInt(ip: string): number {
  const parts = ip.split(".").map(Number);
  const [a, b, c, d] = [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, parts[3] ?? 0];
  return ((a << 24) | (b << 16) | (c << 8) | d) >>> 0;
}

function ipv6ToBigInt(ip: string): bigint {
  const full = expandIpv6(ip);
  return full.split(":").reduce((acc, group) => (acc << 16n) | BigInt(parseInt(group || "0", 16)), 0n);
}

function expandIpv6(ip: string): string {
  let address = ip;
  if (address.includes("::")) {
    const [head, tail] = address.split("::");
    const headParts = head ? head.split(":") : [];
    const tailParts = tail ? tail.split(":") : [];
    const missing = 8 - headParts.length - tailParts.length;
    address = [...headParts, ...Array(missing).fill("0"), ...tailParts].join(":");
  }
  return address
    .split(":")
    .map((group) => group.padStart(4, "0"))
    .join(":");
}

// Parsed once from the hardcoded, package-internal CIDR lists below — never
// from untrusted input — so a non-null assertion on the split is safe here.
function cidrV4(cidr: string): CidrV4 {
  const [ip, bits] = cidr.split("/") as [string, string];
  return { base: ipv4ToInt(ip), bits: Number(bits) };
}

function cidrV6(cidr: string): CidrV6 {
  const [ip, bits] = cidr.split("/") as [string, string];
  return { base: ipv6ToBigInt(ip), bits: Number(bits) };
}

function matchesV4(ip: number, cidr: CidrV4): boolean {
  if (cidr.bits === 0) return true;
  const mask = cidr.bits === 32 ? 0xffffffff : (~0 << (32 - cidr.bits)) >>> 0;
  return (ip & mask) === (cidr.base & mask);
}

function matchesV6(ip: bigint, cidr: CidrV6): boolean {
  if (cidr.bits === 0) return true;
  const mask = ((1n << BigInt(cidr.bits)) - 1n) << BigInt(128 - cidr.bits);
  return (ip & mask) === (cidr.base & mask);
}

// Not intended to be exhaustive of every IANA special-purpose range — covers
// the ranges that matter for stopping an attacker from reaching internal
// infrastructure via a crawl target.
const BLOCKED_V4_CIDRS = [
  "0.0.0.0/8",
  "10.0.0.0/8",
  "100.64.0.0/10",
  "127.0.0.0/8",
  "169.254.0.0/16",
  "172.16.0.0/12",
  "192.0.0.0/24",
  "192.168.0.0/16",
  "198.18.0.0/15",
  "224.0.0.0/4",
  "240.0.0.0/4",
  "255.255.255.255/32",
].map(cidrV4);

const BLOCKED_V6_CIDRS = [
  "::/128",
  "::1/128",
  "64:ff9b::/96", // NAT64 — can tunnel to IPv4-mapped private addresses
  "100::/64", // discard-only
  "fc00::/7", // unique local
  "fe80::/10", // link-local
  "ff00::/8", // multicast
].map(cidrV6);

export function isBlockedAddress(address: string): boolean {
  if (isIPv4(address)) {
    return BLOCKED_V4_CIDRS.some((cidr) => matchesV4(ipv4ToInt(address), cidr));
  }
  if (isIPv6(address)) {
    // Unwrap IPv4-mapped IPv6 (::ffff:a.b.c.d) and re-check as IPv4.
    const mapped = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
    if (mapped?.[1]) {
      return isBlockedAddress(mapped[1]);
    }
    const value = ipv6ToBigInt(address);
    return BLOCKED_V6_CIDRS.some((cidr) => matchesV6(value, cidr));
  }
  // Not a recognizable IP literal — treat conservatively as blocked.
  return true;
}

export class SsrfBlockedError extends Error {
  constructor(hostname: string, address: string) {
    super(`Refusing to connect to ${hostname} (resolves to ${address}, a non-public address).`);
    this.name = "SsrfBlockedError";
  }
}

type NodeLookupCallback = (
  err: NodeJS.ErrnoException | null,
  address: string | { address: string; family: number }[],
  family?: number,
) => void;

/**
 * A drop-in replacement for `dns.lookup`, suitable for undici's
 * `connect: { lookup }` Agent option. This is what closes the TOCTOU gap: the
 * same IP address that gets validated here is the one the socket actually
 * connects to — an attacker can't pass validation with one DNS answer and
 * have the connection use a different (rebound) one.
 */
export function createSafeLookup(): typeof dnsLookup {
  return function safeLookup(
    hostname: string,
    optionsOrCallback: LookupOptions | LookupOneOptions | LookupAllOptions | NodeLookupCallback,
    callback?: NodeLookupCallback,
  ): void {
    const cb = (typeof optionsOrCallback === "function" ? optionsOrCallback : callback) as
      | NodeLookupCallback
      | undefined;
    const options = typeof optionsOrCallback === "function" ? {} : optionsOrCallback;

    if (!cb) {
      throw new TypeError("callback is required");
    }

    dnsLookup(hostname, { ...options, all: true } as LookupAllOptions, (err, addresses) => {
      if (err) {
        cb(err, []);
        return;
      }
      const list = addresses as { address: string; family: number }[];
      const blocked = list.find((entry) => isBlockedAddress(entry.address));
      if (blocked) {
        cb(new SsrfBlockedError(hostname, blocked.address) as NodeJS.ErrnoException, []);
        return;
      }
      const first = list[0];
      if (!first) {
        cb(new Error(`DNS lookup for ${hostname} returned no addresses.`), []);
        return;
      }
      // Mimic dns.lookup's default (all:false) single-result contract for callers/undici.
      cb(null, first.address, first.family);
    });
  } as typeof dnsLookup;
}
