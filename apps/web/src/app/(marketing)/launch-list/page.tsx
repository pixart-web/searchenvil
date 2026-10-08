import type { Metadata } from "next";
import { LaunchListForm } from "@/components/marketing/LaunchListForm";
import { SITE_ORIGIN } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Join the Launch List",
  description:
    "SearchAnvil is in prelaunch. Join the launch list to be notified the moment the technical SEO audit platform opens for general availability — no payment, no obligation.",
  alternates: { canonical: `${SITE_ORIGIN}/launch-list` },
};

export default function LaunchListPage(): React.ReactElement {
  return (
    <section className="mx-auto max-w-xl px-6 py-20 sm:py-28">
      <h1 className="text-3xl font-semibold text-steel-100 sm:text-4xl">Join the launch list</h1>
      <p className="mt-4 text-steel-400">
        SearchAnvil is under active development and not yet publicly available. Leave your email
        and we&apos;ll notify you the moment general availability opens — nothing is charged and no
        account is created by signing up here.
      </p>
      <div className="mt-8">
        <LaunchListForm source="launch-list-page" variant="full" />
      </div>
    </section>
  );
}
