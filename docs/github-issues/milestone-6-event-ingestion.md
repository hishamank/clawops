# Milestone 6: Event Ingestion

## Issue: M6-T1 Add inbound OpenClaw event ingestion route

- Title: `feat(sync): add inbound OpenClaw event ingestion API`
- Labels:
  - `type:feature`
  - `layer:sync`
  - `layer:web`
  - `area:openclaw`
  - `area:sync`
  - `milestone:6-event-ingestion`
  - `complexity:l`
  - `status:blocked`
- Depends on: `M1-T2`, `M3-T1`
- Parallel with: `M6-T2`

### Description

Implement a secure Next.js API route for receiving OpenClaw hook or plugin events. The route should validate inbound payloads, normalize them into internal event types, write activity records, and update relevant local state where appropriate. Keep the normalization layer explicit so it can later trigger workflows and support multiple inbound event categories.

### Deliverables

- inbound event route under `/api/integrations/openclaw/events`
- payload validation and authentication strategy
- normalization layer for internal handling

### Acceptance Criteria

- a supported OpenClaw event can be received and stored as a meaningful internal record
- invalid payloads are rejected safely
- activity records are written for supported events

### References

- [openclaw-product-decisions.md](/Users/hichamkazan/Projects/clawops/docs/openclaw-product-decisions.md)
- [openclaw-schema-and-apis.md](/Users/hichamkazan/Projects/clawops/docs/openclaw-schema-and-apis.md)

## Issue: M6-T2 Add outbound OpenClaw action layer

- Title: `feat(sync): add outbound OpenClaw action APIs for cron, files, and trigger calls`
- Labels:
  - `type:feature`
  - `layer:sync`
  - `layer:web`
  - `layer:cli`
  - `area:openclaw`
  - `milestone:6-event-ingestion`
  - `complexity:l`
  - `status:blocked`
- Depends on: `M1-T2`
- Parallel with: `M6-T1`

### Description

Add the ClawOps-to-OpenClaw action layer. This should include package helpers and Next.js APIs for performing controlled outbound actions such as updating a cron job, writing a tracked file, or triggering a supported OpenClaw action endpoint. Design the layer so it can later be called by workflows and operator UI surfaces.

### Deliverables

- package helpers for outbound calls
- Next.js route handlers for selected actions
- CLI parity for at least one supported action category

### Acceptance Criteria

- at least one write action works end-to-end against the OpenClaw integration
- outbound actions are audited through low-level events and activity events
- action failures are surfaced cleanly

### References

- [openclaw-schema-and-apis.md](/Users/hichamkazan/Projects/clawops/docs/openclaw-schema-and-apis.md)

## Issue: M6-T3 Add periodic reconciliation runner contract

- Title: `feat(sync): add idempotent reconciliation runner API for scheduled sync`
- Labels:
  - `type:feature`
  - `layer:sync`
  - `layer:web`
  - `area:sync`
  - `milestone:6-event-ingestion`
  - `complexity:m`
  - `status:blocked`
- Depends on: `M1-T3`, `M2-T1`, `M2-T2`, `M2-T3`
- Parallel with: none

### Description

Add an idempotent reconciliation entrypoint that can be triggered by external schedulers or OpenClaw cron jobs. This route should coordinate the lower-level sync modules for sessions, cron jobs, file catalog updates, and other runtime state while writing a durable sync run record.

The route should be safe to call repeatedly and should support scoped reconciliation modes.

### Deliverables

- reconcile API route
- support for mode-based reconcile runs
- durable sync run integration

### Acceptance Criteria

- repeated calls do not corrupt state
- reconcile execution writes a sync run record
- scoped reconcile modes are supported

### References

- [openclaw-implementation-roadmap.md](/Users/hichamkazan/Projects/clawops/docs/openclaw-implementation-roadmap.md)

