"use client";

import { useActionState, useEffect, useRef } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { UpdateOpenClawGatewayTokenState } from "@/app/settings/actions";
import { updateOpenClawGatewayTokenAction } from "@/app/settings/actions";

const initialState: UpdateOpenClawGatewayTokenState = {};

interface OpenClawTokenFormProps {
  connectionId: string;
  hasGatewayToken: boolean;
}

export function OpenClawTokenForm({
  connectionId,
  hasGatewayToken,
}: OpenClawTokenFormProps): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, formAction, isPending] = useActionState(
    updateOpenClawGatewayTokenAction.bind(null, connectionId),
    initialState,
  );

  useEffect(() => {
    if (state.success && inputRef.current) {
      inputRef.current.value = "";
    }
  }, [state.success]);

  return (
    <form action={formAction} className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#6b7080]" />
          <Input
            ref={inputRef}
            type="password"
            name="gatewayToken"
            autoComplete="off"
            placeholder={hasGatewayToken ? "Replace saved gateway token" : "Paste OpenClaw gateway token"}
            className="h-9 border-white/8 bg-[#07070f] pl-8 text-sm text-[#ededef] placeholder:text-[#6b7080] focus-visible:ring-[#5e6ad2]"
          />
        </div>
        <Button
          type="submit"
          size="sm"
          disabled={isPending}
          className="h-9 rounded-lg bg-[#5e6ad2] px-3 text-xs text-white hover:bg-[#5e6ad2]/90"
        >
          {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Save token
        </Button>
      </div>

      {state.error && (
        <p className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-400">
          {state.error}
        </p>
      )}
      {state.message && !state.error && (
        <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400">
          {state.message}
        </p>
      )}
    </form>
  );
}
