interface RobotsRule {
  path: string;
  allow: boolean;
}

export interface RobotsTxt {
  rules: RobotsRule[];
  sitemaps: string[];
}

const EMPTY_ROBOTS: RobotsTxt = { rules: [], sitemaps: [] };

/**
 * Minimal but correct robots.txt parser covering the directives that matter
 * for a crawler: User-agent groups, Allow/Disallow, and Sitemap. Picks the
 * most specific matching User-agent group (our own agent, falling back to
 * `*`) per the de-facto standard (RFC 9309 group-selection rules).
 */
export function parseRobotsTxt(content: string, userAgent: string): RobotsTxt {
  const lines = content.split(/\r\n|\r|\n/);
  const groups: { agents: string[]; rules: RobotsRule[] }[] = [];
  const sitemaps: string[] = [];
  let currentGroup: { agents: string[]; rules: RobotsRule[] } | undefined;
  let groupHasRules = false;

  for (const rawLine of lines) {
    const line = (rawLine.split("#")[0] ?? "").trim();
    if (!line) continue;

    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) continue;
    const field = line.slice(0, separatorIndex).trim().toLowerCase();
    const value = line.slice(separatorIndex + 1).trim();

    if (field === "user-agent") {
      if (currentGroup && groupHasRules) {
        currentGroup = undefined;
      }
      if (!currentGroup) {
        currentGroup = { agents: [], rules: [] };
        groups.push(currentGroup);
        groupHasRules = false;
      }
      currentGroup.agents.push(value.toLowerCase());
    } else if (field === "allow" || field === "disallow") {
      if (!currentGroup) continue;
      groupHasRules = true;
      if (value !== "") {
        currentGroup.rules.push({ path: value, allow: field === "allow" });
      } else if (field === "disallow") {
        // "Disallow:" with an empty value means allow everything.
      }
    } else if (field === "sitemap") {
      sitemaps.push(value);
    }
  }

  const ua = userAgent.toLowerCase();
  const exactMatch = groups.find((g) => g.agents.some((a) => a !== "*" && ua.includes(a)));
  const wildcardMatch = groups.find((g) => g.agents.includes("*"));
  const selected = exactMatch ?? wildcardMatch;

  return { rules: selected?.rules ?? [], sitemaps };
}

/** Longest matching rule wins (RFC 9309); ties favor Allow. */
export function isAllowedByRobots(robots: RobotsTxt, pathWithQuery: string): boolean {
  let best: RobotsRule | undefined;
  for (const rule of robots.rules) {
    if (matchesRobotsPath(pathWithQuery, rule.path)) {
      if (!best || rule.path.length > best.path.length) {
        best = rule;
      } else if (rule.path.length === best.path.length && rule.allow) {
        best = rule;
      }
    }
  }
  return best ? best.allow : true;
}

function matchesRobotsPath(pathWithQuery: string, pattern: string): boolean {
  if (pattern === "") return false;
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    // Restore robots.txt's "$" end-of-URL anchor after the generic escape above turned it into "\$".
    .replace(/\\\$$/, "$$");
  const regex = new RegExp(`^${escaped}`);
  return regex.test(pathWithQuery);
}

export { EMPTY_ROBOTS };
