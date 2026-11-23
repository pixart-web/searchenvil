"use client";

import Link from "next/link";
import { useDesktopStatus } from "@/components/desktop-shell";

export default function DesktopSettings(): React.ReactElement {
  const status = useDesktopStatus();
  return (
    <main className="mx-auto max-w-3xl px-8 py-12">
      <Link className="text-sm text-ember-400" href="/app/projects">
        All projects
      </Link>
      <h1 className="my-6 text-2xl font-semibold">Settings</h1>
      <section
        className="border border-forge-800 bg-forge-900 p-5"
        aria-labelledby="runtime-heading"
      >
        <h2 id="runtime-heading" className="mb-4 text-base font-medium">
          Local runtime
        </h2>
        <dl className="grid grid-cols-2 gap-y-3 text-sm">
          <dt className="text-steel-400">Application</dt>
          <dd className="font-mono">{status?.version ?? "Unavailable"}</dd>
          <dt className="text-steel-400">Runtime</dt>
          <dd>{status ? "Ready" : "Unavailable"}</dd>
          <dt className="text-steel-400">Data storage</dt>
          <dd>{status ? "macOS Application Support" : "Unavailable"}</dd>
        </dl>
      </section>
    </main>
  );
}
