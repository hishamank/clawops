# ClawOps — Copilot Code Review Instructions

## Project Overview

ClawOps is an open source **operations layer for AI agent teams**. It gives AI agents a structured way to register themselves, track tasks and projects, log habits and heartbeats, capture ideas, and report token usage and costs — all through Next route handlers, a CLI, and a web dashboard.

Target users: developers running multi-agent AI systems who need observability and coordination tooling. Think of it as a project management system where the "users" are AI agents.

---

## Tech Stack

### Monorepo
- **Turborepo** + **pnpm workspaces** — all packages managed together
- **TypeScript** strict mode throughout — no exceptions

### Backend (`apps/web/app/api`)
- **Next.js Route Handlers** — HTTP transport
- **Zod** — input validation on every route

### Database
- **SQLite** via **better-sqlite3** — synchronous driver (no async/await in DB calls)
- **Drizzle ORM** — all queries go through Drizzle; no raw SQL except aggregations in `packages/analytics` and migration files in `packages/core/src/migrate.ts`
- Schema lives in `packages/core/src/schema.ts` — 11 tables: agents, habits, habitRuns, projects, milestones, tasks, artifacts, ideas, usageLogs, events, notifications

### CLI (`apps/cli`)
- **Commander.js** — all commands support `--json` flag

### Web (`apps/web`)
- **Next.js** — app router
- **shadcn/ui** + **Tailwind CSS** — UI components
- **Recharts** — charts only (no other chart libraries)
- **No `useEffect` for data fetching** — use RSCs or a data fetching library

### Shared packages
- `@clawops/domain` — shared types, constants, model pricing, utils
- `@clawops/core` — Drizzle schema + DB connection
- `@clawops/agents`, `@clawops/tasks`, `@clawops/projects`, etc. — business logic per domain

### Testing
- **Node test runner (`node:test`)** is the default in this repo
- Prefer in-memory SQLite (`:memory:`) for DB-facing package tests
- If a package exports runtime helpers, tests should import the built module and exercise those real exports

---

## Coding Guidelines

### TypeScript
- No `any` types — use `unknown` and narrow, or infer from Drizzle schema
- All exported functions must have explicit return types
- Use `import type` for type-only imports
- No unused variables or imports — prefix intentionally unused with `_`
- `prefer-const` always

### Database
- **Synchronous only** — better-sqlite3 is sync; never use `async/await` in `packages/*`
- **Drizzle ORM only** — no raw SQL outside: `packages/analytics` aggregations, `packages/core/src/migrate.ts`, or Drizzle `sql`...`` template expressions in schema column defaults
- **Transactions required** for any function that performs 2+ DB writes — use `db.transaction()`
- **Handle 0-row returns** — `.returning().all()` can return empty; always check and throw a typed not-found error
- Never expose raw API keys — store hashed, return plaintext only at creation time

### Architecture
- `packages/*` must never import from `apps/*`
- No circular dependencies between packages
- Shared constants/types must come from `@clawops/domain` — never duplicate local string unions
- Validate `@clawops/domain` is actually imported before adding it to `package.json`
- `writeEvent()` and similar helpers must accept a DB/transaction handle — never close over a global `db`
- If a feature introduces a fixed set of valid keys or sections, define and reuse one shared constant/type across package, API, and CLI layers; do not leave runtime validation to TypeScript-only annotations
- Schema ownership is strict: all Drizzle tables, inferred row types, and migrations belong in `packages/core`; feature packages may consume schema from `@clawops/core` but must not declare new tables locally
- Exported validator/input contracts must match each other: if an update type is partial, the validator for that update path must also accept partial payloads and must not require create-only fields

### API (`apps/web/app/api`)
- Every route: Zod input validation
- Validate route params at runtime too, not just request bodies
- Every mutation: writes an `events` row, wrapped in a transaction with the main write
- Auth guard protects all routes — only `/api/health` and `/api/auth/login` are public (explicitly check `x-api-key`)
- Proper HTTP status codes: 404 for missing entities, 409 for conflicts, 400 for validation errors

### CLI (`apps/cli`)
- Every command supports `--json` flag
- Every command writes an `events` row
- `clawops agent init` must be idempotent

---

## Project Structure

```
clawops/
├── apps/
│   ├── cli/          # Commander.js CLI
│   └── web/          # Next.js dashboard + route handlers
├── packages/
│   ├── core/         # Drizzle schema + DB connection (source of truth)
│   ├── domain/       # Shared types, constants, model pricing, utils
│   ├── agents/       # Agent business logic
│   ├── tasks/        # Task business logic
│   ├── projects/     # Project + milestone logic
│   ├── ideas/        # Idea business logic
│   ├── habits/       # Habit + heartbeat logic
│   ├── notifications/# Notification logic
│   ├── analytics/    # Token/cost tracking
│   └── web/          # (placeholder package)
├── turbo.json        # Turborepo pipeline
├── tsconfig.base.json
└── eslint.config.mjs
```

**Key rule:** Changes to `packages/core/src/schema.ts` are high-risk — flag any destructive column removal or type change. Changes to `packages/domain/src/` affect every other package — flag breaking exports.

---

## What to Flag

### Errors (block merge)
- Missing `db.transaction()` on any function that does 2+ DB writes
- `.returning().all()[0]` without a not-found check (silent `undefined`)
- Read helpers that collapse "row missing" and "field unset" into the same return value when routes need to distinguish `404` from an empty resource
- `any` type introduced
- Exported function missing return type
- Raw SQL outside `packages/analytics` or migration files
- `packages/*` importing from `apps/*`
- Raw API key returned in a GET/list response
- `writeEvent()` or similar closing over global `db` instead of accepting a handle
- Package listed in `package.json` with no actual imports in source
- Local string union that duplicates a type already in `@clawops/domain`
- Structured models implemented with open-ended index signatures or unvalidated dynamic route segments that allow arbitrary keys beyond the approved contract
- New package behavior with no executable coverage in that package's `test` script
- New helper/type described in the PR or issue exists in source but is not re-exported from the package entrypoint
- A package adds new behavior but its `test` script is still a no-op
- A normalizer silently drops malformed structured data instead of preserving it or rejecting it
- New Drizzle schema or inferred row types declared outside `packages/core`
- Package contract claims “types/interfaces only” but introduces persistence schema or migration responsibilities
- Validator logic that rejects valid shapes promised by exported input/update types
- Schema changes in `packages/core/src/schema.ts` without a matching forward-only migration in `packages/core/migrations`
- Runtime bootstrap/seed helpers that are never wired into a real initialization or migration path while the PR claims built-in data will exist
- Unrelated schema changes bundled into a feature PR without being required for the issue being implemented
- Missing auth guard on any `/api/*` route other than `/api/health` and `/api/auth/login`
- Using `getAgentIdFromApiKey` as an auth guard instead of `requireAgentId` on `/api/*` routes
- Foreign key references without `{ onDelete: "cascade" }` when the child entity should be deleted with its parent (e.g., sessions should cascade when connection is deleted)

### Warnings (recommend fix)
- Non-null assertion (`!`) without an explanatory comment
- `console.log` in production code (use structured logging)
- Async function in a `packages/*` file (should be sync)
- Error handling via `err.message` string matching — prefer typed errors or error codes
- OpenClaw cron job updates that accept a schedule patch but fail to persist a normalized local schedule/scheduleKind/scheduleExpr (e.g., when the gateway returns `204 No Content`)
- Missing 404/409 HTTP status codes on routes that can fail with known reasons
- Tests that only mock or reimplement behavior without covering the real exported helper or route contract that changed
- Tests that validate a reimplementation of production logic instead of the actual exported module
- Activity event emissions that omit `agentId` or hardcode `source` when `x-api-key` is present
- New exported functions (especially sync, upsert, or list operations) without corresponding test coverage
- Complex parsing/normalization functions without test coverage for edge cases and various input formats
- Promise.resolve() wrapper around synchronous database calls (better-sqlite3 is sync)

### Do NOT flag
- Drizzle ORM's complex generic types in function signatures — expected
- `pnpm-lock.yaml` changes — auto-generated
- `dist/` output files
- `node:test` `describe`/`it`/`beforeEach` boilerplate
- Schema tables or types imported from `@clawops/core` — verify the import exists rather than claiming the definition is missing
