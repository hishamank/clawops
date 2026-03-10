# Milestone 5: Ideas

## Issue: M5-T1 Add idea sections and draft PRD support

- Title: `feat(ideas): add structured idea sections and draft PRD support`
- Labels:
  - `type:feature`
  - `layer:ideas`
  - `layer:core`
  - `layer:web`
  - `layer:cli`
  - `area:ideas`
  - `milestone:5-ideas`
  - `complexity:l`
  - `status:ready`
- Depends on: none
- Parallel with: none

### Description

Expand the idea model so it becomes a pre-project incubation workspace instead of a thin card. Add support for structured sections such as brainstorming, research, similar ideas, and draft PRD. Provide package, API, and CLI support to read and update these sections.

This issue should focus on the data model and editing surface, not the full idea workspace UI.

### Deliverables

- idea schema extension or `idea_sections` table
- package helpers to read and update sections
- Next.js routes for section access and updates
- CLI support for section editing

### Acceptance Criteria

- ideas can store structured sections
- draft PRD content can be read and updated
- updates are validated and persisted consistently

### References

- [packages/ideas/src/index.ts](/Users/hichamkazan/Projects/clawops/packages/ideas/src/index.ts)
- [openclaw-product-decisions.md](/Users/hichamkazan/Projects/clawops/docs/openclaw-product-decisions.md)

## Issue: M5-T2 Allow ideas to spawn tasks before project promotion

- Title: `feat(ideas): allow ideas to create linked tasks before project promotion`
- Labels:
  - `type:feature`
  - `layer:ideas`
  - `layer:tasks`
  - `layer:web`
  - `layer:cli`
  - `area:ideas`
  - `area:tasks`
  - `milestone:5-ideas`
  - `complexity:m`
  - `status:blocked`
- Depends on: `M4-T2`, `M5-T1`
- Parallel with: `M5-T3`

### Description

Implement the ability for ideas to spawn linked tasks before promotion to a project. This lets ideas become active incubation spaces where research, coding, or content work can begin while the idea is still being explored.

This issue should include schema support where needed, API routes, CLI commands, and the package-level coordination between ideas and tasks.

### Deliverables

- task linkage to ideas
- API route to create a task from an idea context
- CLI support for idea-linked task creation

### Acceptance Criteria

- an idea can create one or more linked tasks without becoming a project
- linked tasks can be queried from the idea context
- idea promotion still works after tasks exist

### References

- [openclaw-schema-and-apis.md](/Users/hichamkazan/Projects/clawops/docs/openclaw-schema-and-apis.md)

## Issue: M5-T3 Build idea workspace UI

- Title: `feat(web): turn idea detail into an incubation workspace`
- Labels:
  - `type:feature`
  - `layer:web`
  - `area:ideas`
  - `milestone:5-ideas`
  - `complexity:l`
  - `status:blocked`
- Depends on: `M5-T1`, `M5-T2`
- Parallel with: none

### Description

Build the new idea workspace page. Replace the current shallow idea presentation with a detail surface that supports section editing, spawned task visibility, draft PRD progression, readiness tracking, and project promotion.

Re-use task components where possible instead of creating a separate task rendering system inside ideas.

### Deliverables

- idea detail page route
- section-based workspace layout
- spawned task panel
- draft PRD panel
- promote-to-project action integrated into the workspace

### Acceptance Criteria

- operator can work an idea through brainstorming to PRD
- operator can see and manage idea-linked tasks
- promotion to project remains available when the idea is ready

### References

- [apps/web/app/ideas/page.tsx](/Users/hichamkazan/Projects/clawops/apps/web/app/ideas/page.tsx)
- [openclaw-page-structure.md](/Users/hichamkazan/Projects/clawops/docs/openclaw-page-structure.md)

