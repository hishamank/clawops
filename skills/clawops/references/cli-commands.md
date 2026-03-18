# CLI Commands Reference

Complete reference for all `clawops` CLI commands.

## Agent Commands

### agent init
Register a new agent with ClawOps.

```bash
clawops agent init --name <name> --model <model> --role <role> --framework <framework> [--skills "skill1,skill2"]
```

**Options:**
- `--name` (required): Agent name
- `--model` (required): Model identifier (e.g., "claude-opus-4-6")
- `--role` (required): Agent role (e.g., "orchestrator", "coder", "reviewer")
- `--framework` (required): Agent framework (e.g., "openclaw", "nullclaw")
- `--skills`: Comma-separated list of agent skills/capabilities

**Example:**
```bash
clawops agent init --name "Jax" --model "claude-opus-4-6" --role "orchestrator" --framework openclaw
```

### agent status set
Update agent status.

```bash
clawops agent status set <status> [--message <message>]
```

**Status values:** `online`, `idle`, `busy`, `offline`

**Example:**
```bash
clawops agent status set busy --message "reviewing PRD"
```

### agent skills set
Update agent's declared skills.

```bash
clawops agent skills set "skill1,skill2,skill3"
```

**Example:**
```bash
clawops agent skills set "task_create,idea_add,web_search,file_read"
```

### agent heartbeat
Send a heartbeat to indicate agent is alive.

```bash
clawops agent heartbeat
```

This also logs a heartbeat run for the agent's "heartbeat" habit if one exists.

---

## Task Commands

### task create
Create a new task.

```bash
clawops task create --title <title> [--desc <description>] [--priority <priority>] [--project <project-id>] [--assignee <assignee-id>] [--spec <file>] [--idea-id <idea-id>]
```

**Options:**
- `--title` (required): Task title
- `--desc`: Task description
- `--priority`: Priority level (`low`, `medium`, `high`, `urgent`)
- `--project`: Project ID to link task to
- `--assignee`: Assignee agent ID (use `self` for current agent)
- `--spec`: Path to spec file with task context
- `--idea-id`: Link task to an idea

**Example:**
```bash
clawops task create --title "Fix login bug" --priority high --project prj-123 --assignee self
```

### task list
List tasks with optional filters.

```bash
clawops task list [--status <status>] [--assignee <id>] [--project <id>] [--with-specs] [--json]
```

**Status values:** `backlog`, `todo`, `in-progress`, `review`, `done`, `cancelled`

**Example:**
```bash
clawops task list --status todo --project prj-123 --json
```

### task pullable
List tasks eligible for autonomous agent pickup.

```bash
clawops task pullable [--project <id>] [--priority <priority>] [--template <id>] [--stage <id>] [--json]
```

**Example:**
```bash
clawops task pullable --priority high --json
```

### task update
Update task properties.

```bash
clawops task update <id> --status <status> [--priority <priority>] [--properties <json>]
```

**Example:**
```bash
clawops task update task-123 --status in-progress --priority urgent
```

### task done
Mark a task as completed.

```bash
clawops task done <id> --summary <summary> [--tokens <n>] [--artifacts "label:value,..."]
```

**Example:**
```bash
clawops task done task-123 --summary "Fixed the login redirect issue" --tokens 1250 --artifacts "pr:#42,docs:login-flow.md"
```

### task spec
Manage task spec content (context for agents).

```bash
clawops task spec <id> [--set <content>] [--file <path>] [--append <content>]
```

**Example:**
```bash
clawops task spec task-123 --file /path/to/spec.md
clawops task spec task-123 --append "## Update\nFound additional issue..."
```

### task link
Manage resource links attached to tasks.

```bash
# Add link
clawops task link add <taskId> --provider <provider> --resource-type <type> --url <url> [--label <label>]

# List links
clawops task link list <taskId>

# Remove link
clawops task link remove <taskId> <linkId>
```

### task relations
Manage task dependencies.

```bash
# Block another task
clawops task block <blocker-id> <target-id>

# Remove block
clawops task unblock <blocker-id> <target-id>

# List relations
clawops task relations <id>
```

---

## Project Commands

### project create
Create a new project.

```bash
clawops project create --name <name> [--status <status>]
```

**Status values:** `planning`, `active`, `paused`, `done`

**Example:**
```bash
clawops project create --name "Website Redesign" --status planning
```

### project list
List all projects.

```bash
clawops project list [--json]
```

### project info
Get project details.

```bash
clawops project info <id>
```

### project spec
Get or set project specification.

```bash
# Get spec
clawops project spec <id>

# Set spec (from file or stdin)
clawops project spec <id> --set
clawops project spec <id> --file <path>

# Append to spec
clawops project spec <id> --append
```

### project context
Get project context snapshot for agents.

```bash
clawops project context <id> [--minimal]
```

The `--minimal` flag returns only goal + open tasks, reducing token cost.

### project activate
Activate a project for the current session.

```bash
clawops project activate <id>
```

### project deactivate
Deactivate current project and store session summary.

```bash
clawops project deactivate --summary <summary>
```

### project session
Show current active session.

```bash
clawops project session
```

---

## Idea Commands

### idea add
Add a new idea.

```bash
clawops idea add "<title>" [--desc <description>] [--tags "tag1,tag2"]
```

**Example:**
```bash
clawops idea add "New user onboarding flow" --tags "ux,frontend" --json
```

### idea list
List ideas with optional filters.

```bash
clawops idea list [--status <status>] [--tag <tag>] [--json]
```

**Status values:** `raw`, `reviewed`, `promoted`, `archived`

### idea sections
Get all sections for an idea.

```bash
clawops idea sections <id>
```

### idea section
Get or update a specific section.

```bash
clawops idea section <id> <section> [--set <content>]
```

**Sections:** `brainstorming`, `research`, `similarIdeas`, `draftPrd`, `notes`

### idea update-sections
Update multiple sections at once.

```bash
clawops idea update-sections <id> [--brainstorming <content>] [--research <content>] [--similar-ideas <content>] [--draft-prd <content>] [--notes <content>]
```

### idea draft-prd
Get or set draft PRD for an idea.

```bash
clawops idea draft-prd <id> [--set <content>]
```

### idea tasks
List tasks linked to an idea.

```bash
clawops idea tasks <id> [--status <status>]
```

### idea create-task
Create a task linked to an idea.

```bash
clawops idea create-task <id> --title <title> [--desc <desc>] [--priority <priority>] [--assignee <id>]
```

---

## Habit Commands

### habit register
Register a new habit.

```bash
clawops habit register "<name>" --type <type> [--schedule <cron>] [--interval <ms>]
```

**Types:** `cron`, `scheduled`, `heartbeat`, `hook`, `watchdog`, `polling`

**Example:**
```bash
# Cron job
clawops habit register "daily standup" --type cron --schedule "0 8 * * *"

# Heartbeat
clawops habit register "stay alive" --type heartbeat --interval 300000
```

### habit run
Log a habit run.

```bash
clawops habit run <id> [--note <note>] [--success]
```

### habit list
List habits.

```bash
clawops habit list [--agent <id>]
```

---

## Session Commands

### session list
List OpenClaw runtime sessions.

```bash
clawops session list [--connection <id>] [--status active|ended] [--limit <count>]
```

**Example:**
```bash
clawops session list --status active --limit 5
```

---

## Cron Commands

### cron list
List synced OpenClaw cron jobs.

```bash
clawops cron list [--connection <id>]
```

### cron enable
Enable a cron job.

```bash
clawops cron enable <id> [--gateway-token <token>]
```

### cron disable
Disable a cron job.

```bash
clawops cron disable <id> [--gateway-token <token>]
```

### cron update
Update a cron job.

```bash
clawops cron update <id> [--name <name>] [--schedule-kind <kind>] [--schedule-expr <expr>] [--session-target <target>] [--enable|--disable] [--gateway-token <token>]
```

---

## Workflow Commands

### workflow create
Create a new workflow.

```bash
clawops workflow create --name <name> [--desc <description>] [--status <status>] [--trigger-type <type>] [--trigger-config <json>] [--project <id>] --steps <file>
```

**Status values:** `draft`, `active`, `paused`, `deprecated`
**Trigger types:** `manual`, `scheduled`, `event`, `webhook`

**Steps file format:**
```json
[
  { "name": "Step 1", "type": "task", "config": { "action": "create" } },
  { "name": "Step 2", "type": "http", "config": { "url": "..." } }
]
```

### workflow list
List workflows.

```bash
clawops workflow list [--status <status>] [--trigger-type <type>] [--project <id>]
```

### workflow inspect
Inspect a workflow definition.

```bash
clawops workflow inspect <id>
```

### workflow update
Update a workflow.

```bash
clawops workflow update <id> [--name <name>] [--desc <description>] [--status <status>] [--trigger-type <type>] [--trigger-config <json>] [--steps <file>]
```

### workflow run
Trigger a workflow run.

```bash
clawops workflow run <workflow-id> [--triggered-by <source>] [--triggered-by-id <id>]
```

**Triggered by values:** `human`, `agent`, `schedule`, `event`

### workflow runs
List workflow runs.

```bash
clawops workflow runs <workflow-id>
```

### workflow inspect-run
Inspect a workflow run.

```bash
clawops workflow inspect-run <run-id>
```

---

## Global Options

- `--json`: Output JSON instead of human-readable format
- Most commands return the created/updated entity ID for reference
