# @clawops/cli

Command-line interface for the ClawOps agent operations platform.

## Installation

```bash
# From the project root
./install.sh

# Or manually
cd apps/cli && pnpm link --global
```

## Usage

```bash
clawops [command] [options]
```

Global options:
- `--json` — Output raw JSON
- `--version` — Show version
- `--help` — Show help

---

## Commands

### `clawops onboard`

Interactive onboarding flow to connect ClawOps to an agent platform.

```bash
clawops onboard [options]
```

| Option | Description | Default |
|---|---|---|
| `--openclaw-dir <path>` | Path to openclaw directory | `~/.openclaw` |
| `--all` | Auto-accept all prompts (non-interactive) | |
| `--dry-run` | Show what would happen without writing | |
| `--debug` | Print verbose onboarding diagnostics | |
| `--json` | Output result as JSON (implies `--all`) | |

**Example:**
```bash
# Interactive setup
clawops onboard

# Non-interactive (CI/scripting)
clawops onboard --all --openclaw-dir /opt/openclaw --json
```

**Output (JSON):**
```json
{
  "platform": "openclaw",
  "openclawDir": "/home/user/.openclaw",
  "agents": [{"id": "rick", "name": "Rick", "workspacePath": "..."}],
  "skillsInstalled": 4,
  "dashboardStarted": false,
  "dashboardMode": "prod",
  "serviceInstalled": false
}
```

Dashboard start behavior:
- If production build artifacts exist, onboard starts Web in production mode.
- If artifacts are missing, onboard runs `pnpm build` first, then starts Web in production mode.
- On start, onboard writes dashboard process metadata to `.clawops-web.pid` in the project root.

---

### `clawops sync`

Sync ClawOps with OpenClaw agents and workspaces.

```bash
clawops sync [options]
```

| Option | Description |
|---|---|
| `--openclaw-dir <path>` | Path to openclaw directory |
| `--gateway-url <url>` | Gateway URL |
| `--gateway-token <token>` | Gateway token |
| `--reinstall-skills` | Force reinstall skill even if present |
| `--dry-run` | Show what would change without writing |
| `--json` | Output result as JSON |

**Example:**
```bash
# Basic sync
clawops sync

# With gateway data
clawops sync --gateway-token YOUR_TOKEN

# JSON output for scripting
clawops sync --json
```

**Exit codes:**
- `0` — success (changes made)
- `1` — error
- `2` — nothing changed

**Output (JSON):**
```json
{
  "syncedAt": "2026-03-06T09:54:00Z",
  "agents": {"total": 5, "added": ["anghaminator"], "removed": []},
  "skills": {"installed": 1, "skipped": 4},
  "cronJobs": {"total": 12}
}
```

---

### `clawops web stop`

Stop the tracked dashboard process using the PID file.

```bash
clawops web stop [--project-root /path/to/clawops] [--json]
```

Behavior:
- Reads `.clawops-web.pid` from the project root.
- Stops the process with `SIGTERM` then `SIGKILL` if needed.
- Removes stale PID files automatically.

---

### `clawops agent`

Manage agents.

```bash
# Register a new agent
clawops agent init --name "Jax" --model "claude-opus-4-6" --role "orchestrator" --framework openclaw

# Set agent status
clawops agent status set busy --message "reviewing PRD"

# Declare skills
clawops agent skills set "task_create,idea_add,web_search"

# Send heartbeat
clawops agent heartbeat
```

---

### `clawops task`

Manage tasks.

```bash
# Create a task
clawops task create --title "Review onboarding" --priority high --project <id>

# List tasks
clawops task list --status todo --assignee self --json

# Update status
clawops task update <id> --status in-progress

# Complete a task
clawops task done <id> --summary "reviewed and approved" --tokens 1240
```

---

### `clawops idea`

Manage ideas.

```bash
# Add an idea
clawops idea add "Redesign onboarding" --desc "..." --tags "ux,frontend"

# List ideas
clawops idea list --status raw --json
```

---

### `clawops project`

Manage projects.

```bash
# Create a project
clawops project create --name "Portfolio Redesign" --status planning

# List projects
clawops project list --json

# View project details
clawops project info <id>
```

---

### `clawops habit`

Manage habits.

```bash
# Register a habit
clawops habit register "morning briefing" --type scheduled --schedule "0 8 * * *"

# Log a habit run
clawops habit run <id> --note "completed standup"

# List habits
clawops habit list --json
```

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `CLAWOPS_MODE` | Execution mode (local package mode) | `local` |
| `CLAWOPS_AGENT_ID` | Agent identifier | — |
| `CLAWOPS_DB_PATH` | SQLite database path | `./clawops.db` |
| `WEB_PORT` | Dashboard port | `3333` |
| `OPENCLAW_DIR` | OpenClaw directory | `~/.openclaw` |
| `OPENCLAW_GATEWAY_URL` | Gateway URL | `http://localhost:3000` |
| `OPENCLAW_GATEWAY_TOKEN` | Gateway auth token | — |
