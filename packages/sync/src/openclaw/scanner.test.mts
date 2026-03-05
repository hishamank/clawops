import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { scanOpenClaw } from "./scanner.js";

describe("scanOpenClaw()", () => {
  let tmpDir: string;

  before(() => {
    // Create a fake ~/.openclaw structure
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "clawops-test-"));
    
    // Create workspace-rick directory
    const wsDir = path.join(tmpDir, "workspace-rick");
    fs.mkdirSync(wsDir, { recursive: true });
    fs.writeFileSync(path.join(wsDir, "IDENTITY.md"), "# IDENTITY\n- **Name:** Rick\n");
    fs.writeFileSync(path.join(wsDir, "SOUL.md"), "# SOUL\nI am Rick.");
    fs.writeFileSync(path.join(wsDir, "AGENTS.md"), "# AGENTS\n...");
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("discovers workspace-* directories as agents", () => {
    const result = scanOpenClaw({ openclawDir: tmpDir });
    assert.equal(result.agents.length, 1);
    assert.equal(result.agents[0]!.id, "rick");
    assert.equal(result.agents[0]!.name, "Rick"); // parsed from IDENTITY.md
    assert.ok(result.agents[0]!.workspacePath.includes("workspace-rick"));
  });

  it("reads workspace files when includeFiles is true (default)", () => {
    const result = scanOpenClaw({ openclawDir: tmpDir, includeFiles: true });
    assert.equal(result.workspaces.length, 1);
    assert.ok(result.workspaces[0]!.files.soul?.includes("Rick"));
    assert.ok(result.workspaces[0]!.files.agents?.includes("AGENTS"));
  });

  it("skips file reading when includeFiles is false", () => {
    const result = scanOpenClaw({ openclawDir: tmpDir, includeFiles: false });
    assert.equal(result.workspaces.length, 0);
  });

  it("uses OPENCLAW_DIR env var as fallback", () => {
    const original = process.env["OPENCLAW_DIR"];
    process.env["OPENCLAW_DIR"] = tmpDir;
    try {
      const result = scanOpenClaw(); // no options
      assert.equal(result.agents.length, 1);
    } finally {
      if (original === undefined) {
        delete process.env["OPENCLAW_DIR"];
      } else {
        process.env["OPENCLAW_DIR"] = original;
      }
    }
  });

  it("returns gatewayUrl from options when provided", () => {
    const result = scanOpenClaw({ openclawDir: tmpDir, gatewayUrl: "http://custom:9999" });
    assert.equal(result.gatewayUrl, "http://custom:9999");
  });

  it("returns empty agents array gracefully if directory does not exist", () => {
    const result = scanOpenClaw({ openclawDir: "/nonexistent/path/xyz" });
    // Returns default "main" agent when no workspaces found
    assert.equal(result.agents.length, 1);
    assert.equal(result.agents[0]!.id, "main");
  });
});
