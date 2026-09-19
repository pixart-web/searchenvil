import Link from "next/link";

const QUESTIONS = [
  {
    title: "How healthy is my website?",
    body: "A single, versioned Search Health score — weighing severity, confidence, and how much of the site is actually affected, never just a pass/fail count.",
  },
  {
    title: "What is wrong?",
    body: "Crawled facts interpreted into findings by a real audit engine, graded by how certain we actually are — no subjective opinions dressed up as errors.",
  },
  {
    title: "What should I fix first?",
    body: "Forge Priorities rank every issue by impact and effort, so a high-value, easy fix always surfaces before a low-value, hard one.",
  },
  {
    title: "Which pages are affected?",
    body: "Every issue links to the exact pages it touches, and every page shows every issue affecting it — nothing is a vague site-wide warning.",
  },
  {
    title: "Did the website improve?",
    body: "Compare any two crawls: score deltas, new/resolved/persisting issues, and improved/worsened pages — derived from stored data, never a generated guess.",
  },
];

const LOOP_STEPS = [
  "Project",
  "Website",
  "Crawl",
  "Facts",
  "Audit",
  "Search Health",
  "Forge Priorities",
  "Fixes",
  "Recrawl",
  "Comparison",
];

export default function HomePage(): React.ReactElement {
  return (
    <main className="min-h-screen bg-forge-950">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="font-mono text-sm uppercase tracking-[0.3em] text-ember-400">SearchEnvil</span>
        <nav className="flex items-center gap-3">
          <Link href="/login" className="rounded px-3 py-2 text-sm font-medium text-steel-300 hover:text-steel-100">
            Sign in
          </Link>
          <Link
            href="/register"
            className="inline-flex h-9 items-center justify-center rounded bg-ember-500 px-4 text-sm font-medium text-forge-950 transition-colors hover:bg-ember-400"
          >
            Get started
          </Link>
        </nav>
      </header>

      <section className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-6 py-20 text-center sm:py-28">
        <h1 className="text-4xl font-semibold text-steel-100 sm:text-5xl">Forge Better Search Performance.</h1>
        <p className="max-w-xl text-lg text-steel-400">
          SearchEnvil crawls your website, separates fact from opinion, and tells you exactly what
          to fix first — not a keyword database, not a marketing suite, just a sharp technical SEO
          audit.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/register"
            className="inline-flex h-12 items-center justify-center rounded bg-ember-500 px-6 text-base font-medium text-forge-950 transition-colors hover:bg-ember-400"
          >
            Start your first audit
          </Link>
          <Link
            href="/login"
            className="inline-flex h-12 items-center justify-center rounded border border-forge-800 px-6 text-base font-medium text-steel-100 transition-colors hover:border-steel-500"
          >
            Sign in
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="mb-8 text-center text-sm font-medium uppercase tracking-[0.2em] text-steel-500">
          Five questions, answered
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {QUESTIONS.map((q) => (
            <div key={q.title} className="rounded border border-forge-800 bg-forge-900 p-5">
              <h3 className="mb-2 text-base font-semibold text-steel-100">{q.title}</h3>
              <p className="text-sm text-steel-400">{q.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="mb-8 text-center text-sm font-medium uppercase tracking-[0.2em] text-steel-500">
          The core loop
        </h2>
        <div className="flex flex-wrap items-center justify-center gap-2 font-mono text-xs text-steel-400 sm:text-sm">
          {LOOP_STEPS.map((step, index) => (
            <span key={step} className="flex items-center gap-2">
              <span className="rounded border border-forge-800 bg-forge-900 px-3 py-1.5 text-steel-200">
                {step}
              </span>
              {index < LOOP_STEPS.length - 1 ? <span className="text-steel-600">→</span> : null}
            </span>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-16 text-center">
        <h2 className="mb-4 text-2xl font-semibold text-steel-100">Not another all-in-one suite</h2>
        <p className="text-sm text-steel-400">
          No global keyword database, no backlink index, no PPC or CRM tooling, no generative AI
          assistant guessing at your rankings. SearchEnvil does one thing — technical SEO auditing —
          and does it with facts, not narratives.
        </p>
      </section>

      <footer className="border-t border-forge-800 py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 text-xs text-steel-500">
          <span>© {new Date().getFullYear()} SearchEnvil</span>
          <div className="flex gap-4">
            <Link href="/login" className="hover:text-steel-300">
              Sign in
            </Link>
            <Link href="/register" className="hover:text-steel-300">
              Get started
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
