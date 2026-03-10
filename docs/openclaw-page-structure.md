# Planned Page Structure

## Summary

This document defines the target dashboard information architecture for the OpenClaw-first control plane.

The goal is to:

- remove dead-end navigation
- add the missing product areas now required by the roadmap
- keep the UI coherent across global views and scoped views

## Primary Navigation

Recommended top-level navigation:

- Overview
- Agents
- Tasks
- Ideas
- Projects
- Activity
- Workflows
- Analytics
- OpenClaw
- Settings

## Removed or Replaced Navigation

- remove the current `/config` navigation item unless it is replaced by a real `OpenClaw` page

## Page Definitions

## 1. Overview

### Purpose

Operator landing page for the current state of the system.

### Sections

- key health cards
- active agents now
- pullable task summary
- blocked task summary
- recent activity feed
- sync health
- token and cost summary

### Key Components

- `OverviewStats`
- `LiveAgentStrip`
- `PullableTasksCard`
- `BlockedTasksCard`
- `RecentActivityPanel`
- `SyncHealthPanel`
- `CostSummaryPanel`

## 2. Agents

### List Page

Show:

- status
- current session state
- model
- framework
- assigned work
- last active
- current cost snapshot

### Detail Page

Show:

- identity and OpenClaw mapping
- sessions
- cron jobs
- memory and workspace summary
- recent tasks
- recent messages
- cost timeline
- activity stream

### Future Extension

Eventually add:

- direct operator-to-agent interaction
- richer communication timeline

## 3. Tasks

## Global Task Views

Provide both:

- list view
- board view

### Core Filters

- project
- idea
- assignee
- template
- status
- stage
- blocked
- tag

### Task Detail

Show:

- lifecycle status
- stage
- properties
- links
- dependencies
- blockers
- artifacts
- timeline or activity
- related idea
- related project

### Shared Use

The same task components should be reused on:

- global tasks page
- project detail page
- idea detail page
- agent detail page

Only the filtering and surrounding context should change.

## 4. Ideas

### List Page

Show:

- idea status
- title
- readiness
- number of spawned tasks
- whether a draft PRD exists
- last worked date

### Detail Page

This should become a workspace, not only a card detail screen.

Suggested layout:

- header and readiness state
- sections navigation
- summary
- brainstorming
- research
- similar ideas
- draft PRD
- spawned tasks
- convert to project action

## 5. Projects

### List Page

Show:

- status
- task counts
- blocked counts
- milestone progress
- last activity

### Detail Page

Show:

- project metadata
- PRD/spec
- milestones
- task board or task list filtered by project
- dependency and blocker summary
- cost summary
- recent project activity

## 6. Activity

### Purpose

Dedicated center for operator visibility.

### Views

- all activity feed
- filtered by agent
- filtered by workflow
- filtered by project
- filtered by severity

### Event Types to Show

- sync events
- file changes
- task changes
- idea and project changes
- cron runs
- workflow runs
- notifications
- agent communication

### Detail Panel

Each activity event should open into a detail panel showing:

- raw metadata
- related entities
- workflow linkages
- follow-up actions

## 7. Workflows

### List Page

Show:

- workflow name
- trigger type
- status
- last run
- failure count

### Builder Page

Stage 1:

- structured form editor
- trigger section
- condition section
- actions section

Stage 2:

- visual builder canvas

### Workflow Run Detail

Show:

- trigger event
- evaluated conditions
- step-by-step execution log
- resulting entities or errors

## 8. Analytics

### Summary Views

- total tokens
- total cost
- cost over time
- token over time

### Breakdowns

- by agent
- by model
- by project
- by task template
- by workflow

### Required Charts

- time series
- stacked cost by model
- ranked usage by agent

## 9. OpenClaw

### Purpose

First-class product area for OpenClaw integration and observability.

### Subsections

- connections
- sync status and sync history
- sessions
- cron jobs
- workspaces
- tracked files
- file history

### Key Screens

#### Connections

- list configured OpenClaw connections
- connect a new one
- validate gateway health

#### Sessions

- current sessions
- channels
- recent state changes

#### Cron Jobs

- cron list
- cron editor
- run history

#### Workspaces

- workspace browser
- tracked files
- compare revisions
- revert entrypoints

## 10. Settings

### Scope

- runtime settings
- API/auth settings
- connection defaults
- analytics preferences
- workflow defaults

Settings should not become a dumping ground for major product areas that deserve their own top-level page.

## Component Reuse Strategy

### Reusable Foundations

- `TaskList`
- `TaskBoard`
- `TaskDetailPanel`
- `ActivityFeed`
- `SyncRunList`
- `CronJobTable`
- `FileRevisionHistory`
- `WorkflowRunList`

### Context Injection

Each reusable component should accept filters and context rather than being duplicated per page.

Examples:

- project tasks use `TaskBoard` with `projectId`
- idea tasks use `TaskList` with `ideaId`
- pullable tasks use `TaskList` with `pullableOnly`

## Page Delivery Order

Recommended order:

1. fix nav and route integrity
2. add Activity page
3. add OpenClaw page
4. expand Tasks
5. expand Ideas
6. add Workflows
7. deepen Analytics
