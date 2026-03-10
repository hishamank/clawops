# Milestone 10: File Operations

## Issue: M10-T1 Add file revision comparison UI

- Title: `feat(web): add tracked file revision comparison views`
- Labels:
  - `type:feature`
  - `layer:web`
  - `area:files`
  - `milestone:10-file-ops`
  - `complexity:m`
  - `status:blocked`
- Depends on: `M2-T4`
- Parallel with: `M10-T2`

### Description

Build a comparison UI for tracked file revisions so operators can inspect what changed between workspace file versions. The interface should support selecting revisions, showing metadata such as capture time and Git context, and rendering content differences in a readable way.

### Deliverables

- revision list UI
- compare view
- metadata display for revision timestamp and Git context

### Acceptance Criteria

- operator can compare two revisions of a tracked file
- revision metadata is visible in the comparison flow
- empty states are handled cleanly

### References

- [openclaw-page-structure.md](/Users/hichamkazan/Projects/clawops/docs/openclaw-page-structure.md)

## Issue: M10-T2 Add controlled file revert workflow entrypoint

- Title: `feat(sync): add controlled file revert action with audit trail`
- Labels:
  - `type:feature`
  - `layer:sync`
  - `layer:web`
  - `layer:workflows`
  - `area:files`
  - `milestone:10-file-ops`
  - `complexity:l`
  - `status:blocked`
- Depends on: `M2-T4`, `M6-T2`
- Parallel with: `M10-T1`

### Description

Add a controlled operator-facing way to revert a tracked workspace file revision. This should not be a silent overwrite. It must go through a clear action path, write audit and activity records, and integrate with the outbound OpenClaw action layer. If a workflow hook is appropriate, structure the implementation so revert can later be routed through workflow policy.

### Deliverables

- API or action endpoint for revert
- audit logging and activity event integration
- basic operator entrypoint for invoking revert

### Acceptance Criteria

- operator can trigger a revert to a previous tracked revision
- revert attempts are fully audited
- failures are surfaced with clear error responses

### References

- [openclaw-product-decisions.md](/Users/hichamkazan/Projects/clawops/docs/openclaw-product-decisions.md)
