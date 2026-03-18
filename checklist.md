# ClawOps Working Checklist

Use this as a quick guardrail before and during changes in this repo.

## Before Coding

- Read [claude.md](./claude.md), [agents.md](./agents.md), and the exact files you plan to touch.
- Run `pnpm typecheck` and treat that result as the baseline.
- Check whether the type, utility, helper, or schema already exists before creating a new one.
- Read the relevant package or app code before assuming the intended pattern.

## Architecture Rules

- Put business logic in `packages/*`, not `apps/*`.
- `apps/*` may import from `packages/*`; `packages/*` must never import from `apps/*`.
- Avoid circular dependencies between packages.
- Keep package code testable and prefer passing `db` into package functions rather than importing it directly when possible.

## TypeScript Rules

- No `any`; use `unknown` and narrow safely.
- Exported functions must have explicit return types.
- Use Drizzle-inferred types such as `typeof table.$inferSelect` and `typeof table.$inferInsert`.
- If `pnpm typecheck` was clean before the change, it must stay clean after the change.

## Database Rules

- Use Drizzle only for DB access outside migrations.
- Use `crypto.randomUUID()` for IDs.
- Never edit existing migration files; add a new migration instead.
- Use shared helpers for JSON-backed fields rather than inline `JSON.parse` / `JSON.stringify`.
- Keep timestamps in the project's integer timestamp format.

## API Rules

- Validate all inputs with Zod.
- Add explicit response typing where applicable.
- Require auth on all routes except the documented public ones.
- Return structured errors like `{ error: string, code: string }`.
- Every mutation must write an `events` row after the DB operation.

## CLI Rules

- Every command must support `--json`.
- Keep default stdout minimal.
- Never prompt interactively.
- Keep `clawops agent init` idempotent.
- Every command execution must write an `events` row.

## Web UI Rules

- Read [apps/web/DESIGN_GUIDE.md](./apps/web/DESIGN_GUIDE.md) before UI changes.
- Use shadcn/ui components and Tailwind utility classes only.
- Include loading and error states for data-fetching UI.
- Avoid `useEffect` for data fetching; prefer server components or the approved fetching pattern.
- Follow the explicit design palette and component conventions from the design guide.
- Treat API-based fetching as the intended direction for web features.

## Feature Workflow

1. Update schema if needed.
2. Implement business logic in the relevant `packages/*` library.
3. Add or update the API route.
4. Add or update the CLI command if applicable.
5. Build or update the web UI.

## Ask For Approval Before

- Adding a dependency.
- Adding a new environment variable.
- Changing auth behavior.
- Dropping or renaming schema columns.
- Adding a new top-level app or package.
- Building something outside the documented v0.1 scope.

## Never Do

- Commit `.env` files.
- Commit SQLite DB files or WAL/shm artifacts.
- Store API keys or secrets in plaintext.
- Import `apps/*` from `packages/*`.
- Use `@ts-ignore` or `@ts-expect-error` without a precise explanation.
- Build features explicitly listed as out of scope in [claude.md](./claude.md).
