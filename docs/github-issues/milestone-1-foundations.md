# Milestone 1: Foundations

## Issue: M1-T1 Fix top-level navigation integrity

- Title: `fix(web): remove dead top-level navigation routes and align sidebar with roadmap`
- Labels:
  - `type:bug`
  - `layer:web`
  - `area:navigation`
  - `milestone:1-foundations`
  - `complexity:s`
  - `status:ready`
- Depends on: none
- Parallel with: `M1-T2`, `M1-T3`

### Description

The current dashboard has at least one confirmed dead route: `/config` is present in the sidebar but no page exists for it. Audit the top-level navigation and ensure every primary item resolves to a real page or is removed. Align the navigation with the target information architecture in the page-structure doc.

This issue is intentionally narrow: do not implement major new pages yet unless needed to eliminate a dead nav item. The expected outcome is route integrity and a cleaner sidebar that matches the current product state or the approved near-term structure.

### Deliverables

- remove or replace `/config` from the sidebar
- verify all top-level nav routes resolve
- update nav labels or icons only if needed for clarity

### Acceptance Criteria

- no top-level sidebar route returns a 404 due to a missing page
- sidebar labels match the actual page structure
- `pnpm typecheck` passes

### References

- [sidebar.tsx](/Users/hichamkazan/Projects/clawops/apps/web/components/sidebar.tsx)
- [openclaw-page-structure.md](/Users/hichamkazan/Projects/clawops/docs/openclaw-page-structure.md)

## Issue: M1-T2 Add persistent OpenClaw connection model

- Title: `feat(sync): persist OpenClaw connections and onboarding state`
- Labels:
  - `type:feature`
  - `layer:core`
  - `layer:sync`
  - `area:openclaw`
  - `area:onboarding`
  - `milestone:1-foundations`
  - `complexity:l`
  - `status:ready`
- Depends on: none
- Parallel with: `M1-T1`, `M1-T3`

### Description

Add a durable OpenClaw connection model so ClawOps no longer relies on in-memory sync state or transient onboarding input. This issue should introduce the schema, migration, and package logic required to create, update, list, and fetch OpenClaw connections. A connection represents a specific OpenClaw installation or gateway endpoint and must hold enough data to support later session sync, cron sync, and file tracking.

Do not build the full UI in this issue. Focus on schema design, package logic, and API primitives that unblock the rest of the roadmap.

### Deliverables

- add `openclaw_connections` schema and migration
- add package functions for create, update, get, list
- add Next.js API routes for upsert and list operations

### Acceptance Criteria

- connection records survive server restarts
- API routes can create and list connections
- connection shape is usable by onboarding and sync flows
- `pnpm typecheck` passes

### References

- [openclaw-schema-and-apis.md](/Users/hichamkazan/Projects/clawops/docs/openclaw-schema-and-apis.md)
- [route.ts](/Users/hichamkazan/Projects/clawops/apps/web/app/api/sync/openclaw/route.ts)
- [sync-state.ts](/Users/hichamkazan/Projects/clawops/apps/web/lib/server/sync-state.ts)

## Issue: M1-T3 Replace in-memory sync status with database-backed sync runs

- Title: `feat(sync): add durable sync runs and retire in-memory sync status`
- Labels:
  - `type:feature`
  - `layer:core`
  - `layer:sync`
  - `area:sync`
  - `milestone:1-foundations`
  - `complexity:l`
  - `status:ready`
- Depends on: none
- Parallel with: `M1-T1`, `M1-T2`

### Description

The current web sync flow stores last sync status in process memory, which breaks durability and prevents historical inspection. Add database-backed sync runs so every sync attempt has a start, completion state, result summary, and error payload when relevant. This issue should include both schema and package support, then update the current sync route handlers to create and update sync run records.

Keep the implementation incremental. It is acceptable to keep the existing sync endpoints temporarily as long as they now write durable run records and stop relying on in-memory state for the core flow.

### Deliverables

- add `sync_runs` and `sync_run_items` schema and migration
- add package helpers to start, update, and finalize a sync run
- update existing sync APIs to use the new persistence layer

### Acceptance Criteria

- every sync request creates a durable sync run record
- failures are recorded with useful error context
- recent sync runs can be fetched through package or API queries
- `apps/web/lib/server/sync-state.ts` is no longer the source of truth

### References

- [openclaw-schema-and-apis.md](/Users/hichamkazan/Projects/clawops/docs/openclaw-schema-and-apis.md)
- [route.ts](/Users/hichamkazan/Projects/clawops/apps/web/app/api/sync/openclaw/route.ts)
- [sync-state.ts](/Users/hichamkazan/Projects/clawops/apps/web/lib/server/sync-state.ts)

## Issue: M1-T4 Unify CLI onboarding and web onboarding

- Title: `refactor(sync): unify CLI and web onboarding on shared OpenClaw onboarding services`
- Labels:
  - `type:refactor`
  - `layer:cli`
  - `layer:web`
  - `layer:sync`
  - `area:onboarding`
  - `milestone:1-foundations`
  - `complexity:l`
  - `status:blocked`
- Depends on: `M1-T2`, `M1-T3`
- Parallel with: none

### Description

The CLI onboarding path performs more real work than the web onboarding path today. Unify them behind shared package-level onboarding services so they both persist connections, discover agents, register or update ClawOps agent records, and emit the same durable events. The user experience can stay different between CLI and web, but the underlying workflow should be the same.

Be careful not to duplicate business logic between app layers. The goal is one onboarding contract consumed by two surfaces.

### Deliverables

- shared onboarding service in `packages/sync`
- updated CLI onboarding to use shared service
- updated web onboarding API to use shared service

### Acceptance Criteria

- CLI and web onboarding produce the same durable side effects
- both flows persist connection data
- both flows register or update discovered agents consistently
- `pnpm typecheck` passes

### References

- [onboard.ts](/Users/hichamkazan/Projects/clawops/apps/cli/src/commands/onboard.ts)
- [connect-wizard.tsx](/Users/hichamkazan/Projects/clawops/apps/web/components/onboarding/connect-wizard.tsx)
- [openclaw-product-decisions.md](/Users/hichamkazan/Projects/clawops/docs/openclaw-product-decisions.md)

## Issue: M1-T5 Add durable OpenClaw identity mapping for agents

- Title: `feat(agents): add durable OpenClaw identity mapping and stop matching on name alone`
- Labels:
  - `type:feature`
  - `layer:agents`
  - `layer:sync`
  - `layer:core`
  - `area:agents`
  - `area:openclaw`
  - `milestone:1-foundations`
  - `complexity:l`
  - `status:blocked`
- Depends on: `M1-T2`
- Parallel with: none

### Description

Replace the weak `name + framework` matching approach with a durable OpenClaw identity mapping layer. ClawOps needs a stable way to associate a discovered OpenClaw agent with an existing ClawOps agent record across repeated syncs, renames, and workspace changes.

This issue should add the schema, package logic, and onboarding/sync integration needed to treat OpenClaw external IDs as first-class identifiers. Make sure the design supports later session and workspace tracking.

### Deliverables

- add `openclaw_agents` or equivalent mapping table
- add upsert and lookup logic in package code
- update onboarding and sync code to use durable mappings

### Acceptance Criteria

- repeated sync does not create duplicate agents when OpenClaw names or display labels change
- package logic can fetch a ClawOps agent by OpenClaw external identity
- onboarding uses durable mappings instead of `name + framework` matching alone

### References

- [index.ts](/Users/hichamkazan/Projects/clawops/packages/agents/src/index.ts)
- [scanner.ts](/Users/hichamkazan/Projects/clawops/packages/sync/src/openclaw/scanner.ts)
- [openclaw-schema-and-apis.md](/Users/hichamkazan/Projects/clawops/docs/openclaw-schema-and-apis.md)
