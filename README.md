# 🐾 ClawOps

> **The calm operations layer above autonomous AI systems**

[![Node](https://img.shields.io/badge/node-22%2B-brightgreen)](https://nodejs.org/)
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

## Quick Start

### Prerequisites

- **Node.js** 22+
- **pnpm** 9+

### Install & Run

```bash
# Install dependencies
pnpm install

# Build all packages and apps
pnpm turbo build

# Start development servers (API on :3001, Web on :3000)
pnpm turbo dev
```

## Docker

```bash
# Copy and configure environment
cp .env.example .env   # fill in CLAWOPS_API_KEY

# Start all services
docker-compose up --build
```

This starts:
- **API** on `http://localhost:3001`
- **Web dashboard** on `http://localhost:3000`

Data is persisted via a Docker volume at `/data/clawops.db`.

## CLI Usage

The `clawops` CLI is the primary interface between agent frameworks and ClawOps. Every command supports `--json` for machine-readable output.

### Agent Commands

```bash
# Register or update an agent
clawops agent init --name "Jax" --model "claude-opus-4-6" --role "orchestrator" --framework openclaw

# Set agent status
clawops agent status set busy --message "reviewing PRD"

# Declare skills
clawops agent skills set "task_create,idea_add,web_search,file_read"

# Send heartbeat
clawops agent heartbeat
```

### Task Commands

```bash
# Create a task
clawops task create --title "Review onboarding flow" --priority high --project <id> --assignee self

# List tasks
clawops task list --status todo --assignee self --json

# Update status
clawops task update <id> --status in-progress

# Complete a task
clawops task done <id> --summary "reviewed and approved" --tokens 1240 --artifacts "report.md,pr#42"
```

### Idea Commands

```bash
# Capture an idea
clawops idea add "Redesign onboarding flow" --desc "..." --tags "ux,frontend"

# List ideas
clawops idea list --status raw --json
```

### Project Commands

```bash
# Create a project
clawops project create --name "Portfolio Redesign" --status planning

# List projects
clawops project list --json

# View project details
clawops project info <id>
```

### Habit Commands

```bash
# Register a scheduled habit
clawops habit register "morning briefing" --type scheduled --schedule "0 8 * * *"

# Register a heartbeat
clawops habit register "stay alive" --type heartbeat --interval 300

# Log a habit run
clawops habit run <id> --note "completed morning standup"
```

## Configuration

| Variable | Description | Default |
|---|---|---|
| `CLAWOPS_MODE` | `local` (direct SQLite) or `remote` (calls API) | `local` |
| `CLAWOPS_API_KEY` | API key for authentication | — |
| `CLAWOPS_API_URL` | API server URL (required in remote mode) | `http://localhost:3001` |
| `CLAWOPS_AGENT_ID` | Agent identifier (used by CLI to tag tasks/ideas to this agent) | — |
| `CLAWOPS_DB_PATH` | SQLite database path (local mode only) | `./clawops.db` |
| `PORT` | API server port | `3001` |

## Development

### Add a Package

```bash
mkdir packages/my-package
cd packages/my-package
pnpm init
# Add to pnpm-workspace.yaml automatically via packages/* glob
```

### Run Tests

```bash
pnpm test
```

### Typecheck

```bash
pnpm turbo typecheck
```

### Lint

```bash
pnpm turbo lint
```

## License

[MIT](LICENSE)
