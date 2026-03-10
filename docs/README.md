# ClawOps Planning Docs

This directory contains the OpenClaw-first planning documents produced after reviewing the current ClawOps implementation and adjacent products in the ecosystem.

## Documents

- `openclaw-product-decisions.md`
  - Product direction, operating model, domain language, and non-goals.
- `openclaw-schema-and-apis.md`
  - Planned schema evolution, package boundaries, CLI/API surface, and integration contracts.
- `openclaw-page-structure.md`
  - Dashboard information architecture, primary views, and page/component responsibilities.
- `openclaw-implementation-roadmap.md`
  - Milestones, detailed implementation tasks, dependencies, and parallelization guidance.

## Intent

These docs are written so that:

- a human can review the target shape of the product
- an agent can pick up a task with enough context to implement it
- future GitHub issues can be generated directly from the task list

## Scope

The target direction is:

- OpenClaw-first control plane
- Next.js-native application and API surface
- strong CLI parity for all core operations
- durable activity, sync, analytics, and workflow automation
