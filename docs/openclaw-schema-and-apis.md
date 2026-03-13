# Planned Schema and API Changes

## Summary

This document captures the planned backend evolution required to support the OpenClaw-first control plane.

It covers:

- schema changes
- package changes
- API changes
- CLI changes
- integration contracts

The target is incremental evolution from the current repo, not a full rewrite.

## Guiding Constraints

- Keep Next.js route handlers as the product API surface.
- Keep business logic in `packages/*`.
- Keep CLI parity for core operations.
- Prefer additive schema changes.
- Avoid renaming or dropping columns until a migration and compatibility plan exists.

## Current Gaps

The current schema is missing first-class concepts for:

- OpenClaw connections and identity mapping
- sync runs and reconciliation
- workspace file history
- task templates and stage configuration
- task dependencies and blockers
- normalized external links
- workflow definitions and workflow runs
- agent communication visibility
- richer activity history beyond generic events

## Schema Plan

## 1. Agent and OpenClaw Identity

### Existing Tables

- `agents`

### Problems

- agent matching is currently based on name plus framework
- there is no durable external identity
- one agent can have multiple relevant OpenClaw entities across workspace, session, and gateway presence

### New Tables

#### `openclaw_connections`

Represents a connected OpenClaw installation or gateway.

Suggested fields:

- `id`
- `name`
- `rootPath`
- `gatewayUrl`
- `gatewayTokenRef` or secure token storage strategy
- `status`
- `lastSyncedAt`
- `syncMode`
- `createdAt`
- `updatedAt`

#### `openclaw_agents`

Represents OpenClaw-side agent identity and its mapping to ClawOps `agents`.

Suggested fields:

- `id`
- `connectionId`
- `agentIdExternal`
- `agentNameExternal`
- `workspacePath`
- `memoryPath`
- `defaultModel`
- `role`
- `avatar`
- `linkedAgentId`
- `lastSeenAt`
- `createdAt`
- `updatedAt`

Implementation note:

- use `(connectionId, externalAgentId)` as the canonical durable identity
- onboarding and sync should upsert this mapping on every discovery pass
- only fall back to a single `name + framework` match when linking legacy pre-mapping agents

### Changes to `agents`

Add optional fields:

- `primaryConnectionId`
- `primaryExternalId`
- `lastSyncedAt`

These fields are convenience references. The canonical integration mapping should live in `openclaw_agents`.

## 2. Sessions and Cron Jobs

### New Tables

#### `openclaw_sessions`

Tracks current and historical session presence.

Suggested fields:

- `id`
- `connectionId`
- `agentId`
- `externalSessionKey`
- `channel`
- `status`
- `model`
- `startedAt`
- `endedAt`
- `lastSeenAt`
- `meta`

#### `cron_jobs`

Represents recurring jobs in product language, even if the current implementation evolves from `habits`.

Suggested fields:

- `id`
- `connectionId`
- `agentId`
- `externalCronId`
- `name`
- `scheduleType`
- `cronExpr`
- `trigger`
- `status`
- `source`
- `lastRunAt`
- `nextRunAt`
- `meta`
- `createdAt`
- `updatedAt`

#### `cron_runs`

Suggested fields:

- `id`
- `cronJobId`
- `agentId`
- `ranAt`
- `success`
- `note`
- `meta`

### Migration Note

The existing `habits` and `habit_runs` tables can either:

- be evolved into `cron_jobs` and `cron_runs`
- or remain temporarily while the UI and API layer are renamed

Preferred long-term direction is product clarity around cron jobs.

## 3. Task System Expansion

### Existing Tables

- `tasks`
- `artifacts`

### Problems

- no task templates
- no stage model
- no freeform custom properties
- no normalized external links
- no dependencies
- no explicit blocker logic

### Changes to `tasks`

Add fields:

- `templateId`
- `stageId` or `stageKey`
- `ideaId`
- `blocked` boolean or computed support field
- `blockedReason`
- `autoPullEligible`
- `properties` JSON text

Keep existing fields:

- title
- description
- status
- priority
- assigneeId
- projectId
- source
- dueDate
- summary

### New Tables

#### `task_templates`

Suggested fields:

- `id`
- `key`
- `name`
- `description`
- `icon`
- `color`
- `isSystem`
- `defaultProperties` JSON
- `createdAt`
- `updatedAt`

#### `task_template_stages`

Suggested fields:

- `id`
- `templateId`
- `key`
- `name`
- `order`
- `doneState`
- `pullEligible`
- `color`
- `createdAt`

#### `task_relations`

Suggested fields:

- `id`
- `fromTaskId`
- `toTaskId`
- `type`
- `createdAt`

Types:

- `blocks`
- `depends-on`
- `related-to`

#### `resource_links`

Suggested fields:

- `id`
- `entityType`
- `entityId`
- `provider`
- `resourceType`
- `label`
- `url`
- `externalId`
- `meta`
- `createdAt`
- `updatedAt`

This table should support tasks first, but should be generic enough for ideas, projects, workflows, or agents later.

## 4. Idea Expansion

### Existing Table

- `ideas`

### Problems

- ideas only store title, description, tags, status
- no incubation sections
- no draft PRD
- no readiness model

### Changes to `ideas`

Add fields:

- `summary`
- `draftPrd`
- `readinessStatus`
- `lastWorkedAt`

### New Tables

#### `idea_sections`

Suggested fields:

- `id`
- `ideaId`
- `sectionKey`
- `title`
- `content`
- `order`
- `updatedAt`

System section keys:

- `brainstorming`
- `research`
- `similar-ideas`
- `draft-prd`
- `readiness`

#### `idea_task_links`

Only add this if direct task linkage through `tasks.ideaId` becomes insufficient for future multi-idea relationships.

For the first iteration, `tasks.ideaId` is enough.

## 5. Activity and Communication

### Existing Tables

- `events`
- `notifications`

### Problems

- events are generic and thin
- difficult to build a rich activity center from current event shape alone
- no structured communication model

### New Tables

#### `activity_events`

Suggested fields:

- `id`
- `connectionId`
- `agentId`
- `sessionId`
- `workflowRunId`
- `source`
- `type`
- `title`
- `body`
- `entityType`
- `entityId`
- `severity`
- `meta`
- `occurredAt`
- `createdAt`

This should become the main feed source. The existing `events` table can remain as lower-level audit infrastructure until convergence.

#### `agent_messages`

Suggested fields:

- `id`
- `connectionId`
- `fromAgentId`
- `toAgentId`
- `sessionId`
- `channel`
- `messageType`
- `summary`
- `content`
- `meta`
- `sentAt`

This starts as observability, not necessarily a full chat product.

## 6. Workspace Files and History

### New Tables

#### `workspace_files`

Suggested fields:

- `id`
- `connectionId`
- `openclawAgentId`
- `path`
- `fileType`
- `tracked`
- `lastSeenHash`
- `lastSeenAt`
- `meta`

#### `workspace_file_revisions`

Suggested fields:

- `id`
- `workspaceFileId`
- `hash`
- `content`
- `diffFromPrevious`
- `gitCommitSha`
- `gitBranch`
- `capturedAt`
- `source`

This table supports:

- change history
- compare views
- targeted revert workflows

## 7. Sync and Reconciliation

### New Tables

#### `sync_runs`

Suggested fields:

- `id`
- `connectionId`
- `syncType`
- `startedAt`
- `completedAt`
- `status`
- `addedCount`
- `updatedCount`
- `removedCount`
- `error`
- `meta`

#### `sync_run_items`

Suggested fields:

- `id`
- `syncRunId`
- `itemType`
- `itemExternalId`
- `changeType`
- `summary`
- `meta`

This makes it easy to drive activity feed entries and debugging UI.

## 8. Workflow Engine

### New Tables

#### `workflow_definitions`

Suggested fields:

- `id`
- `name`
- `description`
- `status`
- `triggerType`
- `triggerConfig`
- `conditionConfig`
- `actionConfig`
- `createdAt`
- `updatedAt`

#### `workflow_runs`

Suggested fields:

- `id`
- `workflowId`
- `triggeredByEventId`
- `status`
- `startedAt`
- `completedAt`
- `error`
- `meta`

#### `workflow_run_steps`

Suggested fields:

- `id`
- `workflowRunId`
- `stepKey`
- `stepType`
- `status`
- `startedAt`
- `completedAt`
- `result`
- `error`

## Package Changes

## Existing Packages to Extend

### `packages/core`

Responsibilities:

- schema additions
- migrations
- shared DB helpers
- JSON helpers for new structured fields

New helpers likely needed:

- `parseJsonObject`
- `toJsonObject`
- safe enum parsing for workflow or link metadata

### `packages/agents`

Add support for:

- linking to OpenClaw identities
- listing by connection
- session-aware status summaries

### `packages/tasks`

Expand to support:

- templates
- stages
- properties
- resource links
- blockers
- dependency queries
- pullable task queries

### `packages/projects`

Expand to support:

- richer task filtering by project
- derived project execution summaries
- dependency-aware project context

### `packages/ideas`

Expand to support:

- structured idea sections
- draft PRD management
- spawning tasks from ideas

### `packages/habits`

Either evolve or replace with cron-focused APIs:

- list cron jobs
- create cron job
- update cron job
- run history
- cron editor support helpers

### `packages/analytics`

Expand to support:

- timeline aggregations
- per-template spend
- per-workflow spend
- richer rollups

### `packages/notifications`

Add richer notification creation paths sourced from:

- workflow failures
- sync failures
- blocked tasks
- approval-required actions

### `packages/sync`

This becomes a major package.

Add modules for:

- connection management
- OpenClaw identity mapping
- session sync
- cron sync
- workspace file tracking
- sync runs
- event ingestion normalization

### New Package Recommendation: `packages/workflows`

Responsibilities:

- workflow definitions
- workflow validation
- workflow execution engine
- workflow run history

This should become the home for product automation logic instead of overloading `sync` or `tasks`.

## API Plan

All routes below should be implemented as Next.js route handlers.

## Integration Routes

### `POST /api/integrations/openclaw`

Create or update an OpenClaw connection.

Responsibilities:

- validate root path and gateway settings
- persist connection config
- optionally trigger initial sync

### `GET /api/integrations/openclaw`

List configured OpenClaw connections and current status.

### `POST /api/integrations/openclaw/:id/sync`

Trigger a sync run.

Modes:

- scan only
- sessions only
- cron only
- files only
- full reconcile

### `GET /api/integrations/openclaw/:id/sync-runs`

List recent sync runs and summaries.

### `POST /api/integrations/openclaw/events`

Receive OpenClaw hook or plugin events.

Responsibilities:

- validate signature or token
- normalize event
- write `activity_events`
- update relevant local state
- optionally trigger workflows

Current implementation notes:

- route: `POST /api/integrations/openclaw/events`
- auth: set `OPENCLAW_EVENTS_SECRET` on the web app, then send either:
  - `x-openclaw-event-token: <secret>`
  - or `x-openclaw-signature: sha256=<hmac of raw body>`
- preferred payload fields:
  - `type`
  - `connectionId`
  - `occurredAt`
  - `agent.externalId` for agent or session events
  - `session.key` for session events
  - `cron.externalId` for cron run events
- currently supported inbound event types:
  - `agent.heartbeat`
  - `session.started`
  - `session.ended`
  - `cron.run.completed`
- current local state effects:
  - heartbeat updates the linked agent status and records a heartbeat run
  - session events upsert `openclaw_sessions`
  - cron run events record a `habit_runs` row for the synced cron job
- every accepted event writes both:
  - low-level `events`
  - richer `activity_events`

### `POST /api/integrations/openclaw/actions/*`

ClawOps-initiated actions back to OpenClaw, such as:

- create cron
- update cron
- write file
- trigger webhook

## Task Routes

### New and Expanded Routes

- `GET /api/tasks`
- `POST /api/tasks`
- `PATCH /api/tasks/:id`
- `POST /api/tasks/:id/complete`
- `POST /api/tasks/:id/links`
- `POST /api/tasks/:id/relations`
- `GET /api/task-templates`
- `POST /api/task-templates`
- `PATCH /api/task-templates/:id`
- `GET /api/tasks/pullable`

`GET /api/tasks/pullable` should return tasks eligible for agent auto-pickup based on:

- lifecycle status
- template rules
- stage rules
- unresolved blockers

## Idea Routes

- `GET /api/ideas`
- `POST /api/ideas`
- `PATCH /api/ideas/:id`
- `GET /api/ideas/:id/sections`
- `PATCH /api/ideas/:id/sections/:sectionKey`
- `POST /api/ideas/:id/tasks`
- `POST /api/ideas/:id/promote`

## Cron Routes

If the product language changes from habits to cron:

- `GET /api/cron-jobs`
- `POST /api/cron-jobs`
- `PATCH /api/cron-jobs/:id`
- `POST /api/cron-jobs/:id/run`

Compatibility wrappers for existing habits routes may be kept temporarily.

## Activity Routes

- `GET /api/activity`
- `GET /api/activity/:id`
- `GET /api/agent-messages`
- `GET /api/agent-messages/:id`

## Workflow Routes

- `GET /api/workflows`
- `POST /api/workflows`
- `PATCH /api/workflows/:id`
- `GET /api/workflows/:id/runs`
- `POST /api/workflows/:id/test`

## Analytics Routes

Add:

- `GET /api/analytics/timeline`
- `GET /api/analytics/by-template`
- `GET /api/analytics/by-workflow`

## CLI Plan

Every major operation should be exposed as a CLI command.

## Proposed Commands

### OpenClaw Integration

- `clawops openclaw connect`
- `clawops openclaw list`
- `clawops openclaw sync`
- `clawops openclaw sessions`
- `clawops openclaw cron list`
- `clawops openclaw cron create`
- `clawops openclaw cron update`
- `clawops openclaw files list`
- `clawops openclaw files history`

### Tasks

- `clawops task template list`
- `clawops task template create`
- `clawops task create`
- `clawops task update`
- `clawops task link add`
- `clawops task block`
- `clawops task unblock`
- `clawops task pullable`

### Ideas

- `clawops idea section set`
- `clawops idea task create`
- `clawops idea promote`

### Workflows

- `clawops workflow list`
- `clawops workflow create`
- `clawops workflow run`
- `clawops workflow inspect`

### Activity and Analytics

- `clawops activity list`
- `clawops messages list`
- `clawops analytics timeline`

## Implementation Contract Notes

### 1. Event Writing

Every mutation route must continue to write a low-level `events` row, even as richer `activity_events` are added.

### 2. JSON Fields

Freeform properties should use shared helper functions for serialization and parsing.

### 3. Auth

OpenClaw inbound event routes will likely need a dedicated authentication strategy compatible with webhook and hook usage, but implemented through the Next.js API layer.

### 4. API Compatibility

Where possible, preserve current routes and add richer routes incrementally instead of hard-breaking the MVP surface.
