# ClawOps v0.1

Agent operations dashboard — monitor, manage, and orchestrate your AI agents from a single control plane.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   ClawOps Monorepo                   │
├─────────────┬──────────────────┬────────────────────┤
│             │                  │                    │
│  packages/  │   packages/      │   packages/        │
│    cli      │     api          │     web            │
│             │                  │                    │
│  Commander  │  Fastify         │  Next.js 15        │
│  CLI tool   │  REST API        │  App Router        │
│             │  Drizzle ORM     │  shadcn/ui         │
│             │  SQLite          │  Tailwind v4       │
│             │                  │                    │
│  clawops    │  :3001           │  :3000             │
│  agent *    │  /api/agents     │  /                 │
│  run *      │  /api/runs       │  /agents           │
│             │  /health         │  /agents/[id]      │
│             │                  │  /runs             │
└──────┬──────┴────────┬─────────┴─────────┬──────────┘
       │               │                   │
       └───── HTTP ────┘                   │
                       └───── HTTP ────────┘
```

## Setup

```bash
# Install dependencies
pnpm install

# Generate database migrations
pnpm --filter @clawops/api db:generate

# Push database schema
pnpm --filter @clawops/api db:push

# Start all packages in dev mode
pnpm dev
```

## Packages

| Package | Description | Port |
|---------|-------------|------|
| `@clawops/api` | REST API server (Fastify + Drizzle + SQLite) | 3001 |
| `@clawops/web` | Dashboard UI (Next.js 15 + shadcn/ui) | 3000 |
| `@clawops/cli` | CLI tool (`clawops`) | — |

## CLI Usage

```bash
# Register an agent
clawops agent register --name "my-agent"

# Update agent status
clawops agent status --id <agent-id> --status online

# Start a run
clawops run start --agent <agent-id> --task "Process documents"

# Finish a run
clawops run finish --id <run-id> --output "Processed 42 documents"

# List runs
clawops runs list --agent <agent-id> --status completed
```

## Development

```bash
pnpm dev          # Start all packages
pnpm build        # Build all packages
pnpm lint         # Lint all packages
pnpm typecheck    # Type-check all packages
```

## License

MIT
