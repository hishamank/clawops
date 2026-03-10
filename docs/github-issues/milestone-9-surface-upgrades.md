# Milestone 9: Surface Upgrades

## Issue: M9-T1 Upgrade project detail to use shared task views and blocker summaries

- Title: `feat(web): upgrade project detail with shared task views and dependency summaries`
- Labels:
  - `type:feature`
  - `layer:web`
  - `layer:projects`
  - `area:projects`
  - `area:tasks`
  - `milestone:9-surface-upgrades`
  - `complexity:m`
  - `status:blocked`
- Depends on: `M4-T4`, `M4-T6`
- Parallel with: `M9-T2`

### Description

Refactor the project detail page so it uses the shared task list and board components introduced in the task-system milestone. Add blocker and dependency summaries so projects surface execution constraints, not just raw task counts. Projects should remain filtered views over the global task system.

### Deliverables

- project task board or list powered by shared task components
- blocked task summary
- dependency summary
- cleaner project execution overview

### Acceptance Criteria

- project pages no longer use one-off task rendering for the primary task surface
- blocker and dependency summaries are visible
- project page remains type-safe and route-stable

### References

- [apps/web/app/projects/[id]/page.tsx](/Users/hichamkazan/Projects/clawops/apps/web/app/projects/[id]/page.tsx)
- [openclaw-page-structure.md](/Users/hichamkazan/Projects/clawops/docs/openclaw-page-structure.md)

## Issue: M9-T2 Upgrade agent detail with sessions, cron, messages, and activity

- Title: `feat(web): turn agent detail into an operator cockpit`
- Labels:
  - `type:feature`
  - `layer:web`
  - `layer:agents`
  - `area:agents`
  - `area:activity`
  - `milestone:9-surface-upgrades`
  - `complexity:l`
  - `status:blocked`
- Depends on: `M2-T1`, `M2-T2`, `M3-T4`
- Parallel with: `M9-T1`

### Description

Upgrade the agent detail surface so it reflects the richer OpenClaw control-plane model. Add panels for sessions, cron jobs, recent messages, and richer activity while preserving the useful existing identity, tasks, and memory context. The result should feel like a real operator cockpit for a single agent.

### Deliverables

- sessions panel
- cron jobs panel
- recent messages panel
- activity panel
- cleaner integration mapping display

### Acceptance Criteria

- agent detail page exposes runtime and communication state
- operator can inspect recent work and current operational context from one page
- route remains resilient when some data categories are empty

### References

- [apps/web/app/agents/[id]/page.tsx](/Users/hichamkazan/Projects/clawops/apps/web/app/agents/[id]/page.tsx)

