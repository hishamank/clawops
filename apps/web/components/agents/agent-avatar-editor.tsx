"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Loader2, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AgentAvatar } from "@/components/agents/agent-avatar";
import type { UpdateAgentAvatarState } from "@/app/agents/[id]/actions";
import { updateAgentAvatarAction } from "@/app/agents/[id]/actions";

const initialState: UpdateAgentAvatarState = {};

interface AgentAvatarEditorProps {
  agentId: string;
  agentName: string;
  currentAvatar: string | null;
  hasOpenClawMapping: boolean;
}

export function AgentAvatarEditor({
  agentId,
  agentName,
  currentAvatar,
  hasOpenClawMapping,
}: AgentAvatarEditorProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, formAction, isPending] = useActionState(
    updateAgentAvatarAction.bind(null, agentId),
    initialState,
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    inputRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape" && !isPending) {
        setIsOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isPending]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="group relative block shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5e6ad2] focus-visible:ring-offset-2 focus-visible:ring-offset-[#07070f]"
        aria-label={`Edit avatar for ${agentName}`}
      >
        <div className="relative overflow-hidden rounded-2xl">
          <AgentAvatar
            name={agentName}
            avatar={currentAvatar}
            className="h-14 w-14 rounded-2xl bg-[#5e6ad2]/10 transition-transform duration-200 group-hover:scale-[1.03]"
            textClassName="text-xl font-bold text-[#5e6ad2]"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-[#050510]/70 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <Pencil className="h-4 w-4 text-[#ededef]" />
          </div>
        </div>
        <div className="absolute inset-x-1 bottom-1 rounded-md border border-white/10 bg-[#050510]/85 px-1.5 py-0.5 text-center text-[9px] font-medium uppercase tracking-[0.18em] text-[#ededef]/80 opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100">
          Edit
        </div>
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm"
          role="presentation"
          onClick={() => {
            if (!isPending) {
              setIsOpen(false);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`avatar-dialog-title-${agentId}`}
            className="w-full max-w-md rounded-2xl border border-white/8 bg-[#0d0d1a] shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-white/6 px-5 py-4">
              <div className="min-w-0">
                <h2
                  id={`avatar-dialog-title-${agentId}`}
                  className="text-sm font-semibold text-[#ededef]"
                >
                  Edit Agent Avatar
                </h2>
                <p className="mt-1 text-xs text-[#6b7080]">
                  Update the dashboard avatar and sync it to OpenClaw identity when linked.
                </p>
              </div>
              <Button
                type="button"
                size="icon-sm"
                disabled={isPending}
                onClick={() => setIsOpen(false)}
                className="border border-white/8 bg-transparent text-[#6b7080] hover:bg-white/[0.03] hover:text-[#ededef]"
                aria-label="Close avatar dialog"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form action={formAction} className="p-5">
              <div className="flex items-start gap-4">
                <AgentAvatar
                  name={agentName}
                  avatar={currentAvatar}
                  className="h-16 w-16 shrink-0 rounded-2xl bg-[#5e6ad2]/10"
                  textClassName="text-xl font-bold text-[#5e6ad2]"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[#ededef]">{agentName}</p>
                  <p className="mt-1 text-xs text-[#6b7080]">
                    Use an image URL or data URL.
                    {hasOpenClawMapping
                      ? " This also updates IDENTITY.md in the linked OpenClaw workspace."
                      : " This agent is not linked to OpenClaw, so only ClawOps will be updated."}
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-2">
                <Label htmlFor={`avatar-${agentId}`} className="text-xs text-[#6b7080]">
                  Image URL
                </Label>
                <Input
                  ref={inputRef}
                  id={`avatar-${agentId}`}
                  name="avatar"
                  defaultValue={currentAvatar ?? ""}
                  placeholder="https://example.com/avatar.png"
                  className="h-10 border-white/8 bg-[#07070f] text-sm text-[#ededef] placeholder:text-[#6b7080] focus-visible:ring-[#5e6ad2]"
                />
              </div>

              {state.error && (
                <p className="mt-4 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-400">
                  {state.error}
                </p>
              )}
              {state.message && !state.error && (
                <p className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400">
                  {state.message}
                </p>
              )}

              <div className="mt-5 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={isPending}
                  onClick={() => setIsOpen(false)}
                  className="h-8 rounded-lg border border-white/8 bg-transparent px-3 text-xs text-[#6b7080] hover:bg-white/[0.03] hover:text-[#ededef]"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isPending}
                  className="h-8 rounded-lg bg-[#5e6ad2] px-3 text-xs text-white hover:bg-[#5e6ad2]/90"
                >
                  {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save avatar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
