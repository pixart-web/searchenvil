"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent, FieldError, Input, Label, Spinner } from "@searchenvil/ui";
import { apiFetch, ApiError } from "@/lib/api-client";
import { deriveDefaultName } from "@/lib/derive-project-name";
import type { CurrentUser, Organization, Project, Site } from "@/lib/types";

type LoadState = "loading" | "ready" | "unauthenticated";

export default function OnboardingPage(): React.ReactElement | null {
  const router = useRouter();
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [organization, setOrganization] = useState<Organization | undefined>();
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdSite, setCreatedSite] = useState<{ project: Project; site: Site } | undefined>();

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      try {
        await apiFetch<CurrentUser>("/auth/me");
        const orgs = await apiFetch<Organization[]>("/organizations");
        if (!cancelled) {
          setOrganization(orgs[0]);
          setLoadState("ready");
        }
      } catch {
        if (!cancelled) {
          setLoadState("unauthenticated");
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (loadState === "unauthenticated") {
      router.push("/login");
    }
  }, [loadState, router]);

  async function onSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!organization) {
      return;
    }
    setError(undefined);
    setIsSubmitting(true);
    try {
      const projectName = deriveDefaultName(websiteUrl) || "My Website";
      const project = await apiFetch<Project>(`/organizations/${organization.id}/projects`, {
        method: "POST",
        body: { name: projectName },
      });
      const site = await apiFetch<Site>(
        `/organizations/${organization.id}/projects/${project.id}/sites`,
        { method: "POST", body: { displayName: projectName, rootUrl: websiteUrl } },
      );
      // Fire the first crawl right away — "Run first audit" is the whole
      // point of onboarding (section 21). If this fails, the project/site
      // still exist and a crawl can be started later from the project page.
      await apiFetch(
        `/organizations/${organization.id}/projects/${project.id}/sites/${site.id}/crawls`,
        { method: "POST", body: {} },
      ).catch(() => undefined);
      setCreatedSite({ project, site });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loadState === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Spinner />
      </main>
    );
  }

  if (loadState === "unauthenticated") {
    return null;
  }

  if (createdSite) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardContent className="space-y-4 py-8 text-center">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-ember-400">
              SearchEnvil
            </p>
            <h1 className="text-xl font-semibold text-steel-100">{createdSite.project.name} is ready.</h1>
            <p className="text-sm text-steel-400">
              We&apos;re crawling {createdSite.site.rootUrl} now. Search Health and Forge
              Priorities will appear on the project page once the audit finishes — usually within
              a minute or two for a small site.
            </p>
            <Button onClick={() => router.push(`/app/projects/${createdSite.project.id}`)}>
              View project
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-ember-400">SearchEnvil</p>
        <h1 className="mt-1 text-2xl font-semibold text-steel-100">Welcome to SearchEnvil.</h1>
        <p className="mt-2 text-sm text-steel-400">
          Let&apos;s find out what&apos;s holding your website back.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4 text-left" noValidate>
          <div>
            <Label htmlFor="websiteUrl">Website URL</Label>
            <Input
              id="websiteUrl"
              type="url"
              placeholder="https://example.com"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              required
            />
          </div>
          <FieldError>{error}</FieldError>
          <Button type="submit" className="w-full" isLoading={isSubmitting}>
            Forge my first audit
          </Button>
        </form>
      </div>
    </main>
  );
}
