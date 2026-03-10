# Milestone 2: Runtime Mirror

## Issue: M2-T1 Add session sync and session history

- Title: `feat(sync): ingest OpenClaw sessions and preserve session history`
- Labels:
  - `type:feature`
  - `layer:sync`
  - `layer:core`
  - `layer:agents`
  - `area:openclaw`
  - `area:sync`
  - `milestone:2-runtime-mirror`
  - `complexity:l`
  - `status:blocked`
- Depends on: `M1-T2`, `M1-T5`
- Parallel with: `M2-T2`, `M2-T3`

### Description

Add durable session ingestion so ClawOps can reflect current and historical OpenClaw runtime state. This issue should create the session schema, package sync logic, and API surface needed to fetch active session data from OpenClaw and store it with enough context for agent pages, activity feeds, and future workflow triggers.

Treat sessions as operational records, not only temporary feed items. Preserve start and end state where possible.

### Deliverables

- `openclaw_sessions` schema and migration
- session sync functions in `packages/sync`
- session listing API
- CLI command to inspect sessions

### Acceptance Criteria

- active sessions can be synced from the gateway
- ended sessions remain queryable as historical records
- agent pages can later consume this data without schema changes

### References

- [gateway.ts](/Users/hichamkazan/Projects/clawops/packages/sync/src/openclaw/gateway.ts)
- [openclaw-schema-and-apis.md](/Users/hichamkazan/Projects/clawops/docs/openclaw-schema-and-apis.md)

## Issue: M2-T2 Evolve habits into cron-focused runtime management

- Title: `feat(habits): evolve habits into OpenClaw cron job management foundation`
- Labels:
  - `type:feature`
  - `layer:habits`
  - `layer:sync`
  - `layer:core`
  - `area:cron`
  - `area:openclaw`
  - `milestone:2-runtime-mirror`
  - `complexity:l`
  - `status:blocked`
- Depends on: `M1-T2`, `M1-T5`
- Parallel with: `M2-T1`, `M2-T3`

### Description

Clarify and evolve the current habits model so it becomes a proper cron-job management foundation for OpenClaw. The product language should move toward cron jobs and recurring automation, while the code can migrate incrementally. Add external identity fields, durable sync support, and API/CLI primitives for listing and updating cron jobs.

Do not attempt the full cron editor UI in this issue. Focus on the backend contract and mutation surface that later UI work will rely on.

### Deliverables

- schema evolution for cron identity and metadata
- package logic to list, create, and update cron jobs
- Next.js routes for cron list/create/update
- CLI parity

### Acceptance Criteria

- ClawOps can store and reconcile OpenClaw cron jobs
- operator-facing API can list and update cron definitions
- existing habits logic remains compatible or is migrated with clear compatibility handling

### References

- [apps/cli/src/commands/habit.ts](/Users/hichamkazan/Projects/clawops/apps/cli/src/commands/habit.ts)
- [packages/habits/src/index.ts](/Users/hichamkazan/Projects/clawops/packages/habits/src/index.ts)
- [openclaw-product-decisions.md](/Users/hichamkazan/Projects/clawops/docs/openclaw-product-decisions.md)

## Issue: M2-T3 Add workspace tracking and tracked file catalog

- Title: `feat(sync): add tracked workspace file catalog for OpenClaw workspaces`
- Labels:
  - `type:feature`
  - `layer:sync`
  - `layer:core`
  - `area:files`
  - `area:openclaw`
  - `milestone:2-runtime-mirror`
  - `complexity:l`
  - `status:blocked`
- Depends on: `M1-T2`, `M1-T5`
- Parallel with: `M2-T1`, `M2-T2`

### Description

Introduce a tracked file catalog for OpenClaw workspaces so ClawOps can know which files exist, which ones are being watched, and which changed since the last sync. This is the prerequisite for file history, file activity, memory visibility, and later revert support.

Start with metadata and hash tracking. Do not store full file revisions yet in this issue.

### Deliverables

- `workspace_files` schema and migration
- package logic to upsert tracked file metadata and hashes
- API route to list tracked files by connection or workspace

### Acceptance Criteria

- tracked files are persisted with stable IDs
- repeated sync can detect file hash changes
- file catalog can be queried by workspace

### References

- [scanner.ts](/Users/hichamkazan/Projects/clawops/packages/sync/src/openclaw/scanner.ts)
- [openclaw-schema-and-apis.md](/Users/hichamkazan/Projects/clawops/docs/openclaw-schema-and-apis.md)

## Issue: M2-T4 Add workspace file revision history with Git metadata

- Title: `feat(sync): capture workspace file revisions and Git context`
- Labels:
  - `type:feature`
  - `layer:sync`
  - `layer:core`
  - `area:files`
  - `milestone:2-runtime-mirror`
  - `complexity:l`
  - `status:blocked`
- Depends on: `M2-T3`
- Parallel with: `M2-T5`

### Description

Capture file revision history for tracked workspace files. Each captured revision should include enough information to support diff views, activity feeds, and future revert workflows. Where the workspace is inside a Git repository, also record branch and commit metadata so ClawOps can correlate file history with Git history.

Prefer incremental, bounded storage rather than indiscriminate filesystem mirroring.

### Deliverables

- `workspace_file_revisions` schema and migration
- package logic to create revisions on change
- Git metadata capture when available
- API surface for file revision history

### Acceptance Criteria

- tracked file changes create revision records
- revision records can include Git commit SHA and branch when discoverable
- history API returns revisions in a stable order

### References

- [openclaw-product-decisions.md](/Users/hichamkazan/Projects/clawops/docs/openclaw-product-decisions.md)
- [openclaw-schema-and-apis.md](/Users/hichamkazan/Projects/clawops/docs/openclaw-schema-and-apis.md)

## Issue: M2-T5 Add OpenClaw page foundation

- Title: `feat(web): add top-level OpenClaw page with connection, sync, session, cron, and file panels`
- Labels:
  - `type:feature`
  - `layer:web`
  - `area:openclaw`
  - `milestone:2-runtime-mirror`
  - `complexity:m`
  - `status:blocked`
- Depends on: `M1-T1`, `M1-T2`, `M1-T3`
- Parallel with: can start with mocked contracts before backend completion

### Description

Create the first dedicated OpenClaw page in the web app. This page is the operator-facing home for the integration and should expose connection health, recent sync runs, current sessions, cron jobs, and tracked workspace files. The page can start with simple panels and progressively improve once deeper backend features land.

The focus is page structure and data plumbing, not full visual polish.

### Deliverables

- `app/openclaw/page.tsx` and supporting components
- connection status panel
- sync run list panel
- sessions panel
- cron jobs panel
- tracked files panel

### Acceptance Criteria

- OpenClaw is a real top-level destination
- operator can inspect integration state from the dashboard
- no direct package imports are added in violation of the intended API direction unless explicitly transitional and documented

### References

- [openclaw-page-structure.md](/Users/hichamkazan/Projects/clawops/docs/openclaw-page-structure.md)
- [openclaw-implementation-roadmap.md](/Users/hichamkazan/Projects/clawops/docs/openclaw-implementation-roadmap.md)
