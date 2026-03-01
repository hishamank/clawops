<p align="center">
  <h1 align="center">ClawOps</h1>
  <p align="center">Monitor, manage, and orchestrate your AI agents from a single control plane.</p>
</p>

<p align="center">
  <a href="https://github.com/hishamank/clawops/actions"><img src="https://img.shields.io/github/actions/workflow/status/hishamank/clawops/ci.yml?branch=main&style=flat-square" alt="Build Status"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License"></a>
  <a href="https://github.com/hishamank/clawops/releases"><img src="https://img.shields.io/badge/version-0.1.0-green?style=flat-square" alt="Version"></a>
</p>

---

## Architecture

```
                         ┌──────────────────────────┐
                         │       ClawOps CLI         │
                         │    $ clawops agent ...    │
                         │    $ clawops runs list    │
                         └────────────┬─────────────┘
                                      │ HTTP
                                      ▼
┌─────────────────────┐    ┌──────────────────────────┐    ┌──────────────────┐
│   ClawOps Web UI    │───▶│     ClawOps API          │◀──▶│     SQLite       │
│   Next.js 15        │    │     Fastify + Drizzle    │    │   (clawops.db)   │
│   :3000             │    │     :3001                │    └──────────────────┘
└─────────────────────┘    └──────────────────────────┘
```

## What is ClawOps?

ClawOps is an open-source agent operations platform. It provides a REST API, web dashboard, and CLI for registering AI agents, launching task runs, and tracking their status in real time. Built as a TypeScript monorepo with Fastify, Next.js 15, and SQLite.

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/hishamank/clawops.git && cd clawops

# 2. Install dependencies
pnpm install

# 3. Set up the database
pnpm --filter @clawops/api db:push

# 4. Start all services in development mode
pnpm dev

# 5. Open the dashboard
open http://localhost:3000
```

## CLI Usage

```bash
# Register an agent
$ clawops agent register --name "doc-processor"
✓ Agent registered successfully
  ID:     a1b2c3d4-e5f6-7890-abcd-ef1234567890
  Name:   doc-processor
  Status: offline

# Set agent online
$ clawops agent status --id a1b2c3d4 --status online
✓ Agent a1b2c3d4 status → online

# Start a run
$ clawops run start --agent a1b2c3d4 --task "Process Q4 reports"
✓ Run started
  Run ID: f9e8d7c6-b5a4-3210-fedc-ba0987654321
  Agent:  a1b2c3d4-e5f6-7890-abcd-ef1234567890
  Task:   Process Q4 reports
  Status: running

# List runs (table output)
$ clawops runs list
Found 3 run(s)

┌──────────┬──────────┬──────────────────────┬───────────┬─────────────────────┬──────────┐
│ ID       │ Agent    │ Task                 │ Status    │ Started             │ Duration │
├──────────┼──────────┼──────────────────────┼───────────┼─────────────────────┼──────────┤
│ f9e8d7c6 │ a1b2c3d4 │ Process Q4 reports   │ running   │ 3/1/2026, 10:00 AM  │ 12s      │
│ 11223344 │ a1b2c3d4 │ Analyze user data    │ completed │ 3/1/2026, 9:30 AM   │ 2m 15s   │
│ 55667788 │ bbccddee │ Generate summaries   │ failed    │ 3/1/2026, 9:00 AM   │ 45s      │
└──────────┴──────────┴──────────────────────┴───────────┴─────────────────────┴──────────┘

# Finish a run
$ clawops run finish --id f9e8d7c6 --output "Processed 42 documents"
✓ Run f9e8d7c6 finished — completed

# JSON output for scripting
$ clawops runs list --json
[{"id":"f9e8d7c6-...","agentId":"a1b2c3d4-...","task":"Process Q4 reports",...}]

# Configure API endpoint
$ clawops config set --api-url https://clawops.example.com
✓ Configuration saved
  API URL: https://clawops.example.com

$ clawops config get
ClawOps Configuration
  API URL: https://clawops.example.com
  (from ~/.clawops/config.json)
```

## API Endpoints

| Method  | Endpoint              | Description              |
|---------|-----------------------|--------------------------|
| `GET`   | `/health`             | Health check             |
| `GET`   | `/api/agents`         | List all agents          |
| `POST`  | `/api/agents`         | Register a new agent     |
| `PATCH` | `/api/agents/:id`     | Update agent status      |
| `GET`   | `/api/runs`           | List runs (filterable)   |
| `POST`  | `/api/runs`           | Start a new run          |
| `PATCH` | `/api/runs/:id`       | Update / finish a run    |
| `GET`   | `/api/agents/:id/runs`| List runs for an agent   |

## Docker Setup

```bash
# Build and run with Docker Compose
docker compose up -d

# Or build individual images
docker build -t clawops-api -f packages/api/Dockerfile .
docker build -t clawops-web -f packages/web/Dockerfile .
```

| Service | Port | Description        |
|---------|------|--------------------|
| `api`   | 3001 | REST API server    |
| `web`   | 3000 | Dashboard UI       |

## Packages

| Package          | Description                              |
|------------------|------------------------------------------|
| `@clawops/api`   | Fastify REST API + Drizzle ORM + SQLite  |
| `@clawops/web`   | Next.js 15 dashboard with Tailwind v4    |
| `@clawops/cli`   | CLI tool (`clawops`)                     |

## Development

```bash
pnpm dev          # Start all packages in dev mode
pnpm build        # Build all packages
pnpm lint         # Lint all packages
pnpm typecheck    # Type-check all packages
```

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Commit your changes (`git commit -m 'feat: add my feature'`)
4. Push to the branch (`git push origin feat/my-feature`)
5. Open a Pull Request

Please use [conventional commits](https://www.conventionalcommits.org/) for commit messages.

## License

[MIT](LICENSE) &copy; 2026 hishamank
