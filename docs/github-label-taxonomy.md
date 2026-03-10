# GitHub Label Taxonomy

## Note

The repository did not contain a label configuration file under `.github/`, but the GitHub repository already had a canonical label set configured remotely.

This file reflects the exact label set used when creating the GitHub issues from the roadmap drafts.

## Label Groups

## Layer Labels

Use one or more of these labels to indicate the main implementation surface.

- `layer: api`
- `layer: cli`
- `layer: core`
- `layer: packages`
- `layer: web`

## Type Labels

Use one primary type label per issue.

- `type: bug`
- `type: chore`
- `type: docs`
- `type: feature`

## Complexity Labels

Use one complexity label per issue.

- `complexity:S`
- `complexity:M`
- `complexity:L`
- `complexity:XL`

## Status Labels

Use one status label per issue.

- `status: blocked`
- `status: in-progress`
- `status: needs-review`
- `status: ready`

## Priority Labels

- `priority: high`
- `priority: medium`
- `priority: low`

## Additional Labels

- `not-ready`
- `question`

## Issue Draft Conventions

Each issue draft should include:

- title
- labels
- complexity
- dependency list
- parallelization note
- implementation brief
- deliverables
- acceptance criteria
- references to the planning docs and current code paths
