# OpenClaw Control Plane Roadmap

## Summary

This roadmap is structured so implementation can later be converted into GitHub issues.

Each task includes:

- scope
- why it matters
- expected deliverables
- likely code areas
- dependencies
- parallelization notes
- acceptance criteria

Task IDs are stable references for issue generation.

## Dependency Rules

- Tasks in earlier milestones generally unblock later milestones.
- Tasks marked `parallel` can be implemented concurrently once their explicit dependencies are satisfied.
- Schema tasks must land before package/API/UI tasks that depend on them.

## Milestone 0: Documentation and Alignment

### M0-T1: Finalize roadmap docs

Status:

- done in current planning phase

Deliverables:

- product decisions doc
- schema and API doc
- page structure doc
- implementation roadmap

Dependencies:

- none

## Milestone 1: Navigation, Integration Persistence, and Sync Foundations

Goal:

- remove obvious product breakage
- persist OpenClaw connection state
- create the durable sync foundation

### M1-T1: Fix top-level navigation integrity

Scope:

- remove the current broken `/config` route or replace it with a real destination
- align sidebar navigation with the planned page structure
- verify every top-level nav item resolves to an actual page

Why:

- current sidebar contains a confirmed dead route
- route integrity is the minimum bar before expanding the dashboard

Likely code areas:

- `apps/web/components/sidebar.tsx`
- `apps/web/app/*`

Deliverables:

- no dead top-level routes
- updated nav labels and icons if needed

Dependencies:

- none

Parallelization:

- can run in parallel with M1-T2 and M1-T3

Acceptance criteria:

- all primary nav links render a non-404 page
- removed or replaced routes are reflected in nav copy

### M1-T2: Add persistent OpenClaw connection model

Scope:

- add schema for durable OpenClaw connections
- persist connection metadata instead of relying on in-memory sync state
- create package logic for create/update/list/get connection

Why:

- current web sync flow stores last sync in memory only
- onboarding is not durable without connection persistence

Likely code areas:

- `packages/core/src/schema.ts`
- `packages/core/migrations/*`
- `packages/sync/src/*`
- `apps/web/app/api/integrations/openclaw/*`

Deliverables:

- `openclaw_connections` schema and migration
- package-level CRUD functions
- API routes for listing and upserting connections

Dependencies:

- none

Parallelization:

- blocks M1-T4, M1-T5, M2-T1, M2-T2

Acceptance criteria:

- connection data survives restart
- connection can be created and read through API
- typecheck and lint pass

### M1-T3: Replace in-memory sync status with database-backed sync runs

Scope:

- add `sync_runs` and optional `sync_run_items`
- update sync entrypoints to create durable run records
- retire `apps/web/lib/server/sync-state.ts` from core integration flow

Why:

- operators need history and diagnostics
- workflow and activity systems will depend on sync records

Likely code areas:

- `packages/core/src/schema.ts`
- `packages/sync/src/*`
- `apps/web/app/api/sync/*` or new integration sync routes

Deliverables:

- schema and migration
- package helpers to start, update, and finalize sync runs
- route handlers that write sync run records

Dependencies:

- none

Parallelization:

- can proceed alongside M1-T2 if migration coordination is managed carefully

Acceptance criteria:

- every manual sync creates a durable sync run
- success and failure states are recorded
- operator can retrieve recent sync history through API

### M1-T4: Unify CLI onboarding and web onboarding

Scope:

- ensure both onboarding paths persist connection state
- ensure both onboarding paths can register agents consistently
- ensure onboarding steps emit events

Why:

- current CLI and web onboarding flows diverge materially

Likely code areas:

- `apps/cli/src/commands/onboard.ts`
- `apps/web/components/onboarding/*`
- `apps/web/app/api/sync/openclaw/*`
- `packages/sync/src/*`
- `packages/agents/src/*`

Deliverables:

- shared onboarding service in package logic
- consistent output contract for CLI and web

Dependencies:

- M1-T2
- M1-T3

Parallelization:

- blocks only downstream onboarding-related UX tasks

Acceptance criteria:

- CLI and web onboarding both create durable connection state
- both paths can register or update discovered agents
- both paths produce event records

### M1-T5: Add durable OpenClaw identity mapping for agents

Scope:

- create schema and logic for mapping ClawOps agents to OpenClaw identities
- stop relying only on `name + framework` for idempotent mapping

Why:

- reliable sync and reconciliation require durable external identifiers

Likely code areas:

- `packages/core/src/schema.ts`
- `packages/agents/src/index.ts`
- `packages/sync/src/openclaw/*`

Deliverables:

- `openclaw_agents` table or equivalent
- package helpers for upsert and lookup
- onboarding and sync updated to use durable mapping

Dependencies:

- M1-T2

Parallelization:

- blocks M2 sync tasks

Acceptance criteria:

- repeated sync maps the same OpenClaw agent consistently
- rename scenarios do not create duplicate ClawOps agents

## Milestone 2: OpenClaw Runtime Mirror

Goal:

- ingest live OpenClaw state beyond workspace scanning

### M2-T1: Session sync and session history

Scope:

- add `openclaw_sessions`
- sync active sessions from gateway
- preserve history and last-seen state

Why:

- sessions are core to runtime visibility

Likely code areas:

- `packages/core/src/schema.ts`
- `packages/sync/src/openclaw/gateway.ts`
- `packages/sync/src/*`
- `apps/web/app/api/integrations/openclaw/*`

Deliverables:

- schema and migration
- package sync logic
- API route to list sessions
- CLI command to inspect sessions

Dependencies:

- M1-T2
- M1-T5

Parallelization:

- parallel with M2-T2 after connection model exists

Acceptance criteria:

- sessions can be synced and queried
- historical session data remains after session ends

### M2-T2: Cron job model and cron editor foundation

Scope:

- evolve `habits` toward cron-focused product behavior
- add external cron identity fields
- expose cron list and edit APIs

Why:

- cron jobs are a core OpenClaw control-plane concern
- user explicitly wants a strong cron editor

Likely code areas:

- `packages/core/src/schema.ts`
- `packages/habits/src/*` or replacement package logic
- `apps/web/app/api/habits/*` or new `cron-jobs` routes
- `apps/cli/src/commands/habit.ts`

Deliverables:

- clarified cron data model
- list/create/update APIs
- CLI parity for list/create/update

Dependencies:

- M1-T2
- M1-T5

Parallelization:

- parallel with M2-T1

Acceptance criteria:

- operator can list and edit cron jobs
- ClawOps can map a cron job to its OpenClaw counterpart

### M2-T3: Workspace tracking and tracked file catalog

Scope:

- add `workspace_files`
- track selected files per workspace
- record hash and metadata for seen files

Why:

- file change visibility is required for the control plane

Likely code areas:

- `packages/core/src/schema.ts`
- `packages/sync/src/openclaw/scanner.ts`
- `packages/sync/src/*`

Deliverables:

- schema and migration
- package logic for file catalog upsert
- API for listing tracked files

Dependencies:

- M1-T2
- M1-T5

Parallelization:

- parallel with M2-T1 and M2-T2

Acceptance criteria:

- tracked files can be listed by workspace
- file hash changes are detected

### M2-T4: Workspace file revision history

Scope:

- add `workspace_file_revisions`
- capture snapshots or diffs for tracked files
- store Git metadata when available

Why:

- operator asked for possible revert support
- history is required for reliable activity and audit

Likely code areas:

- `packages/core/src/schema.ts`
- `packages/sync/src/*`
- `apps/web/app/api/integrations/openclaw/*`

Deliverables:

- schema and migration
- package capture logic
- API for file history

Dependencies:

- M2-T3

Parallelization:

- can start in parallel with M2-T5 if schema coordination is clear

Acceptance criteria:

- revisions are created on detected tracked-file changes
- Git branch and commit metadata are stored when discoverable

### M2-T5: OpenClaw page foundation

Scope:

- add the new top-level OpenClaw page and subviews
- start with connections, sync runs, sessions, cron jobs, and tracked files

Why:

- OpenClaw needs a dedicated product surface, not a hidden onboarding widget

Likely code areas:

- `apps/web/app/openclaw/*`
- `apps/web/components/*`

Deliverables:

- OpenClaw index page
- connection status panel
- sync history panel
- sessions table
- cron jobs table
- tracked files table

Dependencies:

- M1-T1
- M1-T2
- M1-T3
- at least one of M2-T1 or M2-T2 for meaningful content

Parallelization:

- UI shell can begin earlier with mock data contracts

Acceptance criteria:

- top-level OpenClaw page exists
- operator can inspect the integration state without CLI use

## Milestone 3: Activity Center

Goal:

- make system activity observable and useful

### M3-T1: Add `activity_events` schema and package layer

Scope:

- define rich activity event model
- build insertion helpers and feed queries

Why:

- current low-level events table is too thin for the desired activity center

Likely code areas:

- `packages/core/src/schema.ts`
- `packages/notifications/src/*`
- new package helpers in `packages/sync` or dedicated activity package later

Deliverables:

- schema and migration
- event creation helper functions
- list and filter queries

Dependencies:

- none

Parallelization:

- can run in parallel with M3-T2 if event contract is agreed first

Acceptance criteria:

- activity events can be created and filtered by type, agent, entity, and severity

### M3-T2: Normalize sync, task, project, idea, cron, and workflow actions into activity events

Scope:

- update mutation and sync flows to emit rich activity events

Why:

- the activity page needs structured data from day one

Likely code areas:

- `apps/web/app/api/**/*`
- `apps/cli/src/commands/**/*`
- `packages/sync/src/**/*`

Deliverables:

- event emission on key actions
- shared helper to reduce event-writing duplication

Dependencies:

- M3-T1

Parallelization:

- can be split by domain into parallel tasks later

Acceptance criteria:

- major product actions appear in the activity feed

### M3-T3: Add Activity page and feed components

Scope:

- implement the top-level Activity page
- support filterable feed and detail panel

Why:

- operator explicitly wants a place to see what agents are doing

Likely code areas:

- `apps/web/app/activity/*`
- `apps/web/components/activity-*`

Deliverables:

- feed view
- basic filters
- detail panel or detail page

Dependencies:

- M1-T1
- M3-T1
- M3-T2

Parallelization:

- UI shell can start once API contract exists

Acceptance criteria:

- operator can inspect recent activity without relying on Overview shortcuts

### M3-T4: Agent communication observability

Scope:

- add `agent_messages` schema
- ingest message-like events where available
- surface previews in activity and agent pages

Why:

- user wants visibility into agent-to-agent communication in stages

Likely code areas:

- `packages/core/src/schema.ts`
- `packages/sync/src/*`
- `apps/web/app/activity/*`
- `apps/web/app/agents/[id]/*`

Deliverables:

- schema and migration
- ingestion logic
- message list API

Dependencies:

- M3-T1
- OpenClaw event ingestion work in M6

Parallelization:

- later-phase activity extension

Acceptance criteria:

- messages are visible as structured records when source data exists

## Milestone 4: Task System Redesign

Goal:

- make tasks generic, automation-friendly, and suitable for auto-pickup

### M4-T1: Add task templates and template stages

Scope:

- add schema for templates and stages
- seed built-in templates

Why:

- user-configurable stages need a template-backed system

Likely code areas:

- `packages/core/src/schema.ts`
- `packages/tasks/src/*`
- migration seed support

Deliverables:

- `task_templates`
- `task_template_stages`
- seed for `coding`, `research`, `content`, `ops`, `review`

Dependencies:

- none

Parallelization:

- blocks most other M4 tasks

Acceptance criteria:

- templates and stages can be listed and selected

### M4-T2: Extend tasks with template, stage, and freeform properties

Scope:

- update schema and package logic
- update create and update APIs

Why:

- this is the core of the new task model

Likely code areas:

- `packages/core/src/schema.ts`
- `packages/tasks/src/*`
- `apps/web/app/api/tasks/*`
- `apps/cli/src/commands/task.ts`

Deliverables:

- schema migration
- package CRUD support
- API support
- CLI support

Dependencies:

- M4-T1

Parallelization:

- parallel with M4-T3 only after contract stabilizes

Acceptance criteria:

- tasks can be created with template, stage, and properties
- properties are preserved and returned consistently

### M4-T3: Add normalized resource links

Scope:

- add generic `resource_links`
- support task link add/list/remove

Why:

- freeform properties alone are not enough for real integrations

Likely code areas:

- `packages/core/src/schema.ts`
- `packages/tasks/src/*`
- `apps/web/app/api/tasks/*`
- `apps/cli/src/commands/task.ts`

Deliverables:

- schema and migration
- task link APIs
- CLI link commands

Dependencies:

- none, but should align with M4-T2 task contract

Parallelization:

- parallel after task contract alignment

Acceptance criteria:

- task links are typed and filterable

### M4-T4: Add task dependency and blocker model

Scope:

- create relation schema and package logic
- compute blocked and pullable tasks

Why:

- agents must only auto-pull unblocked tasks

Likely code areas:

- `packages/core/src/schema.ts`
- `packages/tasks/src/*`
- `apps/web/app/api/tasks/*`
- `apps/cli/src/commands/task.ts`

Deliverables:

- `task_relations`
- package queries for blockers and dependents
- API and CLI operations for creating dependency edges

Dependencies:

- M4-T2

Parallelization:

- can run in parallel with M4-T5 after schema agreement

Acceptance criteria:

- a blocked task is identifiable through package and API queries
- dependency graph can be read for a task

### M4-T5: Add pullable task query and auto-pickup rules

Scope:

- define eligibility rules for agent pickup
- add API and CLI queries

Why:

- this is required for proactive agent work selection

Likely code areas:

- `packages/tasks/src/*`
- `apps/web/app/api/tasks/pullable/*`
- `apps/cli/src/commands/task.ts`

Deliverables:

- package-level pullable query
- route handler
- CLI command

Dependencies:

- M4-T2
- M4-T4

Parallelization:

- can be implemented once blockers logic exists

Acceptance criteria:

- returned tasks exclude blocked or ineligible work

### M4-T6: Rebuild task UI around reusable list and board views

Scope:

- add shared task components with filter-driven context
- support project, idea, and global task views with the same core components

Why:

- user wants one global task system reused across scopes

Likely code areas:

- `apps/web/app/tasks/*`
- `apps/web/components/*`
- project and idea detail pages

Deliverables:

- reusable task list
- reusable task board
- task detail panel or improved task detail page

Dependencies:

- M4-T2
- M4-T4

Parallelization:

- UI component work can split across list, board, and detail

Acceptance criteria:

- same task view system is reused globally and in project/idea context

## Milestone 5: Idea Incubation Workspace

Goal:

- make ideas a real pre-project workspace

### M5-T1: Add idea sections and draft PRD support

Scope:

- extend idea schema
- add structured idea sections or section table

Why:

- user wants brainstorming, research, similar ideas, and PRD progression

Likely code areas:

- `packages/core/src/schema.ts`
- `packages/ideas/src/*`
- `apps/web/app/api/ideas/*`
- `apps/cli/src/commands/idea.ts`

Deliverables:

- schema and migration
- package update helpers
- API and CLI section editing support

Dependencies:

- none

Parallelization:

- blocks M5-T2 and M5-T3

Acceptance criteria:

- idea sections can be read and updated

### M5-T2: Allow spawning tasks from ideas

Scope:

- support `ideaId` on tasks
- add flows to create a task directly from an idea

Why:

- user explicitly wants tasks before project promotion

Likely code areas:

- `packages/tasks/src/*`
- `packages/ideas/src/*`
- `apps/web/app/api/ideas/*`
- `apps/web/app/ideas/*`
- `apps/cli/src/commands/idea.ts`

Deliverables:

- schema and package support
- API route for idea task creation
- UI action
- CLI action

Dependencies:

- M4-T2
- M5-T1

Parallelization:

- can progress with M5-T3 after section support exists

Acceptance criteria:

- an idea can spawn one or more linked tasks without project promotion

### M5-T3: Build idea workspace UI

Scope:

- replace simple idea list/details with richer workspace page

Why:

- the current model is too thin for incubation

Likely code areas:

- `apps/web/app/ideas/*`
- new idea detail route
- supporting components

Deliverables:

- idea detail page with sections
- spawned tasks panel
- draft PRD panel
- promote action

Dependencies:

- M5-T1
- M5-T2 for spawned task panel

Parallelization:

- section UI and task UI can split

Acceptance criteria:

- operator can use an idea as a real working surface before promotion

## Milestone 6: OpenClaw Event Ingestion and Bidirectional Actions

Goal:

- stop relying on scan-only integration

### M6-T1: Add inbound OpenClaw event ingestion route

Scope:

- implement secure Next.js route handler for hooks or plugin events
- normalize payloads into activity and sync updates

Why:

- push-based freshness is required for a control plane

Likely code areas:

- `apps/web/app/api/integrations/openclaw/events/*`
- `packages/sync/src/*`
- `packages/workflows/src/*` when introduced

Deliverables:

- validated event ingestion endpoint
- normalized internal event contract

Dependencies:

- M1-T2
- M3-T1

Parallelization:

- can start before outbound actions

Acceptance criteria:

- ClawOps can ingest a supported OpenClaw event and persist useful state

### M6-T2: Add outbound OpenClaw action layer

Scope:

- define package helpers and API routes for actions back into OpenClaw

Why:

- workflows and operator controls need to push changes into OpenClaw

Likely code areas:

- `packages/sync/src/openclaw/*`
- `apps/web/app/api/integrations/openclaw/actions/*`
- CLI integration commands

Deliverables:

- route handlers for selected outbound actions
- package helpers for webhook or API calls

Dependencies:

- M1-T2

Parallelization:

- parallel with M6-T1

Acceptance criteria:

- at least one write action works end-to-end, such as cron update or file write

### M6-T3: Add periodic reconciliation runner contract

Scope:

- provide a Next.js API-triggerable reconcile path
- support external schedulers or OpenClaw cron calling it

Why:

- Next.js is the API layer, but durable scheduling may be external

Likely code areas:

- `apps/web/app/api/integrations/openclaw/*`
- `packages/sync/src/*`

Deliverables:

- idempotent reconcile route
- reconciliation modes

Dependencies:

- M1-T3
- M2-T1
- M2-T2
- M2-T3

Parallelization:

- can be implemented after the underlying sync modules exist

Acceptance criteria:

- reconcile route can be safely called repeatedly

## Milestone 7: Workflow Engine

Goal:

- make ClawOps proactive instead of only descriptive

### M7-T1: Create `packages/workflows`

Scope:

- add new package and base contracts for workflow definitions and runs

Why:

- automation logic deserves a dedicated home

Likely code areas:

- `packages/workflows/*`
- workspace config updates

Deliverables:

- new package
- exports
- initial types and validators

Dependencies:

- product approval already given in this planning cycle

Parallelization:

- blocks all workflow package work

Acceptance criteria:

- package builds and exports core workflow types and services

### M7-T2: Add workflow schema and run history

Scope:

- add workflow tables and package CRUD

Why:

- workflows need durable definitions and execution records

Likely code areas:

- `packages/core/src/schema.ts`
- `packages/workflows/src/*`

Deliverables:

- schema and migration
- package CRUD and run logging

Dependencies:

- M7-T1

Parallelization:

- blocks M7-T3 and M7-T4

Acceptance criteria:

- workflow definition can be persisted and listed

### M7-T3: Implement workflow execution engine for event-driven actions

Scope:

- support trigger matching, condition evaluation, and action execution

Why:

- this is the product engine for proactive automation

Likely code areas:

- `packages/workflows/src/*`
- `packages/tasks/src/*`
- `packages/sync/src/*`

Deliverables:

- execution engine
- action registry
- workflow run records

Dependencies:

- M7-T2
- M6-T1 or M6-T3 depending on trigger type

Parallelization:

- can split by trigger/action categories later

Acceptance criteria:

- a supported event can trigger a workflow that creates or updates a task

### M7-T4: Add workflow management UI

Scope:

- add workflows list and form-based builder

Why:

- user wants a workflow section and visual builder in stages

Likely code areas:

- `apps/web/app/workflows/*`
- workflow components

Deliverables:

- workflows page
- create/edit workflow forms
- run history page

Dependencies:

- M7-T2

Parallelization:

- list page and builder can split

Acceptance criteria:

- operator can create and inspect workflows from the UI

### M7-T5: Add workflow CLI parity

Scope:

- expose workflow management and inspection through CLI

Why:

- user wants all major operations in CLI form

Likely code areas:

- `apps/cli/src/commands/*`
- `apps/cli/src/index.ts`

Deliverables:

- workflow list/create/run/inspect commands

Dependencies:

- M7-T2

Parallelization:

- parallel with M7-T4

Acceptance criteria:

- workflows are operable without the dashboard

## Milestone 8: Analytics Deepening

Goal:

- provide operational cost visibility with timeline context

### M8-T1: Add analytics timeline aggregations

Scope:

- add package queries and APIs for time-series analytics

Why:

- the user explicitly wants timeline-based token and cost monitoring

Likely code areas:

- `packages/analytics/src/*`
- `apps/web/app/api/analytics/*`

Deliverables:

- token and cost timeline endpoints
- configurable grouping granularity

Dependencies:

- none

Parallelization:

- blocks M8-T2 UI work

Acceptance criteria:

- timeline data can be queried by date range

### M8-T2: Add analytics views by agent, model, project, and template

Scope:

- expand analytics page and supporting APIs

Why:

- operator needs actionable cost slices

Likely code areas:

- `packages/analytics/src/*`
- `apps/web/app/analytics/*`

Deliverables:

- breakdown views
- timeline charts
- filter controls

Dependencies:

- M8-T1
- M4-T1 and M4-T2 for template analytics

Parallelization:

- chart sections can split

Acceptance criteria:

- analytics page supports all key slices defined in product decisions

## Milestone 9: Project and Agent Surface Upgrade

Goal:

- make projects and agents reflect the richer data model

### M9-T1: Upgrade project detail to use shared task board/list with blocker summaries

Scope:

- replace project-specific task rendering with shared task views and dependency summaries

Why:

- projects should show scoped views of the global task system

Likely code areas:

- `apps/web/app/projects/[id]/*`
- task shared components

Deliverables:

- filtered task board/list
- blocker summary
- dependency summary

Dependencies:

- M4-T4
- M4-T6

Parallelization:

- project metrics and task view work can split

Acceptance criteria:

- project page shows reusable task system components

### M9-T2: Upgrade agent detail with sessions, cron jobs, messages, and richer activity

Scope:

- modernize agent detail page to reflect the new control-plane model

Why:

- agent pages should become operator cockpits

Likely code areas:

- `apps/web/app/agents/[id]/*`

Deliverables:

- session panel
- cron jobs panel
- message preview panel
- activity panel

Dependencies:

- M2-T1
- M2-T2
- M3-T4

Parallelization:

- panels can split

Acceptance criteria:

- operator can inspect runtime and communication state from the agent page

## Milestone 10: Revert and Advanced File Operations

Goal:

- make stored file history operationally useful

### M10-T1: Add file compare UI

Scope:

- let operator compare tracked file revisions

Why:

- file history is less useful without readable comparison

Likely code areas:

- `apps/web/app/openclaw/*`
- file history components

Deliverables:

- revision comparison view

Dependencies:

- M2-T4

Parallelization:

- parallel with M10-T2

Acceptance criteria:

- operator can compare two file revisions

### M10-T2: Add revert workflow entrypoint

Scope:

- allow operator to revert a tracked file revision through a controlled workflow

Why:

- user explicitly wants possible revert support

Likely code areas:

- `apps/web/app/api/integrations/openclaw/actions/*`
- `packages/sync/src/*`
- workflow integration

Deliverables:

- revert action route
- activity logging
- safety checks

Dependencies:

- M2-T4
- M6-T2

Parallelization:

- after outbound action layer exists

Acceptance criteria:

- operator can trigger a file revert with full audit trail

## Parallelization Summary

High-confidence parallel lanes after foundational schema work:

- OpenClaw runtime ingestion
- Activity feed UI
- task links
- analytics backend
- project and agent UI upgrades

Tasks that should not start early:

- workflow execution engine before event and sync foundations
- revert actions before file revision tracking
- advanced task auto-pull before blockers and stage rules

## Recommended First Issue Batch

The best first batch of GitHub issues is:

- M1-T1
- M1-T2
- M1-T3
- M1-T4
- M1-T5

That batch establishes:

- route integrity
- durable integration state
- durable sync history
- onboarding consistency
- reliable OpenClaw identity mapping
