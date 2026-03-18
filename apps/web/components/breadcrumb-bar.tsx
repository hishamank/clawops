"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

// ─── Path → Label mapping ─────────────────────────────────────────────────────

const segmentLabels: Record<string, string> = {
  "":             "Overview",
  tasks:          "Tasks",
  projects:       "Projects",
  ideas:          "Ideas",
  workflows:      "Workflows",
  activity:       "Activity",
  analytics:      "Analytics",
  openclaw:       "OpenClaw",
  notifications:  "Notifications",
  settings:       "Settings",
  agents:         "Fleet",
  files:          "Files",
  compare:        "Compare",
  new:            "New",
  docs:           "Docs",
  api:            "API",
};

function labelFor(segment: string, index: number, segments: string[]): string {
  if (segmentLabels[segment]) return segmentLabels[segment];

  // If it looks like an ID (long alphanumeric string), shorten it
  if (segment.length > 16 && /^[a-z0-9_-]+$/i.test(segment)) {
    const parent = segments[index - 1];
    if (parent === "tasks")     return `Task`;
    if (parent === "projects")  return `Project`;
    if (parent === "ideas")     return `Idea`;
    if (parent === "workflows") return `Workflow`;
    if (parent === "agents")    return `Agent`;
    if (parent === "files")     return `File`;
    return segment.slice(0, 8) + "…";
  }

  return segment.charAt(0).toUpperCase() + segment.slice(1);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BreadcrumbBar(): React.JSX.Element | null {
  const pathname = usePathname();

  const segments = pathname === "/" ? [""] : pathname.split("/").filter(Boolean);

  // Build crumbs
  const crumbs = segments.map((seg, i) => {
    const href = i === 0 && seg === "" ? "/" : "/" + segments.slice(0, i + 1).join("/");
    const label = labelFor(seg, i, segments);
    const isLast = i === segments.length - 1;
    return { href, label, isLast };
  });

  // Single-segment paths (e.g. just "Overview") — skip the breadcrumb bar to save space
  if (crumbs.length <= 1) return null;

  return (
    <div className="flex h-10 shrink-0 items-center border-b border-white/6 bg-[#07070f]/80 px-6 backdrop-blur-sm">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5">
        {crumbs.map((crumb, i) => (
          <span key={crumb.href} className="flex items-center gap-1.5">
            {i > 0 && (
              <ChevronRight className="h-3 w-3 shrink-0 text-white/20" aria-hidden />
            )}
            {crumb.isLast ? (
              <span className="text-xs font-medium text-[#ededef]">{crumb.label}</span>
            ) : (
              <Link
                href={crumb.href}
                className="text-xs text-[#6b7080] transition-colors hover:text-[#ededef]"
              >
                {crumb.label}
              </Link>
            )}
          </span>
        ))}
      </nav>
    </div>
  );
}
