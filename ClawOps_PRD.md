

| ClawOps *Product Requirements Document* v0.1 — MVP |
| :---: |

*The framework-agnostic operations layer for AI agent teams*

| Status | Draft |
| :---- | :---- |
| **Version** | 0.1.0 |
| **Date** | March 2026 |
| **Author** | Hich |
| **License** | Open Source (MIT) |

| 01  Vision & Positioning |
| :---- |

| *ClawOps is the operations layer for AI agent teams — a framework-agnostic hub where agents report work, humans track progress, and nothing gets lost.* |
| :---- |

## **The Problem**

Running a multi-agent setup today means flying blind. Agents are doing work, consuming tokens, forming ideas, executing tasks — and none of it is visible in one place. Conversations end, context is lost, and there's no way to know what your fleet is doing, what it costs, or what it's capable of.

## **The Solution**

ClawOps gives every agent a reporting layer and every human a control panel. Agents use the CLI to report status, log tasks, capture ideas, and declare habits — regardless of which framework they run on. Humans get a clean, friendly dashboard that shows the full picture.

## **What Makes It Different**

* Framework-agnostic — works with OpenClaw, NullClaw, NanoClaw, or any agent with shell access

* CLI-first agent interface — agents call clawops commands as tools, the same way they call any shell utility

* Rich agent profiles — every agent has identity, skills, habits, memory, and performance visible at a glance

* Not a DevOps tool — designed to be friendly and readable for any human, not just developers

* Embeddable — the business logic is a library, not just an API; frameworks can embed it directly

## **Primary Users**

| User | Description |
| :---- | :---- |
| **Human operator** | Solo person managing an AI agent fleet. Wants to see what agents are doing, manage tasks and projects, capture ideas, and monitor costs. Does not need to be technical. |
| **Agent (CLI caller)** | An AI agent running in OpenClaw, NullClaw, NanoClaw, or similar. Calls clawops commands as tools during its operation. |
| **Script / CI-CD** | Automation scripts that interact with the ClawOps API or CLI to manage agent lifecycle programmatically. |

| 02  Architecture |
| :---- |

## **Monorepo Structure**

ClawOps uses a Turborepo \+ pnpm workspaces monorepo. Business logic lives in packages/ as independent TypeScript libraries. Applications in apps/ consume those libraries directly.

| Package / App | Responsibility |
| :---- | :---- |
| **apps/cli** | Commander.js CLI binary (clawops). Runs in local mode (direct DB/package access). |
| **apps/web** | Next.js 14+ App Router dashboard. Calls API. shadcn/ui \+ Tailwind CSS. |
| **packages/core** | DB connection, Drizzle schema, migrations, shared config. |
| **packages/agents** | Agent CRUD, status management, skill/memory handling. |
| **packages/tasks** | Task CRUD, completion logging, artifact management. |
| **packages/projects** | Project CRUD, milestone management, PRD handling. |
| **packages/ideas** | Idea CRUD, idea-to-project promotion logic. |
| **packages/habits** | Habit CRUD, habit run logging, heartbeat handling. |
| **packages/analytics** | Usage log ingestion, cost calculation, aggregation queries. |
| **packages/notifications** | Notification creation, delivery, read state management. |
| **packages/shared** | TypeScript types, constants, model pricing table, utils. |

## **CLI Mode**

The CLI operates in local mode, configured via environment variables:

* local mode (CLAWOPS\_MODE=local) — CLI imports packages directly and writes to SQLite. Best for home server setups where CLI and DB are on the same machine.

***Environment Variables***

CLAWOPS\_MODE=local

CLAWOPS\_DB\_PATH=./clawops.db

## **Auth Model**

* API keys only — one auth system, simple and consistent

* Each agent gets its own API key on registration

* Web dashboard uses a session cookie backed by the same API key mechanism

* CLAWOPS\_API\_KEY env var is how both CLI and agents authenticate

## **Data Flow**

| Agent → ClawOps | Agent calls clawops CLI as a tool → CLI writes directly to DB |
| :---- | :---- |
| **Human → ClawOps** | Human uses web dashboard → Next route handlers + package logic write to DB |
| **ClawOps → Human** | Dashboard polls API → renders live state → notifications on events |

| 03  Data Model |
| :---- |

| Table | Fields | Purpose |
| :---- | :---- | :---- |
| **agents** | id, name, model, role, status, lastActive, avatar, framework, apiKey, memoryPath, skills (json\[\]), createdAt | Core agent identity and capabilities |
| **habits** | id, agentId, name, type, schedule, cronExpr, trigger, status, lastRun, nextRun, createdAt | Recurring agent behaviors by type |
| **habitRuns** | id, habitId, agentId, ranAt, success (bool), note | Individual execution log for each habit |
| **projects** | id, name, description, status, ideaId?, prd (text), prdUpdatedAt, createdAt | Project container with PRD and milestone support |
| **milestones** | id, projectId, title, status, order, createdAt | Ordered checkpoints within a project |
| **tasks** | id, title, description, status, priority, assigneeId?, projectId?, source, dueDate, completedAt, summary, createdAt | Work items with full lifecycle tracking |
| **artifacts** | id, taskId, label, value (url/path/text), createdAt | Outputs produced when a task is completed |
| **ideas** | id, title, description, status, tags (json\[\]), projectId?, source, createdAt | Captured ideas from human or agent |
| **usageLogs** | id, agentId, taskId?, model, tokensIn, tokensOut, cost, createdAt | Token and cost data per task completion |
| **events** | id, agentId?, action, entityType, entityId, meta (json), createdAt | Append-only audit trail of all operations |
| **notifications** | id, type, title, body, entityType, entityId, read, createdAt | In-dashboard notification records |

| 04  Feature Modules |
| :---- |

## **4.1 — Fleet Overview (Home)**

The entry point of the dashboard. One screen showing the full agent fleet at a glance.

**WHAT YOU SEE**

* Agent card grid — name, avatar, model, framework badge, live status dot, last active timestamp

* Fleet-wide stats bar — total tasks today, active agents, ideas in queue, monthly spend

* Quick-add idea button — accessible from any page via keyboard shortcut

* Click any agent card → opens full Agent Profile

## **4.2 — Agent Profile**

A dense, single-screen cockpit for one agent. Everything meaningful visible without scrolling.

**IDENTITY STRIP (TOP)**

* Name, role, model, framework badge, avatar, live status dot, last active

**KNOWLEDGE PANEL — READS AGENT MEMORY FILES**

* Reads markdown files from memoryPath directory (IDENTITY.md, SOUL.md, any .md)

* Parses and displays as readable fact snippets with source file label

* Human can add, edit, or remove facts directly from the UI — writes back to file

**SKILLS & TOOLS PANEL**

* Displays skills/tools the agent declared on init, shown as tags

* Read-only — source of truth is the agent framework (pushed via CLI on init)

**HABITS PANEL**

* Each habit shows: name, type badge, schedule/trigger expression, last run, 7-day streak dots

* Missed runs shown in red, successful runs in green, no data in grey

**RECENT TASKS PANEL**

* Last 10 tasks with status icon, tokens used, and relative timestamp

* Completion rate % calculated over last 30 days

**TOKEN USAGE PANEL**

* This month's spend in dollars, bar chart vs last month

* Small daily sparkline

***CLI commands***

clawops agent init \--name "Jax" \--model "claude-opus-4-6" \--role "orchestrator" \--framework openclaw

clawops agent skills set "task\_create,idea\_add,web\_search,file\_read"

clawops agent status set busy \--message "reviewing Hix PRD"

## **4.3 — Tasks**

The operational heartbeat of the system. Where all agent and human work gets tracked.

**FIELDS**

* title, description, status, priority, assignee (agent), project, due date

* source — where the task originated: human | agent | cli | script

* On completion: summary (text), tokens used, artifacts (linked records)

**STATUS FLOW**

| backlog | todo | in-progress | review | done | cancelled |
| :---: | :---: | :---: | :---: | :---: | :---: |

**PRIORITY LEVELS**

* low · medium · high · urgent

**ARTIFACTS**

* A completed task can have multiple artifacts — each with a label and value (URL, file path, or text)

* Stored in a separate artifacts table linked to the task

***CLI commands***

clawops task create \--title "..." \--priority high \--project \<id\> \--assignee self

clawops task list \--status todo \--assignee self \--json

clawops task update \<id\> \--status in-progress

clawops task done \<id\> \--summary "reviewed and approved" \--tokens 1240 \--artifacts "report.md,pr\#42"

## **4.4 — Ideas**

The capture layer. Any thought that surfaces — from an agent mid-conversation or a human at the dashboard — lands here before it disappears.

**STATUS FLOW**

* raw → reviewed → promoted → archived

**SOURCES**

* Agent captures mid-conversation: clawops idea add

* Human types directly into the dashboard quick-add widget (keyboard shortcut)

**PROMOTE TO PROJECT**

* One-click conversion from idea to project

* Carries over: title, description, tags → project name, description, initial status

* Original idea record links to the created project via projectId

***CLI commands***

clawops idea add "Redesign Hix onboarding flow" \--desc "..." \--tags "ux,hix"

clawops idea list \--status raw \--json

## **4.5 — Projects**

The container that gives structure to work. Links tasks, milestones, and a PRD into one coherent unit.

**STATUS FLOW**

* planning → active → paused → done

**PRD FIELD**

* Full markdown editor in the web UI

* Stored as text in the projects table with a prdUpdatedAt timestamp

* Version history not in v0.1 — prdUpdatedAt enables future versioning

**MILESTONES**

* Ordered list of checkpoints, each with a title and completion status

* Reorderable in the dashboard

**PROGRESS TRACKING**

* Auto-calculated from linked tasks: completed / total tasks %

* Shown as a progress bar on project cards

***CLI commands***

clawops project create \--name "Hix Portfolio" \--status planning

clawops project list \--json

clawops project info \<id\>

## **4.6 — Habits**

What each agent does on a regular basis. Habits give visibility into the agent's operational rhythm — not one-off tasks, but recurring behaviors that define how it works.

**HABIT TYPES**

| Type | Trigger | Description |
| :---- | :---- | :---- |
| **heartbeat** | Interval ping | Agent reports "I'm alive" every N minutes. Missed heartbeat triggers a notification. |
| **scheduled** | Fixed time | Runs at a human-readable time ("daily at 8am"). Best for morning briefings, standup reports. |
| **cron** | Cron expression | Runs on a cron schedule (0 8 \* \* 1-5). Power-user version of scheduled. |
| **hook** | Event-driven | Fires when a ClawOps event occurs (task created, idea added, project status changed). |
| **watchdog** | Condition monitor | Monitors a condition and fires if a threshold is breached (disk full, agent silent \> 1h). |
| **polling** | External check | Checks an external source on an interval (new emails, GitHub PRs, API endpoints). |

**HABIT RUN LOG**

* Every habit execution logs a habitRun record with timestamp, success bool, and optional note

* 7-day streak heatmap shown on Agent Profile — green (ran), red (missed), grey (no data)

**WHO CREATES HABITS**

* Human creates habits from the dashboard (for any agent)

* Agent registers its own habits via CLI on startup (self-declaring its operational patterns)

***CLI commands***

clawops habit register "morning briefing" \--type scheduled \--schedule "0 8 \* \* \*"

clawops habit register "stay alive" \--type heartbeat \--interval 300

clawops habit run \<id\> \--note "completed morning standup"

clawops agent heartbeat  \# shortcut — auto-logs heartbeat habit run

## **4.7 — Token & Cost Analytics**

Full visibility into what your agent fleet is spending. Every task completion logs token and cost data. Nothing is estimated after the fact.

**DATA CAPTURED PER TASK COMPLETION**

* agentId, model, tokensIn, tokensOut, cost (calculated from model pricing table), timestamp

**ANALYTICS VIEWS**

* Total all-time spend

* Per agent — who is spending the most

* Per model — which models are being used

* Per project — which projects are expensive

* Time ranges: daily · weekly · monthly

**CHARTS ON THE ANALYTICS PAGE**

* Spend over time — line chart, switchable between daily/weekly/monthly

* Per-agent breakdown — horizontal bar chart

* Model distribution — donut chart

* Top projects by cost — ranked list

**MODEL PRICING TABLE**

* Configurable in Settings — store $/1M token prices per model

* Ollama/local models default to $0

* Used to calculate cost on every usageLog write

## **4.8 — Notifications**

In-dashboard notifications. A bell icon with unread count. No external delivery in v0.1.

**NOTIFICATION TRIGGERS**

* Agent completes a task — task title \+ summary

* Agent adds an idea mid-conversation

* Project milestone reached

* Habit missed (especially heartbeat — agent may have crashed)

* Agent goes offline (no heartbeat for \> configured threshold)

**UI**

* Bell icon in top navigation with red unread count badge

* Dropdown shows last 10 notifications

* Mark as read individually or clear all

* Notification log page shows full history (last 30 days)

## **4.9 — Events Log**

An append-only audit trail. Written automatically on every CLI call and API mutation. No UI in v0.1 — the table exists and fills in the background, ready for the v0.2 activity feed.

**WRITTEN AUTOMATICALLY FOR**

* Every clawops CLI call

* Every API mutation (create, update, delete, complete)

* Agent status changes

**SCHEMA**

events → id, agentId?, action, entityType, entityId, meta (json), createdAt

## **4.10 — CLI (clawops)**

The primary interface between agent frameworks and ClawOps. Designed to be used as a tool definition in any agent framework that supports shell access.

**DESIGN PRINCIPLES**

* \--json flag on every command — clean machine-readable output for agent parsing

* Minimal stdout by default — just IDs and status confirmations

* Idempotent init — safe to call clawops agent init on every agent startup

* Fast — sub-100ms response time for local mode

* Self-documenting — clawops \--help and clawops \<command\> \--help always work

**FULL COMMAND REFERENCE**

***Agent commands***

clawops agent init \--name \<n\> \--model \<m\> \--role \<r\> \--framework \<f\>

clawops agent status set \<online|idle|busy|offline\> \[--message \<msg\>\]

clawops agent skills set "skill1,skill2,skill3"

clawops agent heartbeat

***Task commands***

clawops task create \--title \<t\> \[--desc \<d\>\] \[--priority \<p\>\] \[--project \<id\>\] \[--assignee self|\<id\>\]

clawops task list \[--status \<s\>\] \[--assignee \<id\>\] \[--project \<id\>\] \[--json\]

clawops task update \<id\> \--status \<s\> \[--priority \<p\>\]

clawops task done \<id\> \--summary \<s\> \[--tokens \<n\>\] \[--artifacts "label:value,..."\]

***Idea commands***

clawops idea add \<title\> \[--desc \<d\>\] \[--tags "tag1,tag2"\]

clawops idea list \[--status \<s\>\] \[--tag \<t\>\] \[--json\]

***Project commands***

clawops project create \--name \<n\> \[--status planning\]

clawops project list \[--json\]

clawops project info \<id\>

***Habit commands***

clawops habit register \<name\> \--type \<type\> \[--schedule \<cron\>\] \[--interval \<seconds\>\]

clawops habit run \<id\> \[--note \<n\>\] \[--success true|false\]

clawops habit list \[--agent self\] \[--json\]

| 05  Web Dashboard |
| :---- |

| *Design principle: ClawOps is not an ops console. It should be friendly and readable for any human. Clean, minimal, informative — not intimidating.* |
| :---- |

## **Pages**

| Page | Purpose |
| :---- | :---- |
| **/ (Fleet Overview)** | Agent card grid, fleet stats bar, quick-add idea. Entry point. |
| **/agents/:id** | Full agent profile cockpit — identity, knowledge, skills, habits, tasks, tokens. |
| **/tasks** | List view with filters by agent, status, priority, project. Create/edit modal. |
| **/projects** | Project cards with progress bars. Click → milestones \+ PRD editor \+ linked tasks. |
| **/ideas** | Card grid. Filter by tag and status. Promote to project button. |
| **/analytics** | Token and cost charts. Time range picker. Per-agent, per-model, per-project views. |
| **/notifications** | Full notification log with read/unread state. |
| **/settings** | Manage API keys, model pricing table, agent memory paths. |

## **Tech**

* Next.js 14+ with App Router

* shadcn/ui component library

* Tailwind CSS for styling

* Polling for live updates (no WebSocket in v0.1)

* Session cookie auth backed by API key

| 06  Tech Stack |
| :---- |

| Layer | Technology |
| :---- | :---- |
| **Monorepo** | Turborepo \+ pnpm workspaces |
| **Language** | TypeScript everywhere — all apps and packages |
| **API Framework** | Next.js Route Handlers with Zod validation |
| **ORM** | Drizzle ORM — type-safe, lightweight |
| **Database** | SQLite via better-sqlite3, WAL mode enabled |
| **Web Framework** | Next.js 14+ with App Router |
| **UI Components** | shadcn/ui |
| **Styling** | Tailwind CSS |
| **CLI** | Commander.js |
| **Auth** | API keys (agents/CLI) \+ session cookie (web) |
| **Containerization** | Docker \+ docker-compose.yml, SQLite volume mount |
| **Docs** | Static API docs page in web (`/docs/api`) backed by shared schemas/examples |

| 07  Out of Scope — v0.1 |
| :---- |

The following are deliberately excluded from v0.1. They are valid future features but should not block the MVP.

* Budget alerts and spending limits

* Kanban / board view (list view only for tasks)

* Real-time WebSocket updates (polling is sufficient for v0.1)

* Multi-user / team access control

* Discord, Slack, or webhook integrations

* Agent chat UI

* Activity feed UI (events table exists, no UI surface)

* PRD version history

* Mobile-optimized web UI

* Native desktop app
