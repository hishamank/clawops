import { Database, Shield, Info, CheckCircle2, XCircle, Keyboard } from "lucide-react";
import { getDb } from "@/lib/server/runtime";
import { agents } from "@clawops/core";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const DB_PATH = process.env.CLAWOPS_DB_PATH ?? "./clawops.db";
const CLAWOPS_MODE = process.env.CLAWOPS_MODE ?? "local";

async function checkConnection(): Promise<boolean> {
  try {
    getDb().select().from(agents).limit(1).all();
    return true;
  } catch {
    return false;
  }
}

function Row({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <span className="text-xs text-[#6b7080]">{label}</span>
      <div className="text-right">{children}</div>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="rounded-xl border border-white/8 bg-[#0d0d1a]">
      <div className="flex items-center gap-2 border-b border-white/6 px-5 py-3">
        <Icon className="h-3.5 w-3.5 text-[#6b7080]" />
        <span className="text-xs font-semibold uppercase tracking-widest text-[#6b7080]/70">{title}</span>
      </div>
      <div className="divide-y divide-white/6 px-5">{children}</div>
    </div>
  );
}

const keyboardShortcuts = [
  { chord: "G  D", label: "Dashboard",     path: "/"               },
  { chord: "G  T", label: "Tasks",          path: "/tasks"          },
  { chord: "G  I", label: "Ideas",          path: "/ideas"          },
  { chord: "G  P", label: "Projects",       path: "/projects"       },
  { chord: "G  N", label: "Notifications",  path: "/notifications"  },
  { chord: "G  A", label: "Activity",       path: "/activity"       },
  { chord: "G  W", label: "Workflows",      path: "/workflows"      },
  { chord: "⌘K",   label: "Command palette", path: null             },
];

export default async function SettingsPage(): Promise<React.JSX.Element> {
  const connected = await checkConnection();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#ededef]">Settings</h1>
        <p className="mt-0.5 text-sm text-[#6b7080]">Configuration for your ClawOps instance.</p>
      </div>

      {/* Database */}
      <Section icon={Database} title="Database">
        <Row label="Path">
          <code className="font-mono text-xs text-[#ededef]">{DB_PATH}</code>
        </Row>
        <Row label="Status">
          <span className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium",
            connected
              ? "bg-emerald-500/10 text-emerald-400"
              : "bg-rose-500/10 text-rose-400",
          )}>
            {connected
              ? <><CheckCircle2 className="h-3 w-3" /> Connected</>
              : <><XCircle      className="h-3 w-3" /> Disconnected</>
            }
          </span>
        </Row>
        <Row label="Mode">
          <code className="font-mono text-xs text-[#6b7080]">{CLAWOPS_MODE}</code>
        </Row>
      </Section>

      {/* Auth */}
      <Section icon={Shield} title="Authentication">
        <Row label="API Key">
          <span className="text-xs text-[#6b7080]">Configured via environment</span>
        </Row>
        <Row label="Runtime">
          <span className="text-xs text-[#6b7080]">
            Next.js 15 · App Router — no separate API key required for dashboard reads.
          </span>
        </Row>
      </Section>

      {/* Keyboard shortcuts */}
      <Section icon={Keyboard} title="Keyboard Shortcuts">
        {keyboardShortcuts.map((s) => (
          <Row key={s.chord} label={s.label}>
            <kbd className="rounded border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[11px] text-[#6b7080] tracking-widest">
              {s.chord}
            </kbd>
          </Row>
        ))}
      </Section>

      {/* About */}
      <Section icon={Info} title="About">
        <Row label="Version"><span className="text-xs text-[#ededef]">0.1.0</span></Row>
        <Row label="Framework"><span className="text-xs text-[#ededef]">Next.js 15 · App Router</span></Row>
        <Row label="Repository">
          <a
            href="https://github.com/hishamank/clawops"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[#5e6ad2] hover:underline"
          >
            github.com/hishamank/clawops
          </a>
        </Row>
      </Section>
    </div>
  );
}
