---
name: clawops
description: >
  Use ClawOps to track tasks, projects, ideas, habits, agents, sessions, cron jobs, and workflows via the clawops CLI.
  Triggers when: (1) Creating, updating, listing, or completing tasks, (2) Managing projects with status/milestones, 
  (3) Capturing ideas and brainstorming, (4) Registering or logging habits/heartbeats, (5) Querying agent sessions, 
  (6) Managing cron jobs, (7) Creating or running workflows, (8) Interpreting notifications/alerts about agent activity.
---

# ClawOps Skill

ClawOps is the operations layer for AI agent teams — a hub where agents report work and humans track progress.

## Quick Start

```bash
# Set up agent identity
clawops agent init --name "AgentName" --model "claude-opus-4-6" --role "orchestrator" --framework openclaw

# Create a task
clawops task create --title "Implement login" --priority high --project <project-id>

# List todo tasks
clawops task list --status todo --json
```

## Core Concepts

- **Tasks**: Work items with status, priority, and optional spec content
- **Projects**: Top-level containers for related tasks
- **Ideas**: Brainstorming layer, can promote to projects
- **Habits**: Recurring behaviors (cron, heartbeat, scheduled)
- **Workflows**: Multi-step automation sequences

## Operating Rules

1. Every implementation effort must map to a project
2. Every task must link to its project (`--project`)
3. Use `--json` for all parseable output
4. Capture IDs from create commands for later reference
5. Send heartbeats regularly (`clawops agent heartbeat`)

## CLI Commands Summary

### Tasks

```bash
# Create task
clawops task create --title "<title>" [--desc <desc>] [--priority low|medium|high|urgent] [--project <id>] [--assignee self|<id>]

# List tasks
clawops task list [--status todo|in-progress|review|done] [--project <id>] [--json]

# Find pullable tasks (for autonomous pickup)
clawops task pullable [--priority high|urgent] [--json]

# Update status
clawops task update <id> --status in-progress

# Mark done
clawops task done <id> --summary "What was accomplished" [--tokens 1234] [--artifacts "pr:42,report.md"]

# Task spec (context for agents)
clawops task spec <id> --set "## Context\n...## Acceptance Criteria\n..."
clawops task spec <id> --append "## Notes\n..."
```

### Projects

```bash
# Create project
clawops project create --name "<name>" [--status planning|active|paused|done]

# Get project context (goal + open tasks)
clawops project context <id>
clawops project context <id> --minimal  # low token cost

# Activate for session
clawops project activate <id>
clawops project deactivate --summary "Session summary"
```

### Ideas

```bash
# Add idea
clawops idea add "<title>" [--desc <desc>] [--tags "tag1,tag2"]

# List ideas
clawops idea list [--status raw|reviewed|promoted|archived] [--tag <tag>]

# Manage sections
clawops idea sections <id>
clawops idea section <id> brainstorming --set "..."
clawops idea draft-prd <id> --set "## PRD content..."
```

### Habits

```bash
# Register habit
clawops habit register "daily standup" --type scheduled --schedule "0 8 * * *"
clawops habit register "health check" --type heartbeat --interval 300

# Log run
clawops habit run <id> [--note "completed"] [--success]

# List
clawops habit list
```

### Agents

```bash
# Set status
clawops agent status set busy --message "reviewing PR"

# Update skills
clawops agent skills set "task_create,web_search,file_read"

# Heartbeat
clawops agent heartbeat
```

### Sessions

```bash
# List OpenClaw sessions
clawops session list [--status active|ended] [--limit 10]
```

### Cron Jobs

```bash
# List synced cron jobs
clawops cron list

# Enable/disable
clawops cron enable <id>
clawops cron disable <id>

# Update
clawops cron update <id> --name "New name" --schedule-expr "0 9 * * *"
```

### Workflows

```bash
# Create workflow
clawops workflow create --name "Deploy" --steps steps.json [--trigger-type manual|scheduled|event|webhook]

# List and inspect
clawops workflow list
clawops workflow inspect <id>

# Trigger run
clawops workflow run <id> --triggered-by agent
clawops workflow runs <id>
clawops workflow inspect-run <run-id>
```

## Notifications & Alerts

ClawOps generates notifications for:
- Task completions
- Missed heartbeats (agent may have crashed)
- Milestone achievements

Check alerts:
```bash
# Via CLI - look at recent events
clawops task list --status done --json | head -20

# Via web dashboard
# Navigate to /notifications
```

Severity levels: `info`, `warning`, `error`, `critical`

## Task Specs

Task specs provide context for agents working on tasks. Good specs include:

```markdown
## Context
Why this task exists, relevant background.

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

## Dependencies
- Depends on: task-id-1
- Blocked by: task-id-2

## Technical Notes
Implementation hints, file locations, etc.
```

Set specs with:
```bash
clawops task spec <id> --file /path/to/spec.md
clawops task spec <id> --append "## Updates\nNew info..."
```

## Web Dashboard

Access at `http://localhost:3333` (default port).

| Route | Purpose |
|-------|---------|
| `/` | Fleet overview, agent cards |
| `/agents/:id` | Agent profile, tasks, habits |
| `/tasks` | Task list with filters |
| `/projects` | Project cards, milestones |
| `/ideas` | Idea board |
| `/analytics` | Token/cost charts |
| `/notifications` | Alert log |
| `/settings` | API keys, config |

## Common Patterns

1. **Always `--json`**: Parse output in scripts
2. **Capture IDs**: Store task/project IDs for later reference
3. **Link everything**: Use `--project` on tasks, `--idea-id` when spawning from ideas
4. **Environment**: Set `CLAWOPS_AGENT_ID` to tag your work
5. **Heartbeat**: Regular heartbeats prevent "agent offline" alerts

## Reference Files

For detailed information, see:
- [CLI Commands Reference](references/cli-commands.md)
- [Task Specs Guide](references/task-specs.md)
- [Dashboard Usage](references/dashboard.md)
- [Patterns & Gotchas](references/patterns.md)
