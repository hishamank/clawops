import { Globe, Key, Info, CheckCircle, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getDb } from "@/lib/server/runtime";
import { agents } from "@clawops/core";

export const dynamic = "force-dynamic";

const DB_PATH = process.env.CLAWOPS_DB_PATH ?? "./clawops.db";
const CLAWOPS_MODE = process.env.CLAWOPS_MODE ?? "local";

function maskPath(value: string): string {
  if (value.length <= 8) return value;
  return `${value.slice(0, 4)}***${value.slice(-2)}`;
}

async function checkConnection(): Promise<boolean> {
  try {
    getDb().select().from(agents).limit(1).all();
    return true;
  } catch {
    return false;
  }
}

export default async function SettingsPage(): Promise<React.JSX.Element> {
  const connected = await checkConnection();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Configuration for your ClawOps instance.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Connection */}
        <Card className="py-4">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Connection</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">
                Database Path
              </span>
              <p className="rounded-xl bg-muted px-3 py-2 font-mono text-sm">
                {maskPath(DB_PATH)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                Status
              </span>
              {connected ? (
                <Badge variant="secondary" className="gap-1">
                  <CheckCircle className="h-3 w-3 text-emerald-500" />
                  Connected
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1">
                  <XCircle className="h-3 w-3 text-rose-500" />
                  Disconnected
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Authentication */}
        <Card className="py-4">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Authentication</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-3 rounded-xl bg-muted p-4">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="space-y-1">
                <p className="text-sm font-medium">API key configured via environment</p>
                <p className="text-xs text-muted-foreground">
                  ClawOps now runs web + core logic in a single Next.js runtime. No separate API key is required for dashboard reads.
                </p>
                <p className="text-xs text-muted-foreground">
                  Runtime mode: <code className="rounded bg-zinc-800 px-1 py-0.5 text-primary">{CLAWOPS_MODE}</code>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* About */}
        <Card className="py-4 lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">About</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">
                  Version
                </span>
                <p className="text-sm font-medium">0.1.0</p>
              </div>
              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">
                  Documentation
                </span>
                <a
                  href="https://github.com/hishamank/clawops"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-sm font-medium text-primary hover:underline"
                >
                  GitHub Repository
                </a>
              </div>
              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">
                  Framework
                </span>
                <p className="text-sm font-medium">
                  Next.js 15 &middot; App Router
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
