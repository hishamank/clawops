# ClawOps — Copilot Code Review Instructions

## Project Overview

ClawOps is an open source **operations layer for AI agent teams**. It gives AI agents a structured way to register themselves, track tasks and projects, log habits and heartbeats, capture ideas, and report token usage and costs — all through a REST API, a CLI, and a web dashboard.

Target users: developers running multi-agent AI systems who need observability and coordination tooling. Think of it as a project management system where the "users" are AI agents.

---

## Tech Stack

### Monorepo
- **Turborepo** + **pnpm workspaces** — all packages managed together
- **TypeScript** strict mode throughout — no exceptions

### Backend (`apps/api`)
- **Fastify** — HTTP server
- **@fastify/swagger** + **@fastify/swagger-ui** — all routes must be documented
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

### Shared packages
- `@clawops/domain` — shared types, constants, model pricing, utils
- `@clawops/core` — Drizzle schema + DB connection
- `@clawops/agents`, `@clawops/tasks`, `@clawops/projects`, etc. — business logic per domain

### Testing
- **Vitest** — unit tests for all `packages/*`
- In-memory SQLite (`:memory:`) for DB tests — no mocking the DB

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

### API (`apps/api`)
- Every route: Zod input validation + Swagger schema defined
- Every mutation: writes an `events` row, wrapped in a transaction with the main write
- Auth middleware protects all routes — only `/health` is public (not `/docs`)
- Normalize `req.url` to pathname before auth checks: `req.url.split('?')[0]`
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
│   ├── api/          # Fastify REST API
│   ├── cli/          # Commander.js CLI
│   └── web/          # Next.js dashboard
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
- `any` type introduced
- Exported function missing return type
- Raw SQL outside `packages/analytics` or migration files
- `packages/*` importing from `apps/*`
- Raw API key returned in a GET/list response
- `writeEvent()` or similar closing over global `db` instead of accepting a handle
- Package listed in `package.json` with no actual imports in source
- Local string union that duplicates a type already in `@clawops/domain`

### Warnings (recommend fix)
- Non-null assertion (`!`) without an explanatory comment
- `console.log` in production code (use structured logging)
- Async function in a `packages/*` file (should be sync)
- Error handling via `err.message` string matching — prefer typed errors or error codes
- Missing 404/409 HTTP status codes on routes that can fail with known reasons

### Do NOT flag
- Drizzle ORM's complex generic types in function signatures — expected
- `pnpm-lock.yaml` changes — auto-generated
- `dist/` output files
- Vitest `describe`/`it`/`beforeEach` test boilerplate
