# @clawops/api

REST API for ClawOps agent operations platform. Built with Fastify, Drizzle ORM, and SQLite.

## Setup

```bash
pnpm install
pnpm migrate     # run database migrations
pnpm dev         # start dev server (port 3001)
```

### Environment Variables

| Variable  | Default        | Description           |
| --------- | -------------- | --------------------- |
| `PORT`    | `3001`         | Server port           |
| `HOST`    | `0.0.0.0`     | Server bind address   |
| `DB_PATH` | `./clawops.db` | SQLite database path  |

## Endpoints

### Health Check

```
GET /health
```

Response `200`:
```json
{ "status": "ok", "timestamp": "2025-01-01T00:00:00.000Z" }
```

---

### Agents

#### List Agents

```
GET /api/agents
```

Response `200`:
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "my-agent",
    "status": "online",
    "lastSeen": "2025-01-01T00:00:00.000Z",
    "metadata": { "version": "1.0" }
  }
]
```

#### Create Agent

```
POST /api/agents
Content-Type: application/json
```

Request body:
```json
{
  "name": "my-agent",
  "metadata": { "version": "1.0" }
}
```

| Field      | Type   | Required | Description              |
| ---------- | ------ | -------- | ------------------------ |
| `name`     | string | yes      | Agent name (min 1 char)  |
| `metadata` | object | no       | Arbitrary key-value data |

Response `201`:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "my-agent",
  "status": "offline",
  "lastSeen": "2025-01-01T00:00:00.000Z",
  "metadata": { "version": "1.0" }
}
```

#### Update Agent

```
PATCH /api/agents/:id
Content-Type: application/json
```

Request body:
```json
{
  "status": "online",
  "metadata": { "version": "1.1" }
}
```

| Field      | Type   | Required | Description                          |
| ---------- | ------ | -------- | ------------------------------------ |
| `status`   | string | yes      | `"online"`, `"offline"`, or `"error"` |
| `metadata` | object | no       | Arbitrary key-value data             |

Response `200`:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "my-agent",
  "status": "online",
  "lastSeen": "2025-01-01T12:00:00.000Z",
  "metadata": { "version": "1.1" }
}
```

---

### Runs

#### List Runs

```
GET /api/runs
GET /api/runs?agent=<uuid>&status=<status>
```

Query parameters:

| Param    | Type   | Required | Description                                      |
| -------- | ------ | -------- | ------------------------------------------------ |
| `agent`  | uuid   | no       | Filter by agent ID                               |
| `status` | string | no       | `"pending"`, `"running"`, `"completed"`, `"failed"` |

Response `200`:
```json
[
  {
    "id": "660e8400-e29b-41d4-a716-446655440000",
    "agentId": "550e8400-e29b-41d4-a716-446655440000",
    "task": "deploy service",
    "status": "completed",
    "startedAt": "2025-01-01T00:00:00.000Z",
    "finishedAt": "2025-01-01T00:05:00.000Z",
    "output": "Deployed successfully",
    "error": null
  }
]
```

#### Create Run

```
POST /api/runs
Content-Type: application/json
```

Request body:
```json
{
  "agentId": "550e8400-e29b-41d4-a716-446655440000",
  "task": "deploy service"
}
```

| Field     | Type   | Required | Description                |
| --------- | ------ | -------- | -------------------------- |
| `agentId` | uuid   | yes      | ID of the agent to run on  |
| `task`    | string | yes      | Task description (min 1 char) |

Response `201`:
```json
{
  "id": "660e8400-e29b-41d4-a716-446655440000",
  "agentId": "550e8400-e29b-41d4-a716-446655440000",
  "task": "deploy service",
  "status": "running",
  "startedAt": "2025-01-01T00:00:00.000Z",
  "finishedAt": null,
  "output": null,
  "error": null
}
```

#### Update Run

```
PATCH /api/runs/:id
Content-Type: application/json
```

Request body:
```json
{
  "status": "completed",
  "output": "Deployed successfully"
}
```

| Field    | Type   | Required | Description                                      |
| -------- | ------ | -------- | ------------------------------------------------ |
| `status` | string | no       | `"pending"`, `"running"`, `"completed"`, `"failed"` |
| `output` | string | no       | Run output text                                  |
| `error`  | string | no       | Error message if failed                          |

`finishedAt` is set automatically when status is `"completed"` or `"failed"`.

Response `200`:
```json
{
  "id": "660e8400-e29b-41d4-a716-446655440000",
  "agentId": "550e8400-e29b-41d4-a716-446655440000",
  "task": "deploy service",
  "status": "completed",
  "startedAt": "2025-01-01T00:00:00.000Z",
  "finishedAt": "2025-01-01T00:05:00.000Z",
  "output": "Deployed successfully",
  "error": null
}
```

#### List Agent Runs

```
GET /api/agents/:id/runs
```

Response `200`: Same format as [List Runs](#list-runs).

---

## Error Responses

All errors follow a consistent shape:

```json
{
  "error": "Validation Error",
  "message": "Name is required",
  "statusCode": 400
}
```

| Status | Meaning              |
| ------ | -------------------- |
| `400`  | Validation error     |
| `404`  | Resource not found   |
| `500`  | Internal server error |
