# ClawOps Web — Design Guide

This is the authoritative reference for building and modifying any UI in `apps/web/`. Read it before touching a component, page, or style. It reflects the actual implemented design system — not aspirational specs.

---

## 1. Design Philosophy

ClawOps is a **strategic operations layer** for a solo founder running AI agents. The UI must feel:

- **Calm and confident** — not chaotic, not playful, not loud
- **Information-dense but not cluttered** — every pixel earns its place
- **Professional-dark** — like Linear or Vercel's dashboard, not a hacker terminal

Three rules that override everything else:
1. **Signal over noise** — only surface what's actionable
2. **Hierarchy first** — size, weight, and color carry meaning, not decoration
3. **Consistency always** — same pattern for same problem, every time

---

## 2. Color Palette

Use these exact values. Never substitute `zinc-*`, `slate-*`, `gray-*`, or `bg-muted` — those are from the old system.

### Background layers (darkest → lightest)
| Token | Hex | Use |
|---|---|---|
| `bg-[#050510]` | `#050510` | Sidebar background |
| `bg-[#07070f]` | `#07070f` | Page/app background |
| `bg-[#0d0d1a]` | `#0d0d1a` | Cards, dropdowns, inputs |
| `bg-[#13131f]` | `#13131f` | Tooltips, toasts, floating UI |

### Text
| Token | Hex | Use |
|---|---|---|
| `text-[#ededef]` | `#ededef` | Primary text, headings, values |
| `text-[#6b7080]` | `#6b7080` | Secondary text, labels, placeholders |
| `text-[#6b7080]/60` | 60% opacity | Tertiary — timestamps, hints |

### Borders
| Use | Class |
|---|---|
| Standard card/section border | `border border-white/8` |
| Subtle divider inside a card | `border-white/6` |
| Hairline (sidebar separators) | `border-[rgba(255,255,255,0.06)]` |

### Primary accent — Linear indigo
| Role | Value |
|---|---|
| Accent color | `#5e6ad2` |
| Accent background | `bg-[#5e6ad2]/10` |
| Accent text | `text-[#5e6ad2]` |
| Active tab / selected state | `bg-[#5e6ad2]/20 text-[#5e6ad2]` |
| Badge on active item | `bg-[#5e6ad2]/30 text-[#5e6ad2]` |

### Semantic colors
| Variant | Background | Text | Use |
|---|---|---|---|
| Success | `bg-emerald-500/10` | `text-emerald-400` | Done, connected, passing |
| Warning | `bg-amber-500/10` | `text-amber-400` | Paused, idle, attention |
| Danger | `bg-rose-500/10` | `text-rose-400` | Blocked, error, destructive |
| Info | `bg-[#5e6ad2]/10` | `text-[#5e6ad2]` | Informational |

### What to never use
- `bg-muted`, `text-muted-foreground`, `bg-accent`, `border-border` — old system, breaks visual consistency
- Any Tailwind zinc/slate/gray colors — use the explicit hex values above
- Gradients, glow effects, neon — not part of this design language

---

## 3. Typography

### Fonts
Two fonts are loaded globally via `next/font/google`:

| Font | Variable | Use |
|---|---|---|
| Inter | `--font-inter` / `font-sans` | All UI text — headings, body, labels |
| JetBrains Mono | `--font-mono` / `font-mono` | IDs, hashes, code, numbers in data tables |

### Type scale
| Role | Class | Notes |
|---|---|---|
| Page heading | `text-2xl font-semibold tracking-tight text-[#ededef]` | One per page, top-left |
| Section heading | `text-sm font-semibold text-[#ededef]` | Panel/card titles |
| Body text | `text-sm text-[#ededef]/80` | Descriptions, content |
| Label / metadata | `text-xs text-[#6b7080]` | Field labels, secondary info |
| Micro / timestamp | `text-[11px] text-[#6b7080]` | Timestamps, hints |
| Tiny uppercase | `text-[10px] font-semibold uppercase tracking-widest text-[#6b7080]/70` | Card section labels, table headers |
| Mono data | `font-mono tabular-nums text-[#ededef]` | Task IDs, costs, counts |

**Never** use `text-3xl` or larger for page headings. The max is `text-2xl`.

---

## 4. Spacing & Layout

### Grid
- 8px base unit. All spacing increments: `1`, `2`, `3`, `4`, `5`, `6`, `8` (Tailwind units = 4px, 8px, 12px, 16px, 20px, 24px, 32px).
- Page content max-width: `max-w-6xl` for full pages, `max-w-4xl` for detail pages.
- Main content padding: `p-6` (set in `layout.tsx`).

### Page structure
Every page follows this skeleton:

```tsx
<div className="space-y-5">
  {/* Header: title + primary action */}
  <div className="flex items-start justify-between">
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-[#ededef]">Page Title</h1>
      <p className="mt-0.5 text-sm text-[#6b7080]">One-line description</p>
    </div>
    <PrimaryActionButton />
  </div>

  {/* Content */}
  ...
</div>
```

Use `space-y-5` or `space-y-6` between sections. Never `space-y-8` — too much air.

### Two-column detail layout
For detail pages (tasks, agents):

```tsx
<div className="flex gap-6">
  <div className="min-w-0 flex-1 space-y-4">{/* Main content */}</div>
  <div className="w-64 shrink-0 space-y-4">{/* Properties panel */}</div>
</div>
```

---

## 5. Cards

The `<Card>` component defaults to `py-5 gap-5`. Always override when controlling padding yourself:

```tsx
{/* Standard card — let defaults work */}
<Card>
  <CardHeader>...</CardHeader>
  <CardContent>...</CardContent>
</Card>

{/* Custom-padded card — override py to avoid double padding */}
<Card className="py-0 gap-0">
  <CardHeader className="px-5 py-3 border-b border-white/6">
    <CardTitle className="text-sm font-semibold">Title</CardTitle>
  </CardHeader>
  <CardContent className="p-5">
    ...
  </CardContent>
</Card>

{/* Stats card — zero padding on Card, p-5 on content */}
<Card className="py-0">
  <CardContent className="p-5">
    ...
  </CardContent>
</Card>
```

### Card sections (divider rows)
For property panels and settings rows:

```tsx
<div className="flex items-center justify-between px-4 py-3 border-b border-white/6">
  <span className="text-xs text-[#6b7080]">Label</span>
  <span className="text-xs text-[#ededef]">Value</span>
</div>
```

### Custom card (not using Card component)
For project cards and similar where you need full control:

```tsx
<div className="rounded-xl border border-white/8 bg-[#0d0d1a] p-5 transition-colors hover:bg-white/[0.03] shadow-[0_1px_3px_rgba(0,0,0,0.4)]">
  ...
</div>
```

---

## 6. Interactive States

### Hover on clickable rows/items
```tsx
className="transition-colors hover:bg-white/5"
```

### Hover on cards (entire card is a link)
```tsx
className="transition-colors hover:bg-white/[0.03]"
```

### Cursor on clickable non-button elements
```tsx
className="cursor-pointer"
```

### Focus states
Never remove focus rings. Rely on browser defaults or Tailwind's `focus-visible:ring-2 focus-visible:ring-[#5e6ad2]`.

### Disabled state
```tsx
className="opacity-50 cursor-not-allowed pointer-events-none"
```

---

## 7. Tabs & Filter Bars

All tab bars follow this pattern — a pill container with per-tab count badges:

```tsx
<div className="flex items-center gap-0.5 rounded-xl border border-white/8 bg-[#0d0d1a] p-1">
  {tabs.map((tab) => (
    <Link
      key={tab.value}
      href={...}
      className={cn(
        "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
        isActive
          ? "bg-[#5e6ad2]/20 text-[#5e6ad2]"
          : "text-[#6b7080] hover:bg-white/5 hover:text-[#ededef]",
      )}
    >
      {tab.label}
      {count > 0 && (
        <span className={cn(
          "flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 font-mono text-[10px] leading-none",
          isActive ? "bg-[#5e6ad2]/30 text-[#5e6ad2]" : "bg-white/8 text-[#6b7080]",
        )}>
          {count}
        </span>
      )}
    </Link>
  ))}
</div>
```

For **destructive/warning tabs** (e.g. Blocked):
```tsx
isActive
  ? "bg-rose-500/20 text-rose-300"
  : "text-rose-400/60 hover:bg-rose-500/10 hover:text-rose-300"
```

### Inline tab bar (page-level, underline style)
Used in agent detail:

```tsx
<div className="flex items-center gap-0.5 border-b border-white/8">
  <Link className={cn(
    "relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors",
    isActive
      ? "text-[#ededef] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-[#5e6ad2]"
      : "text-[#6b7080] hover:text-[#ededef]",
  )}>
    {label}
  </Link>
</div>
```

---

## 8. Badges & Pills

### Status pills (rounded-full)
```tsx
<span className="rounded-full border px-2 py-0.5 text-[10px] font-medium bg-[color]/10 text-[color] border-[color]/20">
  label
</span>
```

### Inline tag / mono chip
```tsx
<span className="rounded bg-white/8 px-1.5 py-0.5 font-mono text-[10px] text-[#6b7080]">
  value
</span>
```

### Bordered badge
```tsx
<span className="rounded border border-white/8 px-1.5 py-0.5 text-[10px] text-[#6b7080]">
  value
</span>
```

---

## 9. Empty States

Every list that can be empty needs an empty state. Always:

```tsx
<div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/8 py-14 text-center">
  <Icon className="mb-3 h-9 w-9 text-[#6b7080]" />
  <p className="text-sm text-[#6b7080]">Nothing here yet</p>
  <p className="mt-1 text-xs text-[#6b7080]/60">Helpful hint about how items appear.</p>
</div>
```

Dashed border, no background fill. Icon at 36px. Two lines of text maximum.

---

## 10. Progress Bars

```tsx
{/* Track */}
<div className="h-1 w-full overflow-hidden rounded-full bg-white/8">
  {/* Fill — color based on value */}
  <div
    className={cn(
      "h-full rounded-full transition-all",
      pct === 100 ? "bg-emerald-500" : pct >= 50 ? "bg-[#5e6ad2]" : "bg-[#5e6ad2]/50",
    )}
    style={{ width: `${pct}%` }}
  />
</div>
```

Always label the bar with a `text-[10px] text-[#6b7080]` line above or below showing the ratio.

---

## 11. StatsCard

The `<StatsCard>` component supports a `variant` prop:

```tsx
<StatsCard
  title="Active Tasks"
  value={12}
  icon={CheckSquare}
  description="Non-done, non-cancelled"
  variant="warning"         // "default" | "success" | "warning" | "danger"
  delta="+3 today"          // optional trend text
  deltaUp={true}            // true = green TrendingUp, false = rose TrendingDown
/>
```

| Variant | Icon bg | Value color | Use when |
|---|---|---|---|
| `default` | indigo/10 | `#ededef` | Normal metric |
| `success` | emerald/10 | `text-emerald-400` | Good/positive |
| `warning` | amber/10 | `text-amber-400` | Needs attention |
| `danger` | rose/10 | `text-rose-400` | Problem/blocker |

---

## 12. Inline Code & Monospace

For filesystem paths, IDs, CLI commands inline in prose:

```tsx
<code className="rounded bg-white/8 px-1.5 py-0.5 font-mono text-[0.8em] text-[#ededef]">
  clawops task spec TSK-123 --set "..."
</code>
```

---

## 13. Alerts / Callouts

For "Needs Attention" type sections (not toasts):

```tsx
{/* Warning callout */}
<section className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
  <div className="mb-3 flex items-center gap-2">
    <AlertTriangle className="h-4 w-4 text-amber-400" />
    <span className="text-sm font-medium text-amber-300">Title</span>
  </div>
  {/* content */}
</section>

{/* Danger callout (blocked tasks) */}
<section className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4">
  ...rose-400 colors...
</section>
```

---

## 14. Page-level Sections with Headers

For grouped data inside a page (not a card):

```tsx
<section className="space-y-2">
  <div className="flex items-center gap-2 px-1">
    <div className="h-1.5 w-1.5 rounded-full bg-[#5e6ad2]" />
    <span className="text-xs font-semibold text-[#5e6ad2]">Section Name</span>
    <span className="font-mono text-[10px] text-[#6b7080]/50">{count}</span>
  </div>
  {/* items */}
</section>
```

---

## 15. Forms & Inputs

All selects and text inputs:

```tsx
<select className="h-8 rounded-lg border border-white/8 bg-[#0d0d1a] px-2 text-xs text-[#ededef]">
  ...
</select>

<input className="h-8 rounded-lg border border-white/8 bg-[#0d0d1a] px-3 text-xs text-[#ededef] placeholder:text-[#6b7080] outline-none focus:ring-1 focus:ring-[#5e6ad2]/50" />
```

---

## 16. Toast Notifications

Use the `useToast()` hook — never build custom toasts:

```tsx
const toast = useToast();

toast.success("Task created", "TSK-123 added to backlog");
toast.error("Failed to promote idea", "Database error");
toast.warning("No spec attached", "Consider adding a spec before promoting");
toast.info("Sync running", "This may take a few seconds");
```

Toasts auto-dismiss after ~4 seconds. Max 5 stacked. Bottom-right corner.

---

## 17. Navigation

### Sidebar
- Collapsed width: `w-14`. Expanded: `w-[232px]`.
- Collapse state persisted in `localStorage`.
- Three groups: Workspace / Insights / System.
- Live badge counts from `SidebarWrapper` (server component).
- Never add items to the sidebar without updating `SidebarWrapper` counts.

### Breadcrumb bar
Automatic from URL path via `BreadcrumbBar`. No action required — it reads from `usePathname()`.

### Command palette
Opened with `⌘K` or programmatically via `openCommandPalette()`. Add new routes to the `items` array in `command-palette.tsx`.

### Keyboard shortcuts
Global `G+key` chord navigation. Add new shortcuts in `keyboard-shortcuts.tsx`. Current shortcuts:
- `G+D` → `/`, `G+T` → `/tasks`, `G+I` → `/ideas`
- `G+P` → `/projects`, `G+N` → `/notifications`, `G+A` → `/activity`, `G+W` → `/workflows`

---

## 18. Server vs. Client Components

- **Server by default.** Pages and data-fetching components are RSC.
- **Client only when needed:** interactive state, event handlers, `usePathname`, `useSearchParams`, `useToast`.
- **Never import `@clawops/core` or package libraries directly in client components.** Use API routes instead.
- Data fetching goes in the page server component or a `*-wrapper.tsx` server component that passes data down as props.

### Pattern: server shell → client component
```tsx
// app/things/page.tsx (server)
import { ThingsClient } from "@/components/things/things-client";
import { listThings } from "@clawops/things";
import { getDb } from "@/lib/server/runtime";

export default async function ThingsPage() {
  const things = listThings(getDb()).map(mapThing);
  return <ThingsClient initialThings={things} />;
}
```

---

## 19. Icons

Use **Lucide React** only. No emojis as icons. No other icon libraries.

Icon sizing guide:
| Context | Class |
|---|---|
| In nav items | `h-4 w-4` |
| In card headers | `h-3.5 w-3.5` or `h-4 w-4` |
| In empty states | `h-9 w-9` (36px) |
| In badges/pills | `h-3 w-3` |
| In page headings | avoid — let text carry the hierarchy |

---

## 20. Animations

Defined in `globals.css`. Don't add new keyframes without a clear reason.

Available animations:
- `toast-enter` / `toast-exit` — toast slide in/out
- `palette-overlay-in` — command palette backdrop
- `palette-in` — command palette panel
- `.sidebar-transition` — sidebar collapse width transition
- `.nav-active-indicator` — active sidebar item pseudo-element

For new transitions, always use `transition-colors` or `transition-all` with Tailwind. Duration default: `duration-100` for color, `duration-200` for layout.

---

## 21. Checklist Before Submitting Any UI Change

- [ ] Using only design system hex values (no `zinc-*`, `bg-muted`, `text-muted-foreground`)
- [ ] Page heading is `text-2xl font-semibold tracking-tight text-[#ededef]`
- [ ] Empty states have dashed border + icon + two text lines
- [ ] Cards with custom padding use `py-0 gap-0` on `<Card>`
- [ ] Interactive rows have `transition-colors hover:bg-white/5`
- [ ] No `text-3xl` or larger headings
- [ ] Icons are Lucide, sized appropriately for context
- [ ] Client components justified — not used where RSC works
- [ ] `pnpm typecheck` passes with zero errors
- [ ] `pnpm --filter @clawops/web build` compiles cleanly
