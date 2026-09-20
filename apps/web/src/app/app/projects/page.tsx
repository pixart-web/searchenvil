"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Spinner, StatusState } from "@searchanvil/ui";
import { apiFetch } from "@/lib/api-client";
import type { Organization, Project } from "@/lib/types";

type LoadState = "loading" | "ready" | "error";

/**
 * The entry point after login/register — not per-project, so it doesn't
 * live under [projectId]. A user with no projects yet is sent straight to
 * onboarding (the "create your first project" flow); a user who already has
 * one or more sees a real list instead of being funneled back through
 * onboarding every time they sign in.
 */
export default function ProjectsListPage(): React.ReactElement {
  const router = useRouter();
  const [state, setState] = useState<LoadState>("loading");
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      try {
        const orgs = await apiFetch<Organization[]>("/organizations");
        const org = orgs[0];
        if (!org) {
          if (!cancelled) router.push("/onboarding");
          return;
        }
        const projectList = await apiFetch<Project[]>(`/organizations/${org.id}/projects`);
        if (cancelled) return;
        if (projectList.length === 0) {
          router.push("/onboarding");
          return;
        }
        setProjects(projectList);
        setState("ready");
      } catch {
        if (!cancelled) setState("error");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (state === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Spinner />
      </main>
    );
  }

  if (state === "error") {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <StatusState kind="error" title="Couldn't load your projects" description="Please try signing in again." />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-steel-100">Your projects</h1>
        <Link
          href="/onboarding"
          className="inline-flex h-9 items-center justify-center rounded bg-ember-500 px-4 text-sm font-medium text-forge-950 transition-colors hover:bg-ember-400"
        >
          New project
        </Link>
      </div>
      <div className="space-y-2">
        {projects.map((project) => (
          <Link
            key={project.id}
            href={`/app/projects/${project.id}`}
            className="block rounded border border-forge-800 px-4 py-3 text-sm font-medium text-steel-100 hover:border-steel-500"
          >
            {project.name}
          </Link>
        ))}
      </div>
    </main>
  );
}
