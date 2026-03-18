# Web Dashboard Guide

The ClawOps web dashboard provides a human-friendly interface for monitoring and managing agents, tasks, projects, and more.

## Access

Default URL: `http://localhost:3333`

## Dashboard Pages

### Fleet Overview (`/`)

The landing page shows:
- **Agent Cards Grid**: All registered agents with status indicators
- **Stats Bar**: Fleet-wide metrics (active agents, pending tasks, etc.)
- **Quick-add Idea**: Fast idea capture widget

**Key Actions:**
- Click agent card to view full profile
- Quick-add idea via floating button

### Agent Profile (`/agents/:id`)

Comprehensive agent view:
- Identity info (name, model, role, framework)
- Current status and status message
- Declared skills
- Active habits
- Assigned tasks
- Token usage and costs

**Key Actions:**
- View task history
- Check habit run logs
- Review token consumption

### Tasks (`/tasks`)

Task management interface:
- **List View**: Filterable task list
- **Filters**: By status, priority, assignee, project
- **Detail Panel**: Slide-over with full task info

**Key Actions:**
- Create new task
- Update task status/priority
- View task spec
- Link resources

### Projects (`/projects`)

Project management:
- **Project Cards**: Visual project overview
- **Detail Page**: Full project context
- **Milestones**: Progress tracking
- **PRD Editor**: Markdown editing for project specs

**Key Actions:**
- Create/update projects
- Add milestones
- Edit PRD content
- View project context

### Ideas (`/ideas`)

Idea board:
- **Card Grid**: Visual idea layout
- **Sections**: brainstorming, research, draftPRD, notes
- **Status Flow**: raw → reviewed → promoted → archived

**Key Actions:**
- Add new ideas
- Edit idea sections
- Promote to project

### Analytics (`/analytics`)

Token and cost tracking:
- **Per-Agent Charts**: Individual agent usage
- **Per-Model Breakdown**: Model-specific costs
- **Per-Project Attribution**: Project-based costs
- **Time Ranges**: Filter by day/week/month

### Notifications (`/notifications`)

Alert and notification center:
- **Type Filtering**: By notification type
- **Severity**: info, warning, error, critical
- **Read State**: Mark as read

**Notification Types:**
- Task completion
- Missed heartbeat (agent offline alert)
- Milestone achieved
- Sync status

### Settings (`/settings`)

Configuration:
- API key management
- Model pricing table
- Agent memory paths
- Connection settings

## Quick Actions

Each page provides context-specific quick actions:
- Tasks: Create, update, complete
- Projects: Activate, deactivate, view context
- Ideas: Add, edit, promote
- Agents: Set status, view profile

## Environment Variables

The dashboard respects these variables:
- `WEB_PORT`: Server port (default: 3333)
- `CLAWOPS_DB_PATH`: Database location
- `OPENCLAW_DIR`: OpenClaw directory path
- `OPENCLAW_GATEWAY_URL`: Gateway URL for sync
- `OPENCLAW_GATEWAY_TOKEN`: Gateway authentication

## Keyboard Shortcuts

- `?`: Show keyboard shortcuts (if implemented)
- `/`: Focus search (if available)

## Mobile Support

The dashboard is responsive but optimized for desktop use. Mobile views show stacked layouts.

## Tips

1. **Use `--json` in CLI**: For scriptable output while using dashboard for visualization
2. **Check notifications**: Stay on top of missed heartbeats
3. **Project context**: Use `clawops project context <id>` for low-token context
4. **Filter efficiently**: Use URL params for shareable filtered views
