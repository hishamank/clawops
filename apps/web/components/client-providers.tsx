"use client";

import { ToastProvider } from "@/components/toast";
import { CommandPalette } from "@/components/command-palette";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";

export function ClientProviders({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <ToastProvider>
      {children}
      <CommandPalette />
      <KeyboardShortcuts />
    </ToastProvider>
  );
}
