# GitHub Issue Execution Plan

## Purpose

This document defines how the GitHub issue backlog should be executed.

It is optimized for:

- dependency-aware execution
- up to 4 parallel workstreams
- agent assignment by seniority and complexity
- PR quality gates before and after opening a PR

This document assumes the GitHub issues created from the roadmap are the source of truth.

## Core Rules

1. Only start issues that are not blocked.
2. At most 4 implementation issues may be active in parallel.
3. Each issue should be implemented as one PR by one assigned agent.
4. Before opening any PR:
   - build must pass
   - typecheck must pass
   - lint must pass
   - tests must pass locally
5. Every issue must include:
   - tests
   - docs updates where relevant
6. After PR creation:
   - request external agent review
   - wait for GitHub Copilot review comments
   - wait for CI checks
7. Review comments must be validated before implementation.
8. Valid but out-of-scope review feedback should become a new GitHub issue.
9. All PR comments must be answered.
10. Merge conflicts and failing CI must be resolved before merge readiness.

## Agent Roles

### Senior Agents

- Claude Code
- Codex CLI

Use seniors for:

- `complexity:XL`
- most `complexity:L`
- schema-heavy changes
- cross-package refactors
- workflow engine work
- sync and integration architecture

### Junior Agents

- OpenCode
- Qwen CLI

Use juniors for:

- `complexity:S`
- selected `complexity:M`
- isolated UI work
- CLI command additions on stable backend contracts
- docs-focused or low-risk refactors

## Assignment Rules

### Prefer Claude Code or Codex CLI when

- the issue touches schema and migrations
- the issue touches multiple packages and app layers
- the issue changes core sync logic
- the issue defines a new reusable abstraction
- the issue has a high chance of hidden edge cases

### Prefer OpenCode or Qwen CLI when

- the issue is bounded to one page or command surface
- the backend contract already exists
- the issue is mostly presentational or CRUD wiring
- the issue is low-risk and easy to verify

## Parallel Execution Model

Maximum concurrent implementation issues: 4

Recommended lane model:

- Lane 1: backend foundation
- Lane 2: integration/runtime work
- Lane 3: web surface work
- Lane 4: CLI/docs/tests support work

Do not start 4 arbitrary issues. Fill lanes only with unblocked work.

## Execution Order

## Wave 1: Foundations

These issues should be executed first.

### Ready immediately

- `#105` `M1-T1` fix navigation integrity
- `#106` `M1-T2` persistent OpenClaw connection model
- `#107` `M1-T3` database-backed sync runs
- `#117` `M3-T1` rich activity event model

### Suggested assignments

- `#106` to Claude Code or Codex CLI
- `#107` to the other senior not taking `#106`
- `#105` to OpenCode or Qwen CLI
- `#117` to a senior if available, otherwise hold until one senior frees up

### Why this wave

This wave unlocks:

- durable integration state
- durable sync history
- route integrity
- rich activity infrastructure

## Wave 2: Finish the foundation chain

Start when dependencies are satisfied.

### Newly ready after Wave 1

- `#108` `M1-T4` unify CLI and web onboarding
- `#109` `M1-T5` durable OpenClaw identity mapping
- `#119` `M2-T5` OpenClaw page foundation
- `#118` `M3-T2` normalize actions into activity events

### Suggested assignments

- `#108` senior
- `#109` senior
- `#119` junior if APIs are stable
- `#118` senior

## Wave 3: Runtime mirror

Start after `#109` and other listed dependencies are complete.

### Runtime issues

- `#110` `M2-T1` session sync and history
- `#111` `M2-T2` cron job management foundation
- `#112` `M2-T3` tracked workspace file catalog
- `#120` `M3-T3` Activity page

### Suggested assignments

- `#110` senior
- `#111` senior
- `#112` senior or strong junior with close supervision
- `#120` junior once activity queries are stable

## Wave 4: Task system foundation

These can start as soon as task dependencies are satisfied. This is one of the largest work areas.

### Task issues

- `#121` `M4-T1` task templates and stages
- `#122` `M4-T2` task template, stage, and properties
- `#123` `M4-T3` normalized resource links
- `#124` `M4-T4` task dependencies and blockers

### Suggested assignments

- `#121` senior
- `#122` senior
- `#123` junior if task contract is stable
- `#124` senior

## Wave 5: Idea incubation and pullable work

### Ready after task and idea prerequisites

- `#125` `M4-T5` pullable task query
- `#126` `M4-T6` reusable task UI
- `#127` `M5-T1` idea sections and draft PRD
- `#128` `M5-T2` ideas spawning tasks

### Suggested assignments

- `#125` senior
- `#126` junior or senior depending on UI/backend split
- `#127` senior or strong junior
- `#128` senior

## Wave 6: Event ingestion and idea workspace

### Issues

- `#129` `M5-T3` idea workspace UI
- `#130` `M6-T1` inbound OpenClaw event ingestion
- `#131` `M6-T2` outbound OpenClaw action layer
- `#132` `M6-T3` periodic reconciliation runner

### Suggested assignments

- `#129` junior if backend support is stable
- `#130` senior
- `#131` senior
- `#132` senior

## Wave 7: Workflows

### Issues

- `#133` `M7-T1` workflows package
- `#134` `M7-T2` workflow persistence layer
- `#135` `M7-T3` workflow execution engine
- `#136` `M7-T4` workflow management UI

### Suggested assignments

- `#133` senior
- `#134` senior
- `#135` senior
- `#136` junior once backend contracts are stable

`#137` `M7-T5` workflow CLI parity` can run after `#134` and in parallel with `#136`.

## Wave 8: Analytics and surface upgrades

### Issues

- `#138` `M8-T1` analytics timeline
- `#139` `M8-T2` analytics UI expansion
- `#140` `M9-T1` project detail surface upgrade
- `#141` `M9-T2` agent detail cockpit upgrade

### Suggested assignments

- `#138` senior or strong junior
- `#139` junior
- `#140` junior if shared task UI is already stable
- `#141` junior or senior depending on runtime data complexity

## Deferred follow-up from roadmap docs

The roadmap docs also include later file-ops tasks, but the currently created GitHub issue range stops at `#141`. If file compare and revert issues are still needed, create them after the currently published batch is underway.

## PR Workflow

## Before opening a PR

The assigned agent must:

1. Sync with latest `main`.
2. Implement the issue in one branch.
3. Add or update tests.
4. Update docs where behavior, schema, or commands changed.
5. Run locally:
   - `pnpm build`
   - `pnpm typecheck`
   - `pnpm lint`
   - relevant tests, or full test suite if practical

Do not open a PR until these pass locally.

## After opening a PR

1. Request agent review using this order:
   - Gemini
   - OpenCode if Gemini times out
   - Qwen if OpenCode times out
2. Post the external review summary to the PR.
3. Wait for:
   - GitHub Copilot review comments
   - CI checks

## Review handling rules

For each review comment:

1. Validate the comment technically.
2. If valid and in scope:
   - implement the fix
   - push an update
   - reply on GitHub that it was fixed
3. If invalid:
   - do not implement blindly
   - reply with a concise technical explanation
4. If valid but out of scope:
   - create a new issue
   - reply that it will be handled separately

All review threads should be resolved after reply and implementation where appropriate.

## CI and merge readiness

Before merge:

1. Verify there are no merge conflicts.
2. Rebase or merge `main` into the branch if required by repo policy.
3. Re-run local validation if the branch changes materially.
4. Ensure CI is green.
5. Ensure review threads are resolved.
6. Ensure the PR description still matches the actual scope.

## Operator notification

Notify the operator only when all of the following are true:

- implementation is complete
- local validation passed
- PR is open
- external agent review was posted
- CI status is known
- review comments are handled or explicitly tracked

## Working Rules for the Project Manager Agent

- Never exceed 4 active implementation issues.
- Prefer finishing in-flight work before opening more branches.
- Do not assign blocked issues.
- Do not assign junior agents to fragile schema or architecture tasks unless a senior has already stabilized the contract.
- Use GitHub issue dependencies and this document together when deciding the next issue.
