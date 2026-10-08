import type { Metadata } from "next";
import { SolutionPage } from "@/components/marketing/SolutionPage";
import { OrganizationsIcon } from "@/components/marketing/icons";
import { SITE_ORIGIN } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "For Agencies",
  description:
    "SearchAnvil for agencies: multi-tenant organizations keep each client's projects, websites, and crawl history cleanly separated, with role-based membership.",
  alternates: { canonical: `${SITE_ORIGIN}/solutions/agencies` },
};

const content = {
  eyebrow: "For agencies",
  title: "One account, cleanly separated clients",
  intro:
    "SearchAnvil is multi-tenant from the ground up: your team can belong to multiple organizations, each with its own projects, websites, and crawl history — nothing bleeds across client boundaries.",
  source: "solutions-agencies",
  Icon: OrganizationsIcon,
  points: [
    {
      title: "Organizations per client",
      body: "Each organization has its own membership, projects, and sites. A team member can belong to more than one organization with a distinct role in each (Owner, Admin, or Member).",
    },
    {
      title: "Projects and websites, not one flat list",
      body: "Within an organization, projects group related websites, so a multi-site client stays organized instead of turning into an undifferentiated pile of URLs.",
    },
    {
      title: "A report you can hand over",
      body: "CSV export gives you rule, category, severity, impact, effort, affected-page count, and priority score per issue — ready to drop into a client deliverable.",
    },
    {
      title: "A shared workspace for your team",
      body: "SearchAnvil is built for your team to run and review audits together. White-labeling and a client-facing portal aren't part of it today.",
    },
  ],
};

export default function AgenciesPage(): React.ReactElement {
  return <SolutionPage content={content} />;
}
