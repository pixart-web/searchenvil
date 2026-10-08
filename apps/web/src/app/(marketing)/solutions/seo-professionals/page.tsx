import type { Metadata } from "next";
import { SolutionPage } from "@/components/marketing/SolutionPage";
import { SearchAuditIcon } from "@/components/marketing/icons";
import { SITE_ORIGIN } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "For SEO Professionals",
  description:
    "SearchAnvil for SEO professionals: a real crawl, a Search Health score that stays explainable over time, and Forge Priorities ranking — evidence-backed findings you can defend to a client or stakeholder.",
  alternates: { canonical: `${SITE_ORIGIN}/solutions/seo-professionals` },
};

const content = {
  eyebrow: "For SEO professionals",
  title: "Evidence, not opinions",
  intro:
    "Every finding SearchAnvil surfaces traces back to something the crawl actually observed. Stop defending a spreadsheet of subjective judgment calls — hand over a ranked, evidenced list instead.",
  source: "solutions-seo-professionals",
  Icon: SearchAuditIcon,
  points: [
    {
      title: "A defensible baseline",
      body: "Every Search Health score comes with its own explanation, so when a client asks 'why is this the score,' you have a stored, specific answer ready — not a re-derivation.",
    },
    {
      title: "Prioritization, done for you",
      body: "Forge Priorities already rank issues by severity, impact, effort, and affected-page count — no more manually triaging a 40-row export before a client call.",
    },
    {
      title: "Prove the work",
      body: "Crawl comparison shows exactly what changed since the last audit: fixed issues, new issues, and pages that got better or worse.",
    },
    {
      title: "Stay in scope",
      body: "SearchAnvil audits your six technical categories thoroughly and doesn't try to also be a keyword tool, a backlink index, or a content generator.",
    },
  ],
};

export default function SeoProfessionalsPage(): React.ReactElement {
  return <SolutionPage content={content} />;
}
