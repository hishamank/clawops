import fs from "node:fs";
import path from "node:path";

const SKILL_CONTENT = `---
name: clawops
description: Use ClawOps mission control to track tasks, projects, ideas, habits, and agent status with the clawops CLI.
homepage: https://github.com/hishamank/clawops
user-invocable: true
metadata: {"openclaw":{"requires":{"bins":["clawops"]}}}
---

# ClawOps Skill

## When to use this skill

Use the ClawOps CLI when you need to:
- Create, list, update, or complete **tasks**
- Create or inspect **projects**
- Log or list **ideas**
- Register or log **habits**
- Register or heartbeat as an **agent**

ClawOps is the team's mission control. All work should be tracked here.

---

## Operating rules

- Every active implementation effort must map to a ClawOps **project**.
- Every task must be linked to the correct project (\`--project-id\` when available).
- If you are responsible for a project, regularly check tasks in:
  - \`backlog\`
  - \`todo\` (or not started)
  - \`in-progress\`
- When brainstorming, immediately log ideas in ClawOps.
- Treat cron jobs and heartbeat workflows as **habits** in ClawOps.
- Prefer machine-readable output: always use \`--json\` when parsing.

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

const SKILL_MARKER_START = "<!-- CLAWOPS_SKILL_REFERENCE_START -->";
const SKILL_MARKER_END = "<!-- CLAWOPS_SKILL_REFERENCE_END -->";

const AGENTS_SKILL_SECTION = `${SKILL_MARKER_START}
## ClawOps Skill

- This workspace has the ClawOps skill at \`skills/clawops/SKILL.md\`.
- Invoke it with \`$clawops\` when you need mission-control actions (tasks, projects, ideas, habits, or agent status).
- Prefer \`clawops ... --json\` when output must be parsed by tools.
${SKILL_MARKER_END}
`;

const TOOLS_SKILL_SECTION = `${SKILL_MARKER_START}
## ClawOps Skill

- Skill file: \`skills/clawops/SKILL.md\`
- CLI binary: \`clawops\`
- Typical usage: \`clawops task list --json\`, \`clawops project list --json\`, \`clawops idea list --json\`
${SKILL_MARKER_END}
`;

export type SkillInstallResult =
  | { installed: true; path: string }
  | { installed: false; path: string; error: string };

function resolveWorkspaceDocPath(
  workspacePath: string,
  candidates: string[],
  defaultFile: string,
): string {
  for (const candidate of candidates) {
    const candidatePath = path.join(workspacePath, candidate);
    if (fs.existsSync(candidatePath)) {
      return candidatePath;
    }
  }
  return path.join(workspacePath, defaultFile);
}

function upsertSkillReference(docPath: string, section: string): void {
  const existing = fs.existsSync(docPath) ? fs.readFileSync(docPath, "utf8") : "";
  const start = existing.indexOf(SKILL_MARKER_START);
  const end = existing.indexOf(SKILL_MARKER_END);

  if (start !== -1 && end !== -1 && end >= start) {
    const before = existing.slice(0, start).trimEnd();
    const after = existing.slice(end + SKILL_MARKER_END.length).trimStart();
    const parts = [before, section.trim(), after].filter(Boolean);
    fs.writeFileSync(docPath, `${parts.join("\n\n")}\n`, "utf8");
    return;
  }

  const normalized = existing.trimEnd();
  const content = normalized.length > 0
    ? `${normalized}\n\n${section.trim()}\n`
    : `${section.trim()}\n`;
  fs.writeFileSync(docPath, content, "utf8");
}

export function installClawOpsSkill(workspacePath: string): SkillInstallResult {
  const skillDir = path.join(workspacePath, "skills", "clawops");
  const skillFile = path.join(skillDir, "SKILL.md");
  const agentsDocPath = resolveWorkspaceDocPath(
    workspacePath,
    ["AGENTS.md", "agents.md"],
    "agents.md",
  );
  const toolsDocPath = resolveWorkspaceDocPath(
    workspacePath,
    ["TOOLS.md", "tools.md"],
    "tools.md",
  );

  try {
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(skillFile, SKILL_CONTENT, "utf8");
    upsertSkillReference(agentsDocPath, AGENTS_SKILL_SECTION);
    upsertSkillReference(toolsDocPath, TOOLS_SKILL_SECTION);
    return { installed: true, path: skillFile };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { installed: false, path: skillFile, error: message };
  }
}
