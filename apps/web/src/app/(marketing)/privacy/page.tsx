import type { Metadata } from "next";
import { CONTACT_EMAIL, SITE_NAME, SITE_ORIGIN } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `How ${SITE_NAME} handles data collected through this prelaunch marketing site.`,
  alternates: { canonical: `${SITE_ORIGIN}/privacy` },
  robots: { index: true, follow: true },
};

export default function PrivacyPage(): React.ReactElement {
  return (
    <article className="mx-auto max-w-2xl px-6 py-20 sm:py-28">
      <h1 className="text-3xl font-semibold text-steel-100 sm:text-4xl">Privacy Policy</h1>
      <p className="mt-2 text-sm text-steel-500">
        Draft — prelaunch. Last updated {new Date().toISOString().slice(0, 10)}.
      </p>

      <div className="mt-8 flex flex-col gap-6 text-sm leading-relaxed text-steel-300">
        <p>
          {SITE_NAME} is currently in prelaunch. This page describes how we handle information
          collected through this marketing website today. It is a draft, published ahead of legal
          review, and will be finalized before general availability — see &ldquo;Known limitations&rdquo;
          in <code>docs/MARKETING_SITE.md</code> for what remains outstanding (registered legal
          entity, governing law, and formal counsel review).
        </p>

        <section>
          <h2 className="text-lg font-semibold text-steel-100">What we collect</h2>
          <p className="mt-2">
            If you join the launch list, we store the email address you provide, and optionally a
            name, company, role, and which page you signed up from. We do not currently operate
            any tracking pixel, analytics script, or third-party advertising tag on this site.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-steel-100">Why we collect it</h2>
          <p className="mt-2">
            Solely to notify you when SearchAnvil opens for general availability. Launch-list data
            is never used for advertising, sold, or shared with third parties, and is not linked to
            any product account (no product account exists prior to launch).
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-steel-100">How long we keep it</h2>
          <p className="mt-2">
            Until launch, plus a reasonable window afterward to complete the notification, or until
            you ask us to delete it — email {CONTACT_EMAIL} at any time.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-steel-100">Once the product launches</h2>
          <p className="mt-2">
            Product accounts (organizations, projects, websites, crawl data) will be governed by a
            separate, more detailed privacy policy published at general availability, addressing
            data processed on your behalf while auditing your websites.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-steel-100">Contact</h2>
          <p className="mt-2">
            Questions about this policy or a data request: <a className="text-ember-400 hover:underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          </p>
        </section>
      </div>
    </article>
  );
}
