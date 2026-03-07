# ClawOps Design Language — Strategic Founder OS

This is a hybrid of:
- Strategic Command (visual tone)
- Modular Founder OS (layout philosophy)
- Narrative-first UX

It is calm. It is confident. It feels like leverage.
Not DevOps. Not hacker toy. Not SaaS clone.

---

## Core Philosophy

ClawOps is your AI brain's control layer. It should feel like:
- A founder reviewing leverage
- A strategist overseeing systems
- A calm operations room, not a battlefield

Signal > Noise · Clarity > Density · Hierarchy > Everything

---

## Visual System

### Theme
Dark mode default and polished. Light mode equally premium.

### Colors
- Base dark: `zinc-950` / `slate-950`
- Base light: `stone-50` / `neutral-50`
- Surface dark: `zinc-900`
- Surface light: `white`
- Accent: muted indigo or electric blue (single primary)
- Success: emerald (softened)
- Warning: amber (softened)
- Error: rose (softened)

❌ No gradients · No neon · No green terminal aesthetic

### Typography
Font: Inter / Geist
- Large page headers (clear identity per page)
- Section headers strong but not loud
- Body: 16–18px
- Meta labels: small but legible

---

## Layout Patterns

### Fleet Overview
Inspirational first. Top: headline + 3–5 key metrics (active agents, tasks today, ideas queued, spend this month). Then: agent grid → recent activity strip → ideas queue preview. Analytics present but not dominant.

### Agent Profile
Scroll-based narrative: Identity Strip → Knowledge Panel (markdown) → Habits (streak indicators) → Active Tasks → Performance summary (compact) → Recent artifacts. Reads like a digital employee profile, not a console.

### Tasks & Projects
Clean list view. No kanban. Project page: PRD prominent → milestones visible → refined progress bar → tasks below. Structured work, not task churn.

---

## Component Rules
- rounded-xl everywhere
- shadow-sm soft shadow
- Minimal borders
- 8px spacing grid
- Clean tabs, clear hover states
- Every module: title + small action buttons + clear separation + expandable behavior

---

## Interaction Language
- Quick-add idea from anywhere
- Smooth transitions + subtle micro-animations
- Keyboard shortcuts for power users
- Density toggle optional but hidden

---

## Tech Stack (Web App)
- Framework: Next.js 15, App Router, TypeScript
- Styling: Tailwind CSS + shadcn/ui
- Auth: API key in env (internal tool) — login page available but optional
- API: Uses Next.js route handlers within the same web runtime (single process)

---

## Final Identity
> The calm strategic layer above autonomous AI systems.
