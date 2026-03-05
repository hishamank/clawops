"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, X, FolderSync, Cpu } from "lucide-react";

interface DiscoveredAgent {
  id: string;
  name: string;
  workspacePath: string;
}

interface SyncResult {
  agents: DiscoveredAgent[];
  workspaces: Array<{ agentId: string; path: string; hasFiles: boolean }>;
}

type Step = "form" | "agents" | "done";



export function ConnectWizard({ onClose }: { onClose?: () => void }): React.JSX.Element {
  const [step, setStep] = useState<Step>("form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);

  const router = useRouter();

  const [form, setForm] = useState({
    openclawDir: "~/.openclaw",
    gatewayUrl: "http://localhost:3000",
    gatewayToken: "",
  });

  async function handleConnect() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/sync/openclaw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Request failed (${res.status})`);
      }
      const data: SyncResult = await res.json();
      setSyncResult(data);
      setSelectedPaths(
        data.workspaces.filter((w) => w.hasFiles).map((w) => w.path),
      );
      setStep("agents");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleInstall() {
    if (selectedPaths.length === 0) {
      setStep("done");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/sync/openclaw/install-skill`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspacePaths: selectedPaths }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Install failed (${res.status})`);
      }
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Install failed");
    } finally {
      setLoading(false);
    }
  }

  function togglePath(path: string) {
    setSelectedPaths((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path],
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="connect-wizard-title" className="relative w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
        {/* Close button */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-zinc-500 hover:text-zinc-300 transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        )}

        {/* Step 1: Connect form */}
        {step === "form" && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600/20">
                <FolderSync className="h-5 w-5 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-zinc-100">
                  Connect OpenClaw
                </h2>
                <p className="text-sm text-zinc-400">
                  Point ClawOps at your local OpenClaw setup.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-zinc-300">
                  OpenClaw Directory
                </span>
                <input
                  type="text"
                  value={form.openclawDir}
                  onChange={(e) =>
                    setForm({ ...form, openclawDir: e.target.value })
                  }
                  placeholder="~/.openclaw"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-zinc-300">
                  Gateway URL
                </span>
                <input
                  type="text"
                  value={form.gatewayUrl}
                  onChange={(e) =>
                    setForm({ ...form, gatewayUrl: e.target.value })
                  }
                  placeholder="http://localhost:3000"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-zinc-300">
                  Gateway Token
                </span>
                <input
                  type="password"
                  value={form.gatewayToken}
                  onChange={(e) =>
                    setForm({ ...form, gatewayToken: e.target.value })
                  }
                  placeholder="Optional"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </label>
            </div>

            {error && (
              <p className="rounded-lg bg-red-900/30 px-3 py-2 text-sm text-red-400">
                {error}
              </p>
            )}

            <button
              onClick={handleConnect}
              disabled={loading || !form.openclawDir}
              title={!form.openclawDir ? "OpenClaw directory is required" : undefined}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Connecting…
                </>
              ) : (
                "Connect & Scan"
              )}
            </button>
          </div>
        )}

        {/* Step 2: Discovered agents */}
        {step === "agents" && syncResult && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600/20">
                <Cpu className="h-5 w-5 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-zinc-100">
                  Discovered Agents
                </h2>
                <p className="text-sm text-zinc-400">
                  {syncResult.agents.length} agent
                  {syncResult.agents.length !== 1 ? "s" : ""} found. Select
                  workspaces to install skills.
                </p>
              </div>
            </div>

            <div className="max-h-64 space-y-2 overflow-y-auto">
              {syncResult.workspaces.map((ws) => {
                const agent = syncResult.agents.find(
                  (a) => a.id === ws.agentId,
                );
                return (
                  <label
                    key={ws.path}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-800/50 px-4 py-3 transition-colors hover:border-zinc-700"
                  >
                    <input
                      type="checkbox"
                      checked={selectedPaths.includes(ws.path)}
                      onChange={() => togglePath(ws.path)}
                      className="h-4 w-4 rounded border-zinc-600 bg-zinc-700 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-200">
                        {agent?.name ?? ws.agentId}
                      </p>
                      <p className="truncate text-xs text-zinc-500">
                        {ws.path}
                      </p>
                    </div>
                    {ws.hasFiles && (
                      <span className="rounded bg-indigo-600/20 px-2 py-0.5 text-xs text-indigo-400">
                        skills
                      </span>
                    )}
                  </label>
                );
              })}
            </div>

            {error && (
              <p className="rounded-lg bg-red-900/30 px-3 py-2 text-sm text-red-400">
                {error}
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setStep("done");
                }}
                className="flex-1 rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800"
              >
                Skip
              </button>
              <button
                onClick={handleInstall}
                disabled={loading}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Installing…
                  </>
                ) : (
                  `Install (${selectedPaths.length})`
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Done */}
        {step === "done" && (
          <div className="space-y-5 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-600/20">
              <Check className="h-7 w-7 text-green-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-100">
                You&apos;re all set!
              </h2>
              <p className="mt-1 text-sm text-zinc-400">
                Your agents are now visible in ClawOps. Refresh the page to see
                them.
              </p>
            </div>
            <button
              onClick={() => {
                onClose?.();
                router.refresh();
              }}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
