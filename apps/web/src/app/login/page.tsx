"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, FieldError, Input, Label } from "@searchanvil/ui";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { CurrentUser } from "@/lib/types";

export default function LoginPage(): React.ReactElement {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(undefined);
    setIsSubmitting(true);
    try {
      await apiFetch<{ user: CurrentUser }>("/auth/login", {
        method: "POST",
        body: { email, password },
      });
      router.push("/app/projects");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-ember-400">SearchAnvil</p>
        <h1 className="mt-1 text-2xl font-semibold text-steel-100">Sign in</h1>

        <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <FieldError>{error}</FieldError>
          <Button type="submit" className="w-full" isLoading={isSubmitting}>
            Sign in
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-steel-400">
          Don&apos;t have an account?{" "}
          <a href="/register" className="text-ember-400 hover:underline">
            Create one
          </a>
        </p>
      </div>
    </main>
  );
}
