# Milestone 7: Workflows

## Issue: M7-T1 Create workflows package

- Title: `feat(workflows): create workflows package and base contracts`
- Labels:
  - `type:feature`
  - `layer:workflows`
  - `area:workflows`
  - `milestone:7-workflows`
  - `complexity:m`
  - `status:ready`
- Depends on: none
- Parallel with: none

### Description

Create a new `packages/workflows` package to hold workflow definitions, validation, execution logic, and run history orchestration. This issue establishes the package boundary and base exported contracts so the workflow engine does not get spread across sync, tasks, and web layers.

Keep the initial scope small and strongly typed.

### Deliverables

- new package scaffold
- TypeScript build and export setup
- initial workflow types and validators

### Acceptance Criteria

- package builds successfully
- package exports core workflow types and services
- no business logic is duplicated in app layers

### References

- [openclaw-schema-and-apis.md](/Users/hichamkazan/Projects/clawops/docs/openclaw-schema-and-apis.md)

## Issue: M7-T2 Add workflow schema and persistence layer

- Title: `feat(workflows): add workflow definitions and workflow run persistence`
- Labels:
  - `type:feature`
  - `layer:workflows`
  - `layer:core`
  - `area:workflows`
  - `milestone:7-workflows`
  - `complexity:l`
  - `status:blocked`
- Depends on: `M7-T1`
- Parallel with: `M7-T4`

### Description

Add the persistent data model for workflows, workflow runs, and workflow run steps. This issue should include schema work, migrations, and package-level CRUD and run-record helpers. The design should support both operator-authored workflows and later system-defined templates.

### Deliverables

- `workflow_definitions`, `workflow_runs`, and `workflow_run_steps`
- package CRUD helpers
- package run logging helpers

### Acceptance Criteria

- workflow definitions can be created and listed
- workflow runs and steps can be recorded with status and result metadata
- `pnpm typecheck` passes

### References

- [openclaw-schema-and-apis.md](/Users/hichamkazan/Projects/clawops/docs/openclaw-schema-and-apis.md)

## Issue: M7-T3 Implement workflow execution engine

- Title: `feat(workflows): implement event-driven workflow execution engine`
- Labels:
  - `type:feature`
  - `layer:workflows`
  - `layer:sync`
  - `layer:tasks`
  - `area:workflows`
  - `milestone:7-workflows`
  - `complexity:xl`
  - `status:blocked`
- Depends on: `M7-T2`, `M6-T1`
- Parallel with: none

### Description

Implement the workflow execution engine that can:

- match triggers
- evaluate conditions
- execute actions
- record run and step state

Start with a narrow action set that proves the architecture:

- create task
- update task
- create notification
- call a supported OpenClaw action

### Deliverables

- trigger matcher
- condition evaluator
- action runner
- workflow run/step persistence integration

### Acceptance Criteria

- a supported event can trigger a workflow end-to-end
- each workflow run records step-level execution state
- failures are captured without leaving silent partial state

### References

- [openclaw-product-decisions.md](/Users/hichamkazan/Projects/clawops/docs/openclaw-product-decisions.md)

## Issue: M7-T4 Add workflow management UI

- Title: `feat(web): add workflow list and structured builder UI`
- Labels:
  - `type:feature`
  - `layer:web`
  - `area:workflows`
  - `milestone:7-workflows`
  - `complexity:l`
  - `status:blocked`
- Depends on: `M7-T2`
- Parallel with: `M7-T5`

### Description

Build the first workflow management UI. The first phase is a structured form builder, not a visual canvas. The UI should support creating and editing workflow definitions, viewing last run state, and inspecting workflow run history.

Keep the UI modular so a visual builder can later replace or extend it.

### Deliverables

- workflows list page
- create/edit workflow form
- workflow run history page or panel

### Acceptance Criteria

- operator can create and edit workflow definitions from the dashboard
- run history is visible
- form uses validated workflow contracts

### References

- [openclaw-page-structure.md](/Users/hichamkazan/Projects/clawops/docs/openclaw-page-structure.md)

## Issue: M7-T5 Add workflow CLI parity

- Title: `feat(cli): add workflow management and inspection commands`
- Labels:
  - `type:feature`
  - `layer:cli`
  - `layer:workflows`
  - `area:workflows`
  - `milestone:7-workflows`
  - `complexity:m`
  - `status:blocked`
- Depends on: `M7-T2`
- Parallel with: `M7-T4`

### Description

Expose workflow management and inspection through the CLI. Add commands for listing workflows, creating them, triggering test or manual runs where supported, and inspecting run history. The CLI should stay script-friendly and consistent with existing command conventions.

### Deliverables

- workflow list command
- workflow create or apply command
- workflow inspect command
- optional workflow run/test command if backend support exists

### Acceptance Criteria

- workflows can be operated without the dashboard
- CLI output supports `--json`
- commands align with the workflow API contracts

### References

- [apps/cli/src/index.ts](/Users/hichamkazan/Projects/clawops/apps/cli/src/index.ts)

