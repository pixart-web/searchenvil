import type { Metadata } from "next";
import { CONTACT_EMAIL, PRICING, SITE_NAME, SITE_ORIGIN } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `Draft terms for ${SITE_NAME}'s prelaunch marketing site and launch list.`,
  alternates: { canonical: `${SITE_ORIGIN}/terms` },
  robots: { index: true, follow: true },
};

export default function TermsPage(): React.ReactElement {
  return (
    <article className="mx-auto max-w-2xl px-6 py-20 sm:py-28">
      <h1 className="text-3xl font-semibold text-steel-100 sm:text-4xl">Terms of Service</h1>
      <p className="mt-2 text-sm text-steel-500">
        Draft — prelaunch. Last updated {new Date().toISOString().slice(0, 10)}.
      </p>

      <div className="mt-8 flex flex-col gap-6 text-sm leading-relaxed text-steel-300">
        <p>
          These terms cover use of this marketing website and the launch list only. {SITE_NAME}
          {" "}has no live product subscription, checkout, or billing today, so no terms of service
          for a paid subscription are yet in effect. Formal terms covering the product itself will
          be published before general availability.
        </p>

        <section>
          <h2 className="text-lg font-semibold text-steel-100">Prelaunch status</h2>
          <p className="mt-2">
            {SITE_NAME} is under active development. Nothing on this site — including the{" "}
            {PRICING.displayFull} figure shown on the pricing page — constitutes an offer to sell
            or a binding price; it is explicitly labeled &ldquo;{PRICING.framing}&rdquo; and remains subject
            to change.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-steel-100">The launch list</h2>
          <p className="mt-2">
            Joining the launch list creates no account, no contract, and no payment obligation. It
            is solely a request to be emailed when general availability opens. You may ask to be
            removed at any time by emailing {CONTACT_EMAIL}.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-steel-100">Acceptable use of this site</h2>
          <p className="mt-2">
            Don&apos;t attempt to disrupt this website or its launch-list form (including automated
            or bulk submissions), scrape it at volume, or use it to submit content that is
            unlawful, abusive, or infringing.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-steel-100">Changes</h2>
          <p className="mt-2">
            We may update these draft terms as the product approaches launch. Material changes will
            be reflected by the &ldquo;Last updated&rdquo; date above.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-steel-100">Contact</h2>
          <p className="mt-2">
            <a className="text-ember-400 hover:underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </p>
        </section>
      </div>
    </article>
  );
}
