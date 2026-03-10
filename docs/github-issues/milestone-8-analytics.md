# Milestone 8: Analytics

## Issue: M8-T1 Add analytics timeline aggregations

- Title: `feat(analytics): add time-series token and cost aggregations`
- Labels:
  - `type:feature`
  - `layer:analytics`
  - `layer:web`
  - `area:analytics`
  - `milestone:8-analytics`
  - `complexity:m`
  - `status:ready`
- Depends on: none
- Parallel with: `M8-T2`

### Description

Add time-series analytics support for token and cost tracking. Operators need to see usage over time, not only totals. Extend the analytics package and API surface to support date-range filtering and grouping by granularity so the web layer can render meaningful timelines.

### Deliverables

- analytics package queries for timelines
- timeline API routes
- date-range and grouping support

### Acceptance Criteria

- timeline queries return stable grouped results
- API supports range and granularity parameters
- `pnpm typecheck` passes

### References

- [apps/web/app/analytics/page.tsx](/Users/hichamkazan/Projects/clawops/apps/web/app/analytics/page.tsx)
- [packages/analytics/src/index.ts](/Users/hichamkazan/Projects/clawops/packages/analytics/src/index.ts)

## Issue: M8-T2 Expand analytics UI by agent, model, project, and template

- Title: `feat(web): expand analytics page with timeline and deeper breakdowns`
- Labels:
  - `type:feature`
  - `layer:web`
  - `layer:analytics`
  - `area:analytics`
  - `milestone:8-analytics`
  - `complexity:l`
  - `status:blocked`
- Depends on: `M8-T1`, `M4-T1`, `M4-T2`
- Parallel with: none

### Description

Upgrade the analytics page so it supports operator-grade usage and cost analysis. Add time-series views plus breakdowns by agent, model, project, and task template. Preserve the current simple breakdowns if useful, but move the page toward an exploratory operations view rather than a static summary page.

### Deliverables

- timeline charts
- breakdown panels by agent, model, project, and template
- filter controls for date range and grouping

### Acceptance Criteria

- analytics page shows time-series token and cost data
- operator can compare usage across the required slices
- empty and loading states remain implemented

### References

- [openclaw-page-structure.md](/Users/hichamkazan/Projects/clawops/docs/openclaw-page-structure.md)

