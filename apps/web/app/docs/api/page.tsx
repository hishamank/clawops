import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const routes = [
  "GET /api/health",
  "POST /api/auth/login",
  "POST /api/auth/logout",
  "POST /api/agents/register",
  "GET /api/agents",
  "GET /api/agents/:id",
  "PATCH /api/agents/:id/status",
  "PATCH /api/agents/:id/skills",
  "POST /api/agents/:id/heartbeat",
  "GET /api/tasks",
  "POST /api/tasks",
  "GET /api/tasks/:id",
  "PATCH /api/tasks/:id",
  "POST /api/tasks/:id/complete",
  "GET /api/projects",
  "POST /api/projects",
  "GET /api/projects/:id",
  "PATCH /api/projects/:id",
  "GET /api/ideas",
  "POST /api/ideas",
  "POST /api/ideas/:id/promote",
  "GET /api/habits",
  "POST /api/habits",
  "POST /api/habits/:id/run",
  "GET /api/analytics/tokens",
  "GET /api/analytics/costs",
  "GET /api/notifications",
  "PATCH /api/notifications/:id",
  "PATCH /api/notifications/:id/read",
  "PATCH /api/notifications/read-all",
  "GET /api/activity",
  "GET /api/integrations/openclaw",
  "POST /api/integrations/openclaw",
  "GET /api/integrations/openclaw/:id",
  "PATCH /api/integrations/openclaw/:id",
  "GET /api/activity",
  "POST /api/sync/openclaw",
  "GET /api/sync/openclaw  (latest status + recent sync runs)",
  "POST /api/sync/openclaw/install-skill",
];

export default function ApiDocsPage(): React.JSX.Element {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">API Docs</h1>
        <p className="mt-1 text-muted-foreground">Static route reference for the Next.js transport layer.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          <code>POST /api/sync/openclaw</code> persists the OpenClaw connection, records the
          sync run, and registers or updates discovered agents through the shared sync
          onboarding service.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Available Routes</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1 text-sm">
            {routes.map((route) => (
              <li key={route} className="font-mono text-muted-foreground">{route}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
