# AGENTS.md — Guide for AI Agents Working on ClawOps

This file is for AI agents (Claude Code, Gemini CLI, Qwen Code, or any coding agent) working on the ClawOps codebase. Read this before touching any file.

Also read `CLAUDE.md` — it contains the full project context, architecture, data model, and coding principles. This file tells you *how to work*. CLAUDE.md tells you *what to build*.

---

## Understand the Project First

ClawOps is a monorepo. Before writing a single line of code:

1. Read `CLAUDE.md` fully
2. Run `pnpm install` if node_modules is missing
3. Run `pnpm typecheck` to understand the current state
4. Read the files relevant to your task — don't assume, read

If you don't understand what you're being asked to build, ask. Do not guess and proceed.

---

## Monorepo Navigation

```
apps/api/     → Fastify REST API
apps/cli/     → Commander.js CLI binary
apps/web/     → Next.js dashboard
packages/core/        → DB + schema (everything depends on this)
packages/agents/      → agent business logic
packages/tasks/       → task business logic
packages/projects/    → project business logic
packages/ideas/       → idea business logic
packages/habits/      → habit business logic
packages/analytics/   → usage + cost logic
packages/notifications/ → notification logic
packages/shared/      → types, constants, utils
```

**Dependency rule:** `packages/*` libraries must never import from `apps/*`. Apps import from packages, never the reverse. No circular dependencies between packages.

---

## Before Writing Any Code

- Run `pnpm typecheck` — know the baseline error count before you change anything
- Read the existing file you're about to edit — understand what's already there
- Check if a type or utility already exists in `packages/shared` before creating a new one
- Check if the schema table you need already exists in `packages/core/src/schema.ts`

---

## Commands You'll Use

```bash
# Install dependencies
pnpm install

# Run everything in dev mode
pnpm dev

# Run a single app
pnpm --filter @clawops/api dev
pnpm --filter @clawops/web dev

# Type check everything
pnpm typecheck

# Type check one package
pnpm --filter @clawops/core typecheck

# Build everything
pnpm build

# Build one package
pnpm --filter @clawops/core build

# Lint
pnpm lint

# Database: generate migration from schema changes
pnpm --filter @clawops/core db:generate

# Database: apply migrations
pnpm --filter @clawops/core db:migrate
```

---

## How to Add a New Feature

Follow this order every time. Do not skip steps.

### 1. Schema change (if needed)
Edit `packages/core/src/schema.ts`. Then run:
```bash
pnpm --filter @clawops/core db:generate
```
A new migration file will appear in `packages/core/migrations/`. Commit it.

### 2. Package library
Implement the business logic in the relevant `packages/<n>/src/` library. Export everything from `packages/<n>/src/index.ts`. Keep functions pure where possible — accept `db` as a parameter rather than importing it directly, so logic is testable.

Example pattern:
```typescript
// packages/tasks/src/create.ts
import type { DB } from '@clawops/core';
import { tasks } from '@clawops/core';

export async function createTask(db: DB, input: NewTask) {
  const id = crypto.randomUUID();
  const [task] = await db.insert(tasks).values({ id, ...input }).returning();
  return task;
}
```

### 3. API route
Add the route in `apps/api/src/routes/<entity>.ts`. Import from the package library. Validate input with Zod. Register the route in `apps/api/src/index.ts`.

### 4. CLI command (if applicable)
Add the command in `apps/cli/src/commands/<entity>.ts`. Import from the package library (local mode) or call the API (remote mode). Register in `apps/cli/src/index.ts`.

### 5. Web UI (if applicable)
Add the page or component in `apps/web/`. Use shadcn/ui components. Fetch from the API — do not import package libraries directly in the web app.

---

## TypeScript Rules

These are non-negotiable:

- **No `any`** — use `unknown` and narrow with type guards
- **Strict mode is on** — noUnusedLocals, noUnusedParameters, noImplicitReturns
- **All functions must have explicit return types** on exported functions
- **Zod for runtime validation** — all API inputs validated with Zod schemas
- **Inferred types from Drizzle** — use `typeof table.$inferSelect` and `typeof table.$inferInsert`, do not hand-write entity interfaces that duplicate the schema

If `pnpm typecheck` had zero errors before your change, it must have zero errors after.

---

## Database Rules

- **Drizzle only** — no raw SQL except inside migration files
- **WAL mode is set on connection** — do not change this
- **All IDs are `crypto.randomUUID()`** — no sequential integers, no nanoid unless already in use
- **Never modify existing migration files** — only add new ones
- **JSON array fields** (`skills`, `tags`) — stored as TEXT in SQLite. Use the transform helpers in `packages/core/src/helpers.ts` to serialize/deserialize. Never JSON.parse inline.
- **Timestamps** — all timestamps use `integer` with `{ mode: 'timestamp' }`. Store as Unix seconds. Never use `text` for dates.

---

## API Rules

- Every route must have a Zod input schema
- Every route must have a response type annotation
- Swagger docs are auto-generated — use `schema:` on every route registration so docs stay accurate
- Auth: all routes except `/health` and `/auth/login` require a valid API key in the `x-api-key` header
- Errors: return `{ error: string, code: string }` — never expose stack traces
- Every mutation (POST, PATCH, DELETE) must write an `events` row after the DB operation

```typescript
// Always write an event after mutations
await db.insert(events).values({
  id: crypto.randomUUID(),
  agentId: context.agentId ?? null,
  action: 'task.created',
  entityType: 'task',
  entityId: task.id,
  meta: JSON.stringify({ title: task.title }),
  createdAt: new Date(),
});
```

---

## CLI Rules

- Every command must support `--json` flag — when set, output raw JSON only, no decorative text
- Default output: one line, just the ID and a status word. Example: `task abc123 created`
- Never prompt interactively — all inputs must come from flags
- `clawops agent init` must be idempotent — if the agent already exists (matched by name + framework), update it instead of creating a duplicate
- Every command execution must write an `events` row (same pattern as API)

---

## Web UI Rules

- Use shadcn/ui components — do not install additional UI libraries without asking
- Tailwind utility classes only — no custom CSS files
- All data fetching via the API — do not import `@clawops/core` or any package library in the web app
- No `useEffect` for data fetching — use React Server Components or SWR/React Query
- Loading states and error states are required on every data-fetching component — never leave them blank

---

## What Requires Human Approval Before Building

Stop and ask if you're about to:

- Add a new dependency to any `package.json`
- Change the Drizzle schema in a way that drops or renames a column
- Add a new environment variable
- Change the auth mechanism
- Add a new top-level package or app to the monorepo
- Build something not described in `CLAUDE.md` or the PRD

---

## What You Should Never Do

- Never delete migration files
- Never commit `.env` files (only `.env.example`)
- Never commit `*.db`, `*.db-shm`, `*.db-wal` files
- Never store API keys or secrets in plaintext anywhere in the codebase
- Never import `apps/*` from `packages/*`
- Never bypass TypeScript errors with `@ts-ignore` or `@ts-expect-error` without a comment explaining exactly why
- Never write a feature that's listed under "What's NOT in v0.1" in CLAUDE.md

---

## Commit Message Format

Use conventional commits:

```
feat(tasks): add task completion endpoint with artifact logging
fix(cli): handle missing --json flag gracefully
chore(core): generate migration for habits table
docs: update CLAUDE.md with analytics route list
refactor(agents): extract apiKey hashing into shared utility
```

Scopes match package/app names: `core`, `agents`, `tasks`, `projects`, `ideas`, `habits`, `analytics`, `notifications`, `shared`, `api`, `cli`, `web`.

---

## Definition of "Done" for Any Task

A task is done when:

- [ ] `pnpm typecheck` passes with zero errors
- [ ] `pnpm lint` passes with zero errors
- [ ] The feature works end-to-end (schema → package → API or CLI)
- [ ] The `events` table receives a row for every mutation
- [ ] No `any` types introduced
- [ ] No secrets committed
- [ ] Commit message follows the format above