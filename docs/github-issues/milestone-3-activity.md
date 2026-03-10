# Milestone 3: Activity

## Issue: M3-T1 Add rich activity event model

- Title: `feat(core): add structured activity events for feed, audit, and observability`
- Labels:
  - `type:feature`
  - `layer:core`
  - `layer:cross-cutting`
  - `area:activity`
  - `milestone:3-activity`
  - `complexity:l`
  - `status:ready`
- Depends on: none
- Parallel with: `M3-T3`

### Description

Add a structured `activity_events` model that can support a real operator-facing activity center. The existing low-level `events` table should remain for audit continuity, but it is too generic for a rich feed. Introduce a new schema and package helper layer for writing and querying activity events with source, severity, title, body, entity references, and metadata.

The goal is to create a reusable foundation that later sync, workflow, and mutation flows can publish into.

### Deliverables

- `activity_events` schema and migration
- package helper functions for insert and query
- query filters by type, agent, entity, and severity

### Acceptance Criteria

- activity events can be persisted and retrieved with filters
- existing code can adopt the helper layer incrementally
- `pnpm typecheck` passes

### References

- [openclaw-schema-and-apis.md](/Users/hichamkazan/Projects/clawops/docs/openclaw-schema-and-apis.md)
- [openclaw-product-decisions.md](/Users/hichamkazan/Projects/clawops/docs/openclaw-product-decisions.md)

## Issue: M3-T2 Normalize product actions into activity events

- Title: `refactor(cross-cutting): emit rich activity events for sync, task, idea, project, and cron actions`
- Labels:
  - `type:refactor`
  - `layer:cross-cutting`
  - `layer:web`
  - `layer:cli`
  - `area:activity`
  - `milestone:3-activity`
  - `complexity:xl`
  - `status:blocked`
- Depends on: `M3-T1`
- Parallel with: can be split later by domain

### Description

Update key application and CLI mutation flows so they emit structured `activity_events` in addition to low-level `events`. Start with the highest-signal domains:

- sync runs
- tasks
- ideas
- projects
- cron jobs

Use a shared helper to avoid duplicating event-construction logic. The resulting event payloads should be rich enough for the future Activity page and agent/project detail panels.

### Deliverables

- shared event helper usage across major routes and commands
- activity emission for core mutations and sync operations
- consistent activity metadata schema

### Acceptance Criteria

- major actions appear in activity queries with useful titles and metadata
- low-level `events` logging is preserved
- implementation is consistent across API and CLI entrypoints

### References

- [apps/web/app/api/tasks/route.ts](/Users/hichamkazan/Projects/clawops/apps/web/app/api/tasks/route.ts)
- [apps/web/app/api/projects/route.ts](/Users/hichamkazan/Projects/clawops/apps/web/app/api/projects/route.ts)
- [openclaw-implementation-roadmap.md](/Users/hichamkazan/Projects/clawops/docs/openclaw-implementation-roadmap.md)

## Issue: M3-T3 Add Activity page and feed components

- Title: `feat(web): add Activity page with filterable feed and event detail`
- Labels:
  - `type:feature`
  - `layer:web`
  - `area:activity`
  - `milestone:3-activity`
  - `complexity:m`
  - `status:blocked`
- Depends on: `M1-T1`, `M3-T1`, `M3-T2`
- Parallel with: UI shell can begin after event query contract exists

### Description

Create the new top-level Activity page. This page should be the central place for operators to inspect what agents are doing, what changed recently, and what needs attention. Implement an initial filterable feed with event detail support. Keep the UI intentionally simple but reusable so it can later power embedded activity panels in other pages.

### Deliverables

- `app/activity/page.tsx`
- activity feed component
- basic filters for agent, type, severity, and entity
- event detail surface

### Acceptance Criteria

- Activity is a first-class route
- feed is driven by `activity_events`
- operator can filter and inspect event details

### References

- [openclaw-page-structure.md](/Users/hichamkazan/Projects/clawops/docs/openclaw-page-structure.md)

## Issue: M3-T4 Add agent communication observability

- Title: `feat(sync): capture agent-to-agent message observability records`
- Labels:
  - `type:feature`
  - `layer:sync`
  - `layer:core`
  - `area:messaging`
  - `area:activity`
  - `milestone:3-activity`
  - `complexity:l`
  - `status:blocked`
- Depends on: `M3-T1`, `M6-T1`
- Parallel with: none

### Description

Add an initial observability layer for agent-to-agent communication. The goal is not to build a full chat product, but to capture messages or handoff-like events where OpenClaw exposes them and make them visible in activity and agent detail views. Introduce a dedicated schema and ingestion path for structured message records.

### Deliverables

- `agent_messages` schema and migration
- sync or event-ingestion normalization into message records
- list/query package helpers

### Acceptance Criteria

- message-like records can be stored with sender, receiver, channel, and content summary
- messages can later be rendered in agent and activity views without schema changes

### References

- [openclaw-product-decisions.md](/Users/hichamkazan/Projects/clawops/docs/openclaw-product-decisions.md)

