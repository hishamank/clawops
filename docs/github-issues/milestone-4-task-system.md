# Milestone 4: Task System

## Issue: M4-T1 Add task templates and template stages

- Title: `feat(tasks): add task templates and configurable template stages`
- Labels:
  - `type:feature`
  - `layer:tasks`
  - `layer:core`
  - `area:task-templates`
  - `milestone:4-task-system`
  - `complexity:l`
  - `status:ready`
- Depends on: none
- Parallel with: none

### Description

Add the schema and package layer for task templates and template stages. This is the foundation for user-configurable stages while keeping a global task system. Seed the first built-in templates:

- coding
- research
- content
- ops
- review

This issue should not redesign the full UI yet. The main goal is to establish a stable data model and package APIs for templates and stages.

### Deliverables

- `task_templates` schema and migration
- `task_template_stages` schema and migration
- package functions to list templates and stages
- seed or bootstrap logic for built-in templates

### Acceptance Criteria

- built-in templates exist and can be queried
- stages are ordered and template-scoped
- the design supports later user-defined templates

### References

- [openclaw-product-decisions.md](/Users/hichamkazan/Projects/clawops/docs/openclaw-product-decisions.md)
- [openclaw-schema-and-apis.md](/Users/hichamkazan/Projects/clawops/docs/openclaw-schema-and-apis.md)

## Issue: M4-T2 Extend tasks with template, stage, and properties

- Title: `feat(tasks): extend task model with template, stage, and freeform properties`
- Labels:
  - `type:feature`
  - `layer:tasks`
  - `layer:core`
  - `layer:web`
  - `layer:cli`
  - `area:tasks`
  - `milestone:4-task-system`
  - `complexity:xl`
  - `status:blocked`
- Depends on: `M4-T1`
- Parallel with: `M4-T3`

### Description

Expand the core task model to include:

- template selection
- stage selection
- freeform JSON properties
- optional idea linkage where needed

Update the schema, package logic, API routes, and CLI commands so tasks can be created and updated with this richer structure. Preserve the current universal status field as the broad lifecycle status.

### Deliverables

- schema migration for task fields
- package CRUD support
- task API updates
- CLI create/update support

### Acceptance Criteria

- tasks can be created and updated with template, stage, and properties
- JSON properties are serialized and parsed consistently
- backward compatibility for existing tasks is preserved

### References

- [packages/tasks/src/index.ts](/Users/hichamkazan/Projects/clawops/packages/tasks/src/index.ts)
- [apps/cli/src/commands/task.ts](/Users/hichamkazan/Projects/clawops/apps/cli/src/commands/task.ts)

## Issue: M4-T3 Add normalized resource links

- Title: `feat(tasks): add normalized resource links for tasks and future cross-entity integrations`
- Labels:
  - `type:feature`
  - `layer:tasks`
  - `layer:core`
  - `area:tasks`
  - `area:openclaw`
  - `milestone:4-task-system`
  - `complexity:m`
  - `status:blocked`
- Depends on: `M4-T2`
- Parallel with: `M4-T4`

### Description

Add a normalized `resource_links` model to support GitHub issues, PRs, branches, docs, files, and other future provider-backed references. Freeform task properties are still needed, but this issue establishes a first-class integration-friendly link system that can support filtering, previews, sync, and workflow actions.

Build the table generically so it can support tasks first and other entities later.

### Deliverables

- `resource_links` schema and migration
- package logic for add/list/remove links
- task API endpoints for link management
- CLI commands for link operations

### Acceptance Criteria

- task links are stored as structured records
- links support provider, resource type, URL, external ID, and metadata
- link operations work from API and CLI

### References

- [openclaw-schema-and-apis.md](/Users/hichamkazan/Projects/clawops/docs/openclaw-schema-and-apis.md)

## Issue: M4-T4 Add task dependencies and blockers

- Title: `feat(tasks): add task dependency graph and blocker resolution model`
- Labels:
  - `type:feature`
  - `layer:tasks`
  - `layer:core`
  - `area:dependencies`
  - `milestone:4-task-system`
  - `complexity:l`
  - `status:blocked`
- Depends on: `M4-T2`
- Parallel with: `M4-T3`

### Description

Implement the dependency model for tasks so agents and humans can see which tasks are blocked, which tasks depend on others, and which work is ready to pull. Add the relation schema, package-level relation queries, and API/CLI operations for creating and inspecting task edges.

This issue is foundational for proactive auto-pull behavior and future timeline views.

### Deliverables

- `task_relations` schema and migration
- package queries for blockers and dependents
- API and CLI support to create and inspect relations

### Acceptance Criteria

- a task can declare that it blocks or depends on another task
- package logic can determine whether a task is currently blocked
- relation data is queryable from task detail flows

### References

- [openclaw-product-decisions.md](/Users/hichamkazan/Projects/clawops/docs/openclaw-product-decisions.md)

## Issue: M4-T5 Add pullable task query and auto-pickup rules

- Title: `feat(tasks): add pullable task query for agent auto-pickup`
- Labels:
  - `type:feature`
  - `layer:tasks`
  - `layer:cli`
  - `layer:web`
  - `area:dependencies`
  - `area:tasks`
  - `milestone:4-task-system`
  - `complexity:m`
  - `status:blocked`
- Depends on: `M4-T2`, `M4-T4`
- Parallel with: `M4-T6`

### Description

Add a package-level and API-level concept of pullable tasks. A pullable task is one that is eligible for autonomous pickup by an agent based on task status, template rules, stage rules, blocker state, and optional auto-pull eligibility flags.

This issue should define the rules clearly and expose them consistently through the package, route, and CLI layers.

### Deliverables

- package query for pullable tasks
- `GET /api/tasks/pullable`
- CLI command to list pullable tasks

### Acceptance Criteria

- blocked tasks are excluded
- ineligible states are excluded
- the query is deterministic and documented

### References

- [openclaw-schema-and-apis.md](/Users/hichamkazan/Projects/clawops/docs/openclaw-schema-and-apis.md)

## Issue: M4-T6 Rebuild task UI as reusable global and scoped views

- Title: `feat(web): rebuild task views as reusable global and scoped list/board components`
- Labels:
  - `type:feature`
  - `layer:web`
  - `area:tasks`
  - `milestone:4-task-system`
  - `complexity:l`
  - `status:blocked`
- Depends on: `M4-T2`, `M4-T4`
- Parallel with: `M4-T5`

### Description

Rebuild the task UI so the same core list and board components can be reused globally and inside project, idea, and agent surfaces. This should replace one-off rendering with filter-driven reusable components. Support the richer task model, including stage, properties, blockers, and links.

Focus on flexible primitives first. Exact visual polish can evolve later.

### Deliverables

- reusable `TaskList`
- reusable `TaskBoard`
- improved task detail panel or page
- filter integration for global and scoped contexts

### Acceptance Criteria

- the same task components are reused across global and scoped pages
- task views support template, stage, blocked, and assignee filtering
- no route-specific duplicate task rendering remains for primary flows

### References

- [openclaw-page-structure.md](/Users/hichamkazan/Projects/clawops/docs/openclaw-page-structure.md)
- [apps/web/app/tasks/page.tsx](/Users/hichamkazan/Projects/clawops/apps/web/app/tasks/page.tsx)

