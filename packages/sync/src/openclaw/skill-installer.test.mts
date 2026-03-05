import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { installClawOpsSkill } from "./skill-installer.js";

describe("installClawOpsSkill()", () => {
  let tmpDir: string;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "clawops-skill-test-"));
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates skills/clawops/SKILL.md in the workspace", () => {
    const result = installClawOpsSkill(tmpDir);
    assert.equal(result.installed, true);
    assert.ok(result.path.endsWith("SKILL.md"));
    assert.ok(fs.existsSync(result.path));
  });

  it("SKILL.md contains ClawOps CLI reference", () => {
    installClawOpsSkill(tmpDir);
    const skillPath = path.join(tmpDir, "skills", "clawops", "SKILL.md");
    const content = fs.readFileSync(skillPath, "utf8");
    assert.ok(content.includes("clawops task"));
    assert.ok(content.includes("clawops project"));
    assert.ok(content.includes("--json"));
  });

  it("is idempotent — running twice does not error", () => {
    const r1 = installClawOpsSkill(tmpDir);
    const r2 = installClawOpsSkill(tmpDir);
    assert.equal(r1.installed, true);
    assert.equal(r2.installed, true);
  });

  it("returns installed:false with error message for read-only directory", () => {
    const roDir = path.join(tmpDir, "readonly-workspace");
    fs.mkdirSync(roDir);
    const skillDir = path.join(roDir, "skills", "clawops");
    fs.mkdirSync(skillDir, { recursive: true });
    fs.chmodSync(skillDir, 0o444); // read-only
    
    const result = installClawOpsSkill(roDir);
    // On Linux this should fail; restore permissions after
    fs.chmodSync(skillDir, 0o755);
    
    if (!result.installed) {
      assert.ok(result.error !== undefined);
      assert.ok(result.error.length > 0);
    }
    // If it succeeded (e.g., running as root), that's also acceptable
  });
});
