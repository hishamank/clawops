# OpenClaw-First Product Decisions

## Summary

ClawOps will evolve from a local dashboard plus CRUD layer into an OpenClaw-first control plane.

The primary product shape is:

- runtime mirror of the OpenClaw environment
- durable operations and audit layer
- global work management system
- workflow and reaction engine
- analytics and cost control surface

The system should still be designed so other frameworks can be supported later, but the immediate product should optimize for OpenClaw and avoid premature abstraction.

## Primary Product Goals

1. Give the operator a trustworthy view of what OpenClaw agents are doing now and what changed recently.
2. Let agents and humans work from the same source of truth for tasks, projects, ideas, cron jobs, files, and activity.
3. Close the loop between ClawOps and OpenClaw so changes in one system can be reflected into the other with minimal drift.
4. Expose the core system through both the web dashboard and the CLI.
5. Preserve enough activity and file history to support debugging, audit, and selective revert workflows.

## Product Positioning

ClawOps is not only:

- a task tracker
- a project dashboard
- a passive analytics screen

ClawOps should be positioned as:

- mission control for OpenClaw
- the state, activity, and automation layer around OpenClaw
- the operator interface for supervising autonomous agent work

## Product Principles

### 1. OpenClaw First

The system should model OpenClaw concepts directly instead of hiding them behind generic abstractions too early.

Examples:

- gateways
- workspaces
- sessions
- cron jobs
- memory files
- agent-to-agent communication
- OpenClaw events and webhooks

### 2. Next.js Native

All product APIs should be expressed as Next.js route handlers.

This means:

- the web app and API stay in the same deployment/runtime model
- background sync entrypoints should still be implemented as Next route handlers or server utilities invoked by them
- any external automation should call a Next.js API route

### 3. CLI Parity

Everything important should be scriptable through the CLI.

The CLI should expose commands for:

- integration onboarding and sync
- OpenClaw visibility and reconciliation
- task operations
- idea operations
- project operations
- cron job operations
- workflow operations
- activity inspection
- analytics queries

### 4. Durable State Over Ephemeral UI Convenience

No critical integration state should live only in memory.

This especially applies to:

- last sync results
- OpenClaw connection settings
- sync runs
- workflow runs
- activity feed state
- file snapshots

### 5. Global Work, Scoped Views

Tasks are globally addressable entities.

Projects, ideas, agents, and workflows should present filtered views of the same work graph rather than creating separate task systems.

### 6. Structured Core, Flexible Edge

The platform needs both:

- structured fields for automation, analytics, and sync
- freeform fields for user customization

This leads to:

- fixed universal task lifecycle
- configurable stage sets by template
- freeform task properties
- normalized external links

## Domain Decisions

## Tasks

### Decision

Keep tasks as a global entity.

### Why

- tasks may exist without a project
- project pages should show filtered task views
- agents need a unified pullable backlog
- blockers and dependencies work better in a global graph

### Task Model

Each task should have:

- universal lifecycle status
- template or task type
- configurable stage
- tags
- freeform properties
- normalized external links
- optional project link
- optional idea link
- dependencies and blockers

### Universal Lifecycle

Recommended lifecycle:

- `backlog`
- `ready`
- `active`
- `blocked`
- `review`
- `done`
- `cancelled`

### Stages

Stages are template-specific and user-configurable.

Example for `coding`:

- `triage`
- `planned`
- `branching`
- `implementing`
- `pr-open`
- `review-feedback`
- `ready-to-merge`

Status should represent broad execution state. Stage should represent domain-specific progress.

### Task Templates

Initial built-in templates:

- `coding`
- `research`
- `content`
- `ops`
- `review`

Templates should define:

- default stage set
- default properties
- suggested links
- automation hooks
- default pull eligibility rules

## Task Dependencies and Blockers

### Decision

Tasks should support dependency edges.

### Why

- agents should only auto-pull unblocked work
- timelines and critical path planning require explicit relationships
- project execution needs visibility into what is waiting on what

### Relationship Types

Initial support:

- `blocks`
- `depends-on`
- `related-to`

`depends-on` can be derived from inverse `blocks`, but storing an explicit edge type makes the UI and automation simpler.

## Ideas

### Decision

Ideas remain separate from projects.

### Why

- ideas are low-commitment and exploratory
- projects are execution containers
- promotion is a meaningful transition point

### Expanded Idea Model

Ideas should become incubation spaces with sections:

- summary
- brainstorming
- research
- similar ideas
- draft PRD
- readiness

Ideas may spawn tasks before they are promoted to a project.

Promotion should be allowed when:

- the operator decides the idea is mature enough
- or a draft PRD is ready

## Projects

### Decision

Projects remain execution containers.

### Responsibilities

- provide scope and context
- group milestones
- show filtered task views
- host the canonical PRD/spec

Projects should not become the only place where work exists.

## Habits / Cron Jobs

### Decision

The current `habits` concept should be clarified around cron and recurring automation.

### Recommendation

Keep the database table for continuity in early migration planning, but shift product language toward:

- `cron jobs`
- `automations`
- `scheduled runs`

The UI should expose a proper cron editor because that matches the operator mental model better than `habits`.

If the naming remains `habits` in the schema for one phase, the UI should still communicate the OpenClaw cron mapping clearly.

## OpenClaw Integration Strategy

### Decision

Use a hybrid integration model:

- push for freshness
- periodic reconciliation for drift correction

### Push Path

- OpenClaw hooks or plugins send events to Next.js route handlers in ClawOps
- OpenClaw cron or webhook actions can call ClawOps APIs directly

### Reconciliation Path

ClawOps periodically fetches or scans:

- sessions
- cron jobs
- selected config
- workspace metadata
- file snapshots or diffs

### Why Hybrid

- push reduces latency
- polling recovers from missed events
- workspace file changes can happen outside the expected event path

## File History and Revert

### Decision

ClawOps should store file history for selected OpenClaw workspace files.

### Recommended Scope

Start with:

- markdown memory files
- config files
- other operator-designated tracked files

### Storage Strategy

Prefer snapshots with metadata and optional diffs over full arbitrary filesystem mirroring.

Where the workspace is already a Git repo, also store:

- repo path
- branch
- commit SHA
- dirty state

This creates a bridge between ClawOps history and workspace Git history.

## Activity and Communication

### Decision

Activity becomes a first-class product area.

### Initial Scope

- agent status changes
- task transitions
- idea and project changes
- cron runs
- sync runs
- file changes
- session events
- workflow runs
- notifications

Agent-to-agent communication should be visible in stages:

1. first, as activity events and message previews
2. later, as expanded first-class communication threads or handoffs

## Workflows

### Decision

Add a new product area for workflows or automations.

### Product Shape

Workflows should orchestrate both ClawOps actions and OpenClaw actions.

### Triggers

- OpenClaw event
- ClawOps event
- schedule
- webhook
- file change

### Actions

- create task
- update task status or stage
- set task properties
- add links
- create notification
- create or update cron job
- write workspace file
- call OpenClaw endpoint

### UX Direction

Ship in stages:

1. structured forms and templates
2. workflow run history
3. visual builder

## Analytics and Cost

### Decision

Analytics must become more than summary cards.

### Required Analytics Slices

- by agent
- by model
- by project
- by task template
- over time

### Why

OpenClaw operators need to understand:

- which agents cost the most
- which model choices cost the most
- when usage spikes happened
- which workflows or projects are driving spend

## Non-Goals for the Near Term

- multi-tenant enterprise workspace model
- broad framework abstraction before OpenClaw support is excellent
- advanced role-based access control
- large dependency expansion before the control-plane model stabilizes
