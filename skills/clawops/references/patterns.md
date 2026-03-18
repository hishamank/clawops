# Patterns & Gotchas

## Common Patterns

### ID Capture Pattern

Always capture IDs from create commands for later reference:

```bash
# Store ID in variable
PROJECT_ID=$(clawops project create --name "My Project" --json | jq -r '.id')

# Or parse from output
TASK_ID=$(clawops task create --title "Task" --json | grep -oP '"id":\s*"\K[^"]+')

# Use captured ID
clawops task create --title "Subtask" --project "$PROJECT_ID"
```

### JSON Output Pattern

Use `--json` for all scriptable output:

```bash
# Get all high-priority tasks
clawops task list --status todo --priority high --json | jq '.[] | .id'

# Check if task exists
clawops task list --json | jq -e '.[] | select(.title == "Task Name")' && echo "exists"
```

### Project-Task Linking

Always link tasks to projects:

```bash
# Good
clawops task create --title "Feature" --project "$PROJECT_ID"

# Avoid - hard to track
clawops task create --title "Feature"
```

### Agent Identity

Set `CLAWOPS_AGENT_ID` to tag your work:

```bash
export CLAWOPS_AGENT_ID="agent-uuid-here"
clawops task create --title "Work"  # Automatically tagged
```

### Heartbeat Pattern

Send regular heartbeats to avoid offline alerts:

```bash
# In your agent loop or cron
clawops agent heartbeat

# Or log via habit
clawops habit run "$(clawops habit list --json | jq -r '.[] | select(.name == "heartbeat") | .id')"
```

### Session Context

Use project activation for focused work:

```bash
# Start working on project
clawops project activate "$PROJECT_ID"

# Do work...
clawops task update "$TASK_ID" --status in-progress

# End session with summary
clawops project deactivate --summary "Completed feature X, started feature Y"
```

### Idea-to-Task Flow

Create tasks from ideas:

```bash
# Create idea
IDEA_ID=$(clawops idea add "New feature" --json | jq -r '.id')

# Develop in idea
clawops idea section "$IDEA_ID" brainstorming --set "Options: A, B, C"

# When ready, create task from idea
clawops idea create-task "$IDEA_ID" --title "Implement feature"
```

## Gotchas

### Forgetting `--json`

Without `--json`, output is human-readable and hard to parse:

```bash
# This breaks scripts
clawops task list | grep "something"

# Use --json
clawops task list --json | jq '.[] | select(.title | contains("something"))'
```

### Not Linking Tasks to Projects

Unlinked tasks are hard to track:

```bash
# Good - explicit project
clawops task create --title "Task" --project "prj-123"

# Works but harder to track
clawops task create --title "Task"
```

### Missing Heartbeats

Agents without regular heartbeats trigger "offline" notifications:

```bash
# Set up heartbeat habit
clawops habit register "heartbeat" --type heartbeat --interval 300

# Send heartbeat regularly (every 5 minutes)
clawops agent heartbeat
```

### Skipping Task Specs

Tasks without specs lack context for agents:

```bash
# Good - with spec
clawops task create --title "Fix bug" --spec /path/to/spec.md

# Minimal - no context
clawops task create --title "Fix bug"
```

### Wrong Priority

Using wrong priority affects dispatch:

- `urgent`: Only for production issues
- `high`: Important features, bugs
- `medium`: Normal work
- `low`: Nice-to-haves

### Not Updating Status

Outdated status causes confusion:

```bash
# Start work
clawops task update "$TASK_ID" --status in-progress

# When done, move to review
clawops task update "$TASK_ID" --status review

# After review, complete
clawops task done "$TASK_ID" --summary "Done"
```

### Blocking Without Notifying

Tasks that block others should be tracked:

```bash
# Track dependency
clawops task block "$BLOCKER_ID" "$BLOCKED_ID"

# When blocker is done, remove block
clawops task unblock "$BLOCKER_ID" "$BLOCKED_ID"
```

### Ignoring Notifications

Check notifications regularly:

```bash
# View recent notifications in dashboard
# Or check via events
clawops task list --status done --json | head -10
```

### Using Stdin Without Explicit Flag

Some commands read stdin unexpectedly:

```bash
# Explicit --file is clearer
clawops project spec "$ID" --file spec.md

# May wait for stdin
clawops project spec "$ID" --set
```

### Not Capturing Artifacts

Mark artifacts when completing tasks:

```bash
# Good - captures artifacts
clawops task done "$TASK_ID" --summary "Fixed bug" --artifacts "pr:#42,docs:updated.md"

# Minimal - no artifacts tracked
clawops task done "$TASK_ID" --summary "Fixed bug"
```

### Environment Variables

Missing env vars cause errors:

```bash
# Required for CLI to work
export CLAWOPS_MODE=local
export CLAWOPS_DB_PATH="./clawops.db"

# For agent identification
export CLAWOPS_AGENT_ID="your-agent-id"
```

## Anti-Patterns

1. **Creating tasks without projects**: Hard to track, no context
2. **Skipping heartbeats**: Triggers false "offline" alerts
3. **Not using `--json`**: Breaks scripting
4. **Leaving tasks in wrong status**: Causes confusion
5. **Ignoring notifications**: Miss important alerts
6. **No task specs**: Agents lack context
