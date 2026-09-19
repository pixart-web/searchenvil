import { Card, CardContent, CardHeader, CardTitle } from "@searchenvil/ui";

export default function ShellDemoPage(): React.ReactElement {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-steel-100">Application shell demo</h1>
      <p className="max-w-2xl text-sm text-steel-400">
        This route exists to visually verify the responsive AppShell (sidebar + topbar) in
        isolation before real project data exists. Resize the window below the `lg` breakpoint to
        see the sidebar collapse into an off-canvas panel.
      </p>
      <Card>
        <CardHeader>
          <CardTitle>Overview placeholder</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-steel-400">
          Real dashboard content lands in Phase 09.
        </CardContent>
      </Card>
    </div>
  );
}
