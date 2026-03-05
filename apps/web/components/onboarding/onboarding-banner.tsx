"use client";

import { useState } from "react";
import { ConnectWizard } from "./connect-wizard";

export function OnboardingBanner(): React.JSX.Element {
  const [showWizard, setShowWizard] = useState(false);

  return (
    <>
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 flex items-center justify-between">
        <div>
          <h3 className="text-zinc-100 font-semibold">
            Connect your OpenClaw setup
          </h3>
          <p className="text-zinc-400 text-sm mt-1">
            Scan your agents, install skills, and get your fleet visible in
            ClawOps.
          </p>
        </div>
        <button
          onClick={() => setShowWizard(true)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors shrink-0"
        >
          Connect OpenClaw
        </button>
      </div>
      {showWizard && <ConnectWizard onClose={() => setShowWizard(false)} />}
    </>
  );
}
