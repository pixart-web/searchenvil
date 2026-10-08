"use client";

import { useId, useState, type FormEvent } from "react";
import { Button, FieldError, Input, Label } from "@searchanvil/ui";
import { isValidEmail } from "@/lib/launch-list-validation";

export interface LaunchListFormProps {
  /** Which page/CTA this form instance lives on — stored with the signup for attribution. */
  source: string;
  /** Compact hides the name/company/role fields, keeping just email + submit. */
  variant?: "full" | "compact";
  className?: string;
}

type SubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success" }
  | { status: "error"; message: string };

export function LaunchListForm({
  source,
  variant = "full",
  className,
}: LaunchListFormProps): React.ReactElement {
  const formId = useId();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  // Honeypot — real visitors never see this field (visually hidden, not
  // reachable by Tab). A bot that fills every input it can find will fill
  // this too, and the API silently discards submissions where it's set.
  const [website, setWebsite] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [state, setState] = useState<SubmitState>({ status: "idle" });

  async function onSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setFieldError(undefined);

    if (!isValidEmail(email)) {
      setFieldError("Enter a valid email address.");
      return;
    }

    setState({ status: "submitting" });
    try {
      const res = await fetch("/api/launch-list", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim() || undefined,
          company: company.trim() || undefined,
          role: role.trim() || undefined,
          source,
          website,
        }),
      });

      if (res.status === 429) {
        setState({
          status: "error",
          message: "Too many attempts. Please wait a minute and try again.",
        });
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => undefined);
        setState({
          status: "error",
          message: data?.error?.message ?? "Something went wrong. Please try again.",
        });
        return;
      }

      setState({ status: "success" });
    } catch {
      setState({
        status: "error",
        message: "We couldn't reach the server. Check your connection and try again.",
      });
    }
  }

  if (state.status === "success") {
    return (
      <div
        role="status"
        className={`rounded border border-success/40 bg-success/10 px-4 py-3 text-sm text-steel-100 ${className ?? ""}`}
      >
        <p className="font-medium text-steel-100">You&apos;re on the list.</p>
        <p className="mt-1 text-steel-300">
          We&apos;ll email you as soon as SearchAnvil opens for general availability — no spam, no
          obligation.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className={className}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex-1">
          <Label htmlFor={`${formId}-email`} className="sr-only">
            Work email
          </Label>
          <Input
            id={`${formId}-email`}
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={fieldError ? true : undefined}
            aria-describedby={fieldError ? `${formId}-email-error` : undefined}
            required
          />
          {fieldError ? (
            <span id={`${formId}-email-error`}>
              <FieldError>{fieldError}</FieldError>
            </span>
          ) : null}
        </div>
        <Button type="submit" isLoading={state.status === "submitting"} className="shrink-0">
          Join the launch list
        </Button>
      </div>

      {variant === "full" ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor={`${formId}-name`}>Name (optional)</Label>
            <Input
              id={`${formId}-name`}
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor={`${formId}-company`}>Company (optional)</Label>
            <Input
              id={`${formId}-company`}
              autoComplete="organization"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor={`${formId}-role`}>Role (optional)</Label>
            <Input
              id={`${formId}-role`}
              autoComplete="organization-title"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            />
          </div>
        </div>
      ) : null}

      {/* Honeypot field: visually hidden and out of tab order, not a real form field. */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", top: "auto", width: 1, height: 1, overflow: "hidden" }}>
        <label htmlFor={`${formId}-website`}>Leave this field empty</label>
        <input
          id={`${formId}-website`}
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      {state.status === "error" ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {state.message}
        </p>
      ) : null}

      <p className="mt-3 text-xs text-steel-500">
        Prelaunch signup only — no payment, no account is created. See our{" "}
        <a href="/privacy" className="underline hover:text-steel-300">
          Privacy Policy
        </a>
        .
      </p>
    </form>
  );
}
