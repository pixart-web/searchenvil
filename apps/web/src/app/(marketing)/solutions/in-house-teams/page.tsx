import type { Metadata } from "next";
import { SolutionPage } from "@/components/marketing/SolutionPage";
import { TrendIcon } from "@/components/marketing/icons";
import { SITE_ORIGIN } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "For In-House Teams",
  description:
    "SearchAnvil for in-house teams: track your Search Health score and Forge Priorities over time, recrawl after a release, and prove the technical backlog is actually shrinking.",
  alternates: { canonical: `${SITE_ORIGIN}/solutions/in-house-teams` },
};

const content = {
  eyebrow: "For in-house teams",
  title: "Prove the backlog is shrinking",
  intro:
    "You already know your site has technical debt. SearchAnvil turns 'it should be better' into a specific number you can show your team, your manager, or the next audit.",
  source: "solutions-in-house-teams",
  Icon: TrendIcon,
  points: [
    {
      title: "Recrawl after every release",
      body: "Trigger a new crawl whenever you ship, then compare it against the last one: which issues got fixed, which are new, which persisted.",
    },
    {
      title: "One score to report upward",
      body: "Search Health gives you a single, explainable number per category, kept alongside its own reasoning so you can defend it to stakeholders who don't want the full issue list.",
    },
    {
      title: "Prioritize with the team you have",
      body: "Forge Priorities factor in effort, not just severity, so a small team can pick off high-impact, low-effort fixes first instead of getting stuck on the scariest-sounding issue.",
    },
    {
      title: "No scheduling automation yet",
      body: "There is currently no recurring/automated crawl scheduler — recrawls are triggered manually. If that changes, this page will say so.",
    },
  ],
};

export default function InHouseTeamsPage(): React.ReactElement {
  return <SolutionPage content={content} />;
}
