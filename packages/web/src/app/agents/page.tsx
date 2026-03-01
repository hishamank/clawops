import Link from "next/link";
import { getAgents } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/card";
import { Badge } from "@/components/badge";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  let agents: Awaited<ReturnType<typeof getAgents>> = [];
  let error: string | null = null;

  try {
    agents = await getAgents();
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to fetch agents";
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Agents</h1>
        <p className="text-muted-foreground">
          All registered agents
        </p>
      </div>

      {error && (
        <Card className="border-red-900">
          <CardContent className="p-4">
            <p className="text-sm text-red-400">
              Could not connect to API: {error}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {agents.map((agent) => (
          <Link key={agent.id} href={`/agents/${agent.id}`}>
            <Card className="transition-colors hover:bg-secondary/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{agent.name}</CardTitle>
                  <Badge variant={agent.status}>{agent.status}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <dl className="space-y-2 text-sm">
                  <div>
                    <dt className="text-muted-foreground">ID</dt>
                    <dd className="font-mono text-xs">{agent.id}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Last Seen</dt>
                    <dd>{new Date(agent.lastSeen).toLocaleString()}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {agents.length === 0 && !error && (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">
              No agents registered yet. Use the CLI to register one:
            </p>
            <code className="mt-2 block text-sm text-foreground">
              clawops agent register --name &quot;my-agent&quot;
            </code>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
