# ClawOps — Copilot Code Review Instructions

ClawOps is a TypeScript monorepo (Turborepo + pnpm) — an operations layer for AI agent teams.
Stack: Fastify API · Next.js web · Commander.js CLI · Drizzle ORM · SQLite (better-sqlite3, sync API).

---

## Core Rules (flag any violation as an error)

### TypeScript
- No `any` types — use `unknown` and narrow, or infer from Drizzle schema
- All exported functions must have explicit return types
- Use `import type` for type-only imports (`consistent-type-imports`)
- No unused variables or imports
- Prefer `const` over `let` where value is never reassigned

### Database
- All DB access via Drizzle ORM — no raw SQL outside `packages/core/src/migrate.ts`
- better-sqlite3 is **synchronous** — no `async/await` in `packages/*` business logic
- Multi-step writes (insert + update, insert + insert) must be wrapped in `db.transaction()`
- Always handle the 0-row case on `.returning()` — throw a typed not-found error, never silently return `undefined`
- Never expose raw API keys — store hashed, return plaintext only at creation

### Architecture
- `packages/*` must never import from `apps/*`
- No circular dependencies between packages
- Shared types/constants must come from `@clawops/domain` — never duplicate local string unions that already exist there
- `@clawops/domain` in package.json must be justified by actual imports — flag unused dependencies

### API (apps/api)
- Every route must have Zod input validation
- Every route must have a Swagger schema defined
- Every mutation must write an `events` row
- All routes protected by API key middleware (except `/health`, `/auth/*`)

### CLI (apps/cli)
- Every command must support `--json` flag
- Every command must write an `events` row
- `clawops agent init` must be idempotent

---

## What to Flag

**Errors (block merge):**
- Missing transaction on multi-step writes
- 0-row `.returning()` not handled (silent undefined)
- `any` type introduced
- Exported function missing return type
- Raw SQL outside migration files
- Circular package imports (`packages/*` → `apps/*`)
- API key returned in plaintext
- Unused dependency in package.json that has no imports

**Warnings (recommend fix):**
- Non-null assertion (`!`) without a comment explaining why it's safe
- Local string union duplicating a type from `@clawops/domain`
- Missing not-found guard on single-row lookups
- `console.log` in production code (use structured logging)
- Async function in a package that should be synchronous

---

## What NOT to Flag
- Drizzle ORM's complex generic types in function signatures — these are expected
- `pnpm-lock.yaml` changes — auto-generated, don't review
- `dist/` output files
- Test helper boilerplate (describe/it/beforeEach setup)

---

## Path-Specific Notes

- `packages/core/src/schema.ts` — schema changes are high-risk; flag any destructive column removals or type changes
- `packages/domain/src/` — exported constants/types are imported everywhere; flag breaking changes
- `apps/api/src/` — flag any route missing Zod validation or Swagger schema
- `apps/cli/src/` — flag any command missing `--json` flag
