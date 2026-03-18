"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const shortcuts: Record<string, string> = {
  d: "/",
  t: "/tasks",
  i: "/ideas",
  p: "/projects",
  n: "/notifications",
  a: "/activity",
  w: "/workflows",
};

export function KeyboardShortcuts(): null {
  const router = useRouter();
  const gPressed = useRef(false);
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      // Skip in inputs and when modifier keys are held
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey
      ) {
        return;
      }

      if (e.key === "g" || e.key === "G") {
        gPressed.current = true;
        clearTimeout(timeout.current);
        timeout.current = setTimeout(() => {
          gPressed.current = false;
        }, 600);
        return;
      }

      if (gPressed.current) {
        const path = shortcuts[e.key.toLowerCase()];
        if (path) {
          e.preventDefault();
          gPressed.current = false;
          clearTimeout(timeout.current);
          router.push(path);
        } else {
          // Any other key cancels the chord
          gPressed.current = false;
          clearTimeout(timeout.current);
        }
      }
    }

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearTimeout(timeout.current);
    };
  }, [router]);

  return null;
}
