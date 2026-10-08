import Link from "next/link";
import { Button } from "@searchanvil/ui";
import { LaunchListForm } from "@/components/marketing/LaunchListForm";
import { SupportingVisual } from "@/components/marketing/art/SupportingVisual";

export interface SolutionContent {
  eyebrow: string;
  title: string;
  intro: string;
  points: Array<{ title: string; body: string }>;
  source: string;
  Icon: React.ComponentType<{ className?: string }>;
}

export function SolutionPage({ content }: { content: SolutionContent }): React.ReactElement {
  return (
    <>
      <section className="mx-auto grid max-w-5xl items-center gap-10 px-6 py-20 sm:py-28 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
        <div className="text-center lg:text-left">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-ember-400">{content.eyebrow}</p>
          <h1 className="mt-3 font-display text-4xl font-semibold text-steel-100 sm:text-5xl">{content.title}</h1>
          <p className="mx-auto mt-4 max-w-xl text-steel-400 lg:mx-0">{content.intro}</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
            <Link href="/launch-list">
              <Button size="lg">Join the launch list</Button>
            </Link>
            <Link href="/platform">
              <Button size="lg" variant="secondary">
                Explore the platform
              </Button>
            </Link>
          </div>
        </div>
        <SupportingVisual Icon={content.Icon} label={content.eyebrow} />
      </section>

      <section className="border-t border-forge-800 bg-forge-900/40">
        <div className="mx-auto max-w-4xl px-6 py-16 sm:py-20">
          <div className="grid gap-6 sm:grid-cols-2">
            {content.points.map((point) => (
              <div key={point.title} className="rounded-lg border border-forge-800 bg-forge-900 p-6">
                <h2 className="text-lg font-semibold text-steel-100">{point.title}</h2>
                <p className="mt-2 text-sm text-steel-400">{point.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-md px-6 py-16 text-center">
        <h2 className="text-xl font-semibold text-steel-100">Be first to know when we launch</h2>
        <div className="mt-6 text-left">
          <LaunchListForm source={content.source} variant="compact" />
        </div>
      </section>
    </>
  );
}
