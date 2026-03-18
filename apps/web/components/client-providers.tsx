"use client";

import { ToastProvider } from "@/components/toast";
import { CommandPalette } from "@/components/command-palette";

export function ClientProviders({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <ToastProvider>
      {children}
      <CommandPalette />
    </ToastProvider>
  );
}
