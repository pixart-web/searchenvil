import { notFound } from "next/navigation";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
  Spinner,
  StatusState,
} from "@searchenvil/ui";

function Section({ title, children }: { title: string; children: React.ReactNode }): React.ReactElement {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-steel-400">{title}</h2>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </section>
  );
}

export default function ComponentShowcasePage(): React.ReactElement {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-10 p-8">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-ember-400">SearchEnvil</p>
        <h1 className="text-2xl font-semibold text-steel-100">Component showcase</h1>
        <p className="mt-1 text-sm text-steel-400">
          Dev-only reference for the design system primitives in @searchenvil/ui. Not linked from
          product navigation.
        </p>
      </div>

      <Section title="Buttons">
        <Button variant="primary">Forge my first audit</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
        <Button isLoading>Loading</Button>
        <Button disabled>Disabled</Button>
      </Section>

      <Section title="Badges — severity">
        <Badge severity="critical">Critical</Badge>
        <Badge severity="high">High</Badge>
        <Badge severity="medium">Medium</Badge>
        <Badge severity="low">Low</Badge>
        <Badge severity="notice">Notice</Badge>
      </Section>

      <Section title="Badges — tone">
        <Badge tone="success">Fixed</Badge>
        <Badge tone="warning">Warning</Badge>
        <Badge tone="danger">New</Badge>
        <Badge tone="ember">Ember</Badge>
        <Badge tone="violet">Violet</Badge>
        <Badge tone="neutral">Neutral</Badge>
      </Section>

      <Section title="Cards">
        <Card className="w-72">
          <CardHeader>
            <CardTitle>Search Health</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-steel-100">78</p>
            <p className="text-xs text-steel-500">out of 100</p>
          </CardContent>
        </Card>
      </Section>

      <Section title="Loading states">
        <Spinner />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-24 w-24" />
      </Section>

      <Section title="Status states">
        <StatusState
          kind="empty"
          title="No crawls yet"
          description="Run your first audit to see results here."
          action={<Button size="sm">Forge my first audit</Button>}
        />
        <StatusState
          kind="error"
          title="Crawl failed"
          description="The crawler could not reach the target host."
        />
      </Section>
    </div>
  );
}
