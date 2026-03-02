# ClawOps — Project Context

## What is ClawOps?

ClawOps is an open source, framework-agnostic **operations layer for AI agent teams**. Agents report work via a CLI tool. Humans manage everything via a web dashboard. Nothing gets lost.

Works with any agent framework that has shell access — OpenClaw, NullClaw, NanoClaw, or any custom agent. The CLI is the universal contract between ClawOps and any framework.

**Repo:** https://github.com/hishamank/clawops
**Version:** v0.1 MVP
**License:** MIT

---

## Monorepo Structure

Turborepo + pnpm workspaces. Business logic lives in `packages/` as independent TypeScript libraries. Apps in `apps/` consume those libraries directly.

```
clawops/
├── apps/
│   ├── api/           → Fastify REST API + OpenAPI/Swagger docs
│   ├── cli/           → Commander.js CLI binary (clawops)
│   └── web/           → Next.js App Router dashboard
├── packages/
│   ├── core/          → DB connection, Drizzle schema, migrations
│   ├── agents/        → Agent CRUD, status, skills, memory path handling
│   ├── tasks/         → Task CRUD, completion logging, artifact management
│   ├── projects/      → Project CRUD, milestones, PRD handling
│   ├── ideas/         → Idea CRUD, idea→project promotion logic
│   ├── habits/        → Habit CRUD, habit run logging, heartbeat handling
│   ├── analytics/     → Usage log ingestion, cost calculation, aggregations
│   ├── notifications/ → Notification creation, delivery, read state
│   └── shared/        → TypeScript types, constants, model pricing table, utils
├── docker-compose.yml
├── turbo.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .env.example
└── package.json
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Monorepo | Turborepo + pnpm workspaces |
| Language | TypeScript strict mode everywhere |
| API | Fastify + @fastify/swagger + @fastify/swagger-ui |
| ORM | Drizzle ORM |
| Database | SQLite via better-sqlite3, WAL mode |
| Web | Next.js (latest) App Router |
| UI Components | shadcn/ui |
| Styling | Tailwind CSS |
| CLI | Commander.js |
| Auth | API keys (agents + CLI) + session cookie (web) |
| Containers | Docker + docker-compose.yml |

---

## CLI Modes

The CLI operates in two modes:

- **local** (`CLAWOPS_MODE=local`) — imports packages directly, writes to SQLite. For same-machine setups.
- **remote** (`CLAWOPS_MODE=remote`) — makes HTTP calls to `apps/api`. For distributed setups.

```bash
CLAWOPS_MODE=local|remote
CLAWOPS_API_KEY=<key>           # required in both modes
CLAWOPS_API_URL=http://...      # required in remote mode only
CLAWOPS_DB_PATH=./clawops.db    # local mode only, defaults to ./clawops.db
```

---

## Auth

API keys only — no JWT. Each agent gets its own API key on registration. Web dashboard uses a session cookie backed by the same mechanism. API keys stored hashed, never plaintext.

---

## Full Data Model

```typescript
// packages/core/src/schema.ts

agents {
  id, name, model, role,
  status: 'online' | 'idle' | 'busy' | 'offline',
  lastActive, avatar, framework, apiKey,
  memoryPath,        // path to agent's memory files directory
  skills (json[]),   // declared tool/skill names
  createdAt
}

habits {
  id, agentId, name,
  type: 'heartbeat' | 'scheduled' | 'cron' | 'hook' | 'watchdog' | 'polling',
  schedule,          // human-readable e.g. "daily at 8am"
  cronExpr,          // cron expression e.g. "0 8 * * *"
  trigger,           // for hook type: event name that fires it
  status: 'active' | 'paused',
  lastRun, nextRun, createdAt
}

habitRuns {
  id, habitId, agentId, ranAt,
  success (bool), note
}

projects {
  id, name, description,
  status: 'planning' | 'active' | 'paused' | 'done',
  ideaId,            // nullable — set if promoted from an idea
  prd (text),        // full markdown PRD
  prdUpdatedAt, createdAt
}

milestones {
  id, projectId, title,
  status: 'pending' | 'done',
  order, createdAt
}

tasks {
  id, title, description,
  status: 'backlog' | 'todo' | 'in-progress' | 'review' | 'done' | 'cancelled',
  priority: 'low' | 'medium' | 'high' | 'urgent',
  assigneeId,        // nullable agentId
  projectId,         // nullable
  source: 'human' | 'agent' | 'cli' | 'script',
  dueDate, completedAt, summary, createdAt
}

artifacts {
  id, taskId, label, value,   // value = url / file path / text
  createdAt
}

ideas {
  id, title, description,
  status: 'raw' | 'reviewed' | 'promoted' | 'archived',
  tags (json[]),
  projectId,         // nullable — set after promotion
  source: 'human' | 'agent',
  createdAt
}

usageLogs {
  id, agentId,
  taskId,            // nullable
  model, tokensIn, tokensOut, cost,
  createdAt
}

events {
  id,
  agentId,           // nullable
  action, entityType, entityId,
  meta (json),
  createdAt
}

notifications {
  id, type, title, body,
  entityType, entityId,
  read (bool), createdAt
}
```

---

## API Routes (v0.1 target)

```
POST   /agents/register
GET    /agents
GET    /agents/:id
PATCH  /agents/:id/status
PATCH  /agents/:id/skills

POST   /tasks
GET    /tasks
GET    /tasks/:id
PATCH  /tasks/:id
POST   /tasks/:id/complete

POST   /ideas
GET    /ideas
POST   /ideas/:id/promote

POST   /projects
GET    /projects
GET    /projects/:id
PATCH  /projects/:id

POST   /habits
GET    /habits
POST   /habits/:id/run

GET    /analytics/tokens
GET    /analytics/costs

GET    /notifications
PATCH  /notifications/:id/read

POST   /auth/login
POST   /auth/logout
GET    /health
```

---

## CLI Commands (full reference)

```bash
# Agent
clawops agent init --name <n> --model <m> --role <r> --framework <f>
clawops agent status set <online|idle|busy|offline> [--message <msg>]
clawops agent skills set "skill1,skill2,skill3"
clawops agent heartbeat

# Tasks
clawops task create --title <t> [--desc <d>] [--priority <p>] [--project <id>] [--assignee self|<id>]
clawops task list [--status <s>] [--assignee <id>] [--project <id>] [--json]
clawops task update <id> --status <s> [--priority <p>]
clawops task done <id> --summary <s> [--tokens <n>] [--artifacts "label:value,..."]

# Ideas
clawops idea add "<title>" [--desc <d>] [--tags "tag1,tag2"]
clawops idea list [--status <s>] [--tag <t>] [--json]

# Projects
clawops project create --name <n> [--status planning]
clawops project list [--json]
clawops project info <id>

# Habits
clawops habit register "<n>" --type <type> [--schedule <cron>] [--interval <seconds>]
clawops habit run <id> [--note <n>] [--success true|false]
clawops habit list [--agent self] [--json]
```

All commands support `--json`. Default output is minimal. Every CLI call auto-writes an `events` row.

---

## Web Dashboard Pages

| Route | Description |
|---|---|
| `/` | Fleet overview — agent card grid, stats bar, quick-add idea button |
| `/agents/:id` | Agent profile — identity, knowledge, skills, habits, tasks, tokens all above the fold |
| `/tasks` | List view + filters, slide-over detail panel |
| `/projects` | Project cards + detail page with milestones + PRD markdown editor |
| `/ideas` | Card grid, promote-to-project button |
| `/analytics` | Token/cost charts — per agent, per model, per project, time ranges |
| `/notifications` | Notification log |
| `/settings` | API keys, model pricing table, agent memory paths |

---

## Coding Principles

- TypeScript strict mode — no `any`, use `unknown` and narrow
- Drizzle for all DB access — no raw SQL outside migrations
- Each `packages/*` is independently importable — no circular dependencies
- CLI: minimal stdout by default, full JSON with `--json`
- Every CLI call and API mutation auto-writes an `events` row
- `clawops agent init` is idempotent — safe to call on every agent startup
- API keys stored hashed — never returned in plaintext
- All route handlers validated with Zod schemas

---

## What's NOT in v0.1

- Budget alerts / spending limits
- Kanban board view (list only)
- Real-time WebSocket (polling is fine)
- Multi-user / team access
- Discord / Slack / webhook integrations
- Agent chat UI
- Activity feed UI (events table exists, no UI yet)
- PRD version history