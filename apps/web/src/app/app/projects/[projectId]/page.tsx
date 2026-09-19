"use client";

import { use, useEffect, useState } from "react";
import { Spinner, StatusState } from "@searchenvil/ui";
import { apiFetch } from "@/lib/api-client";
import type { Project, Site } from "@/lib/types";

type LoadState = "loading" | "ready" | "error";

export default function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}): React.ReactElement {
  const { projectId } = use(params);
  const [state, setState] = useState<LoadState>("loading");
  const [project, setProject] = useState<Project | undefined>();
  const [sites, setSites] = useState<Site[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      try {
        const orgs = await apiFetch<{ id: string }[]>("/organizations");
        for (const org of orgs) {
          try {
            const proj = await apiFetch<Project>(
              `/organizations/${org.id}/projects/${projectId}`,
            );
            const projectSites = await apiFetch<Site[]>(
              `/organizations/${org.id}/projects/${projectId}/sites`,
            );
            if (!cancelled) {
              setProject(proj);
              setSites(projectSites);
              setState("ready");
            }
            return;
          } catch {
            // Not in this org — try the next one.
          }
        }
        if (!cancelled) {
          setState("error");
        }
      } catch {
        if (!cancelled) {
          setState("error");
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (state === "loading") {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (state === "error" || !project) {
    return (
      <StatusState
        kind="error"
        title="Couldn't load this project"
        description="It may not exist, or you may not have access to it."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-steel-100">{project.name}</h1>
        <p className="text-sm text-steel-400">
          {sites.length} website{sites.length === 1 ? "" : "s"}
        </p>
      </div>

      <StatusState
        kind="empty"
        title="No audits yet"
        description="Crawling and Search Health scoring land in a later build phase. This project is set up and ready for that once it does."
      />
    </div>
  );
}
