"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { X, CheckCircle2, AlertCircle, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToastVariant = "success" | "error" | "warning" | "info";

export interface ToastItem {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
  exiting?: boolean;
}

interface ToastContextValue {
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}

// ─── Individual Toast ─────────────────────────────────────────────────────────

const icons: Record<ToastVariant, React.ReactNode> = {
  success: <CheckCircle2 className="h-4 w-4 shrink-0 text-[#22c55e]" />,
  error:   <AlertCircle  className="h-4 w-4 shrink-0 text-[#ef4444]" />,
  warning: <AlertTriangle className="h-4 w-4 shrink-0 text-[#f59e0b]" />,
  info:    <Info          className="h-4 w-4 shrink-0 text-[#5e6ad2]" />,
};

const variantBorder: Record<ToastVariant, string> = {
  success: "border-l-[#22c55e]/40",
  error:   "border-l-[#ef4444]/40",
  warning: "border-l-[#f59e0b]/40",
  info:    "border-l-[#5e6ad2]/40",
};

function Toast({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: string) => void;
}) {
  return (
    <div
      className={cn(
        "toast-enter pointer-events-auto flex w-full max-w-sm items-start gap-3",
        "rounded-lg border border-white/10 border-l-2 bg-[#13131f] px-4 py-3",
        "shadow-[0_8px_32px_rgba(0,0,0,0.6)]",
        variantBorder[item.variant],
        item.exiting && "toast-exit",
      )}
    >
      <div className="mt-0.5">{icons[item.variant]}</div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[#ededef] leading-snug">{item.title}</p>
        {item.description && (
          <p className="mt-0.5 text-xs text-[#6b7080] leading-snug">{item.description}</p>
        )}
      </div>
      <button
        onClick={() => onDismiss(item.id)}
        className="mt-0.5 shrink-0 rounded p-0.5 text-[#6b7080] transition-colors hover:text-[#ededef]"
        aria-label="Dismiss notification"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ─── Provider ─────────────────────────────────────────────────────────────────

const DURATION = 3800;

export function ToastProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timerMap = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)),
    );
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 220);
    const timer = timerMap.current.get(id);
    if (timer) { clearTimeout(timer); timerMap.current.delete(id); }
  }, []);

  const add = useCallback(
    (variant: ToastVariant, title: string, description?: string) => {
      const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-4), { id, variant, title, description }]);
      const timer = setTimeout(() => dismiss(id), DURATION);
      timerMap.current.set(id, timer);
    },
    [dismiss],
  );

  useEffect(() => {
    const map = timerMap.current;
    return () => { map.forEach(clearTimeout); map.clear(); };
  }, []);

  const ctx: ToastContextValue = {
    success: (t, d) => add("success", t, d),
    error:   (t, d) => add("error",   t, d),
    warning: (t, d) => add("warning", t, d),
    info:    (t, d) => add("info",    t, d),
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}

      {/* Toast viewport */}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed bottom-5 right-5 z-[200] flex flex-col gap-2"
      >
        {toasts.map((item) => (
          <Toast key={item.id} item={item} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
