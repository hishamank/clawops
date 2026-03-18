# Task Specs Guide

Task specs provide rich context for agents working on tasks. Well-written specs improve agent dispatch accuracy and reduce iteration cycles.

## Why Task Specs Matter

When an agent picks up a task, the spec is the primary source of context. Good specs:
- Reduce clarification requests
- Enable accurate complexity/priority assessment
- Support autonomous task completion
- Provide audit trail for decisions

## Spec Structure

A good task spec includes these sections:

```markdown
## Context
Why this task exists, background information, relevant links.

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Dependencies
- Blocked by: task-id-1, task-id-2
- Must complete before: task-id-3

## Technical Notes
Implementation hints, file locations, API references.

## Constraints
- Performance requirements
- Compatibility requirements
- Security considerations
```

## Setting Specs

```bash
# Set from file
clawops task spec <id> --file /path/to/spec.md

# Set from command line
clawops task spec <id> --set "## Context\n..."

# Append new information
clawops task spec <id> --append "## Update\n..."
```

## Priority Levels

| Priority | When to Use |
|----------|-------------|
| `urgent` | Production bugs, security issues |
| `high` | Important features, technical debt |
| `medium` | Normal feature work |
| `low` | Nice-to-haves, cleanup |

## Status Transitions

Tasks flow through statuses:

```
backlog → todo → in-progress → review → done
              ↓                      ↓
            cancelled            cancelled
```

- **backlog**: Not ready, needs specs or dependencies
- **todo**: Ready to work
- **in-progress**: Actively being worked
- **review**: Work complete, awaiting review
- **done**: Fully complete
- **cancelled**: Abandoned

## Auto-Pull Eligibility

Tasks can be marked eligible for autonomous agent pickup at creation time. The `task pullable` command filters for tasks that agents can autonomously pick up:

- Status is `backlog`, `todo`, `in-progress`, or `review`
- Has no assignee (`assigneeId` is null)
- `autoPullEligible` is true
- Not actively blocked by another task

```bash
# Create pullable task (autoPullEligible defaults to true)
clawops task create --title "..." --priority high

# List pullable tasks
clawops task pullable --priority high
```

Note: The CLI does not currently expose a way to modify `autoPullEligible` after task creation.

## Complexity Assessment

When assessing task complexity for dispatch, consider:

1. **Scope**: How many files/systems affected?
2. **Dependencies**: Any blocking tasks?
3. **Risk**: Production impact, breaking changes?
4. **Testing**: How much test coverage needed?

Include complexity assessment in the spec to help dispatch system assign appropriately.

## Phase Transitions

Tasks may transition through phases:

1. **Planning**: Spec being written, dependencies identified
2. **Ready**: Spec complete, waiting for pickup
3. **Active**: Work in progress
4. **Review**: Work complete, human review needed
5. **Complete**: Fully done

Use status updates to reflect phase transitions:

```bash
# Start work
clawops task update <id> --status in-progress

# Move to review
clawops task update <id> --status review

# Complete
clawops task done <id> --summary "Completed the feature"
```

## Best Practices

1. **Write specs before picking up tasks**: Good context enables good work
2. **Update specs as you learn**: Append discoveries and decisions
3. **Link related tasks**: Use `task block` and `task relations`
4. **Include acceptance criteria**: Clear success conditions
5. **Reference external resources**: Link to PRDs, docs, discussions
6. **Track complexity**: Help dispatch assign the right agent
