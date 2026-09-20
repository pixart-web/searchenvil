import Link from "next/link";
import { StatusState } from "@searchanvil/ui";

export default function NotFound(): React.ReactElement {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-ember-400">SearchAnvil</p>
      <StatusState
        kind="empty"
        title="Page not found"
        description="The page you're looking for doesn't exist or may have moved."
        action={
          <Link href="/" className="text-sm font-medium text-ember-400 hover:underline">
            Back to home
          </Link>
        }
      />
    </main>
  );
}
