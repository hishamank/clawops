import fs from "node:fs";
import path from "node:path";

const SKILL_CONTENT = `# ClawOps Skill

## When to use this skill

Use the ClawOps CLI when you need to:
- Create, list, update, or complete **tasks**
- Create or inspect **projects**
- Log or list **ideas**
- Register or log **habits**
- Register or heartbeat as an **agent**

ClawOps is the team's mission control. All work should be tracked here.

## CLI Binary

\`\`\`bash
# Local mode (uses local SQLite DB — for dev/local use)
CLAWOPS_MODE=local clawops [command]

# Remote mode (connects to production API — requires API key)
CLAWOPS_API_KEY=<key> clawops [command]
\`\`\`

**Always use \`--json\` flag** when reading output programmatically.

---

## Tasks

\`\`\`bash
clawops task create --title "Fix login bug" --priority high --json
clawops task list --status todo --json
clawops task update <id> --status in_progress --json
clawops task done <id> --summary "What you did" --json
\`\`\`

## Projects

\`\`\`bash
clawops project create --name "Project Name" --status planning --json
clawops project list --json
clawops project info <id> --json
\`\`\`

## Ideas

\`\`\`bash
clawops idea add "Idea title" --desc "Details" --tags "ui,feature" --json
clawops idea list --json
\`\`\`

## Habits

\`\`\`bash
clawops habit register "daily-standup" --json
clawops habit run <id> --json
clawops habit list --json
\`\`\`

## Best Practices

- Always use \`--json\` for output you need to parse
- Capture IDs from create commands
- Assign tasks to yourself when picking them up
- Write a summary when marking done
`;

export function installClawOpsSkill(workspacePath: string): {
  installed: boolean;
  path: string;
  error?: string;
} {
  const skillDir = path.join(workspacePath, "skills", "clawops");
  const skillFile = path.join(skillDir, "SKILL.md");

  try {
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(skillFile, SKILL_CONTENT, "utf8");
    return { installed: true, path: skillFile };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { installed: false, path: skillFile, error: message };
  }
}
