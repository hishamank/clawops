# ClawOps

> **The calm operations layer above autonomous AI systems**

[![Node](https://img.shields.io/badge/node-18%2B-brightgreen)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-9%2B-F69220)](https://pnpm.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6)](https://www.typescriptlang.org/)

---

## What is ClawOps?

ClawOps is the **operations layer for AI agent teams** — a framework-agnostic hub where agents report work, humans track progress, and nothing gets lost. Agents use a CLI to report status, log tasks, capture ideas, and declare habits — regardless of which framework they run on. Humans get a clean dashboard showing the full picture: fleet status, tasks, projects, costs, and notifications.

## Features

- **Fleet Overview** — Agent card grid with live status, fleet-wide stats, and quick-add idea widget
- **Agent Profiles** — Dense cockpit per agent: identity, knowledge, skills, habits, tasks, and token usage
- **Tasks & Projects** — Full lifecycle tracking with priorities, milestones, PRDs, and artifact logging
- **Ideas** — Capture layer for thoughts from agents or humans, with one-click promotion to projects
- **Habits** — Recurring agent behaviors: heartbeats, schedules, cron jobs, hooks, watchdogs, and polling
- **Token & Cost Analytics** — Per-agent, per-model, and per-project spend tracking with charts
- **Notifications** — In-dashboard alerts for task completions, missed heartbeats, and milestone events
- **CLI-first** — Agents interact via `clawops` commands as tools with local package execution over SQLite

## Architecture

Turborepo + pnpm workspaces monorepo. Business logic lives in `packages/` as independent TypeScript libraries. Applications in `apps/` consume those libraries directly.

| Package / App | Responsibility |
|---|---|
| `apps/cli` | Commander.js CLI binary (`clawops`) — local package mode |
| `apps/web` | Next.js 15 App Router dashboard — shadcn/ui + Tailwind CSS |
| `packages/core` | DB connection, Drizzle ORM schema, migrations, shared config |
| `packages/agents` | Agent CRUD, status management, skill/memory handling |
| `packages/tasks` | Task CRUD, completion logging, artifact management |
| `packages/projects` | Project CRUD, milestone management, PRD handling |
| `packages/ideas` | Idea CRUD, idea-to-project promotion logic |
| `packages/habits` | Habit CRUD, habit run logging, heartbeat handling |
| `packages/analytics` | Usage log ingestion, cost calculation, aggregation queries |
| `packages/notifications` | Notification creation, delivery, read state management |
| `packages/domain` | Domain models and types |
| `packages/sync` | OpenClaw sync adapter |

## Quick Start

### Production Install (Recommended)

```bash
git clone https://github.com/hishamank/clawops.git
cd clawops
./install.sh
```

The install script will:
- Check Node.js (>=18) and pnpm are installed
- Install all dependencies (`pnpm install --frozen-lockfile`)
- Build all packages
- Run database migrations
- Check port availability for web (3333)
- Generate `.env` with web/db config
- Link the CLI globally
- Verify `clawops --version`

After install, run `clawops onboard` to connect to OpenClaw.

### Manual Install

**Prerequisites:**
- **Node.js** 18+
- **pnpm** 9+

```bash
pnpm install
pnpm build
pnpm --filter @clawops/core db:migrate
cd apps/cli && pnpm link --global && cd ../..
clawops --version
```

### Docker

```bash
cp .env.example .env
docker-compose up --build
```

This starts:
- **Web dashboard** on `http://localhost:3333`

Data is persisted via a Docker volume at `/data/clawops.db`.

## Connecting to OpenClaw

Use `clawops onboard` to interactively connect ClawOps to your OpenClaw setup:

```bash
clawops onboard
```

This will:
1. Prompt for your OpenClaw directory (default: `~/.openclaw`)
2. Scan for agents and workspaces
3. Install the ClawOps skill (`SKILL.md`) into each agent workspace
4. Optionally start the dashboard
5. Optionally install system services (systemd/launchd)

For non-interactive use (CI/scripting):

```bash
clawops onboard --all --json
```

## Re-syncing

After onboarding, use `clawops sync` to keep ClawOps in sync with OpenClaw:

```bash
# Basic sync — detect new/removed agents, install missing skills
clawops sync

# With gateway data (cron jobs, live sessions)
clawops sync --gateway-token YOUR_TOKEN

# JSON output for scripting
clawops sync --json
```

Exit codes: `0` = changes made, `1` = error, `2` = nothing changed.

## CLI Commands

The `clawops` CLI is the primary interface between agent frameworks and ClawOps. Every command supports `--json` for machine-readable output.

### Agent

```bash
clawops agent init --name "Jax" --model "claude-opus-4-6" --role "orchestrator" --framework openclaw
clawops agent status set busy --message "reviewing PRD"
clawops agent skills set "task_create,idea_add,web_search,file_read"
clawops agent heartbeat
```

### Task

```bash
clawops task create --title "Review onboarding flow" --priority high --project <id> --assignee self
clawops task list --status todo --assignee self --json
clawops task update <id> --status in-progress
clawops task done <id> --summary "reviewed and approved" --tokens 1240 --artifacts "report.md,pr#42"
```

### Idea

```bash
clawops idea add "Redesign onboarding flow" --desc "..." --tags "ux,frontend"
clawops idea list --status raw --json
```

### Project

```bash
clawops project create --name "Portfolio Redesign" --status planning
clawops project list --json
clawops project info <id>
```

### Habit

```bash
clawops habit register "morning briefing" --type scheduled --schedule "0 8 * * *"
clawops habit register "stay alive" --type heartbeat --interval 300
clawops habit run <id> --note "completed morning standup"
```

### Onboard

```bash
clawops onboard                          # Interactive setup
clawops onboard --all --json             # Non-interactive
clawops onboard --dry-run                # Preview changes
```

### Sync

```bash
clawops sync                             # Detect changes, install skills
clawops sync --gateway-token TOKEN       # Include gateway data
clawops sync --reinstall-skills          # Force reinstall
clawops sync --json                      # JSON output
```

## Configuration

| Variable | Description | Default |
|---|---|---|
| `CLAWOPS_MODE` | Local package execution mode | `local` |
| `CLAWOPS_AGENT_ID` | Agent identifier (used by CLI to tag tasks/ideas to this agent) | — |
| `CLAWOPS_DB_PATH` | SQLite database path | `./clawops.db` |
| `WEB_PORT` | Web dashboard port | `3333` |
| `OPENCLAW_DIR` | OpenClaw directory path | `~/.openclaw` |
| `OPENCLAW_GATEWAY_URL` | OpenClaw gateway URL | `http://localhost:3000` |
| `OPENCLAW_GATEWAY_TOKEN` | Gateway auth token | — |

## API Endpoints (Next Route Handlers)

```
GET  /api/health
POST /api/auth/login
POST /api/auth/logout
POST /api/agents/register
GET  /api/agents
GET  /api/agents/:id
PATCH /api/agents/:id/status
PATCH /api/agents/:id/skills
POST /api/agents/:id/heartbeat
POST /api/tasks
GET  /api/tasks
GET  /api/tasks/:id
PATCH /api/tasks/:id
POST /api/tasks/:id/complete
POST /api/ideas
GET  /api/ideas
POST /api/ideas/:id/promote
POST /api/projects
GET  /api/projects
GET  /api/projects/:id
PATCH /api/projects/:id
POST /api/habits
GET  /api/habits
POST /api/habits/:id/run
GET  /api/analytics/tokens
GET  /api/analytics/costs
GET  /api/notifications
PATCH /api/notifications/:id
PATCH /api/notifications/read-all
POST /api/sync/openclaw
GET  /api/sync/openclaw
POST /api/sync/openclaw/install-skill
```

## Production Deployment

### Using PM2 (Recommended)

PM2 provides process management with auto-restart, log rotation, and easy deployment commands.

```bash
# Install PM2 globally
npm install -g pm2

# Deploy and start the web app
./scripts/deploy-web.sh

# View status
pm2 status clawops-web

# View logs
pm2 logs clawops-web

# Stop
pm2 stop clawops-web

# Restart after code changes
./scripts/deploy-web.sh
```

### Using systemd

For systems with systemd, use the provided service template:

1. Copy `scripts/clawops-web.service` to `/etc/systemd/system/`
2. Edit the file and replace placeholders:
   - `%USER%` → your username
   - `%PROJECT_ROOT%` → absolute path to project root
3. Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable clawops-web
sudo systemctl start clawops-web
sudo systemctl status clawops-web
```

### Manual Start

```bash
# Build
pnpm build --filter @clawops/web

# Start standalone server
cd apps/web/.next/standalone
node server.js
```

## Development

### Run Tests

```bash
pnpm test
```

### Typecheck

```bash
pnpm typecheck
```

### Lint

```bash
pnpm lint
```

## License

[MIT](LICENSE)
