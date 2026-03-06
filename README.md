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
- **CLI-first** — Agents interact via `clawops` commands as tools; supports local (SQLite) and remote (API) modes

## Architecture

Turborepo + pnpm workspaces monorepo. Business logic lives in `packages/` as independent TypeScript libraries. Applications in `apps/` consume those libraries directly.

| Package / App | Responsibility |
|---|---|
| `apps/api` | Fastify HTTP server with REST endpoints + OpenAPI docs |
| `apps/cli` | Commander.js CLI binary (`clawops`) — local or remote mode |
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
- Check port availability for web (3333) and API (4444)
- Generate `.env` with API key and port config
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
cp .env.example .env   # fill in CLAWOPS_API_KEY
docker-compose up --build
```

This starts:
- **API** on `http://localhost:4444`
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
| `CLAWOPS_MODE` | `local` (direct SQLite) or `remote` (calls API) | `local` |
| `CLAWOPS_API_KEY` | API key for authentication | — |
| `CLAWOPS_API_URL` | API server URL (required in remote mode) | `http://localhost:4444` |
| `CLAWOPS_AGENT_ID` | Agent identifier (used by CLI to tag tasks/ideas to this agent) | — |
| `CLAWOPS_DB_PATH` | SQLite database path | `./clawops.db` |
| `WEB_PORT` | Web dashboard port | `3333` |
| `API_PORT` | API server port | `4444` |
| `OPENCLAW_DIR` | OpenClaw directory path | `~/.openclaw` |
| `OPENCLAW_GATEWAY_URL` | OpenClaw gateway URL | `http://localhost:3000` |
| `OPENCLAW_GATEWAY_TOKEN` | Gateway auth token | — |

## API Endpoints

```
POST /api/sync/openclaw             — Trigger a scan
GET  /api/sync/openclaw/status      — Last sync result
POST /api/sync/openclaw/install-skill — Install SKILL.md to workspaces
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
