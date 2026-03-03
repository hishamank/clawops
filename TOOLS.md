# TOOLS.md — ClawOps Dev Tooling Reference

## PR Review Protocol

Every PR gets **two reviews** with different lenses:

### 1. Copilot Review (Code Quality)
Automatically triggered via `.github/workflows/copilot-review.yml` + `CODEOWNERS`.

**Scope:** types, patterns, rule violations, missing transactions, security, ESLint alignment.
Uses `copilot-instructions.md` rules.

---

### 2. Gemini Review (Business Logic)
Run manually before merging. Checks that the implementation actually matches the PRD.

**Scope:** Does the route do what the spec says? Are data relationships correct? Is anything missing from the requirements?

**Command:**
```bash
gh pr diff <PR_NUMBER> | gemini -p "$(cat docs/ClawOps_PRD.md)\n\n$(cat claude.md)\n\nReview this diff for business logic correctness: does it match the PRD spec? Are data relationships correct? Is anything missing from the requirements? Be specific — cite PRD sections where relevant."
```

**When to run:** After Copilot review is complete, before merge approval.

---

## Review Checklist (before merge)

- [ ] Copilot review addressed (no unresolved comments)
- [ ] Gemini business logic review passed
- [ ] No raw SQL exceptions unless explicitly needed
- [ ] DB mutations wrapped in transactions
- [ ] Routes return correct shape per PRD
- [ ] No `db:push` in any Docker CMD — use `migrate.ts`

---

## Coding Agents

| Agent | CLI | Best For |
|-------|-----|----------|
| Claude Code | `claude -p "task" --dangerously-skip-permissions` | Complex features, large refactors |
| Gemini | `gemini -p "task"` | Large context analysis, PRD alignment |
| Qwen | `qwen chat "task"` | Quick tasks, CLI features |

**Rules:**
- Run agents in `~/Projects/clawops`, not in workspace
- Enable agent watcher cron before spawning background agents
- Review all agent output before merging
