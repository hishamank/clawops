import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
const {
  formatBucketDateUtc,
  formatOpenClawUsageReport,
  getOpenClawUsageReport,
} = await import("./index.js");

describe("analytics bucket formatting", () => {
  it("uses the Monday of the current ISO week for week buckets", () => {
    assert.strictEqual(formatBucketDateUtc(new Date("2025-01-06T10:15:00Z"), "week"), "2025-01-06");
    assert.strictEqual(formatBucketDateUtc(new Date("2025-01-07T09:30:00Z"), "week"), "2025-01-06");
    assert.strictEqual(formatBucketDateUtc(new Date("2025-01-12T18:45:00Z"), "week"), "2025-01-06");
    assert.strictEqual(formatBucketDateUtc(new Date("2025-01-13T08:00:00Z"), "week"), "2025-01-13");
  });

  it("formats hour and month buckets deterministically in UTC", () => {
    assert.strictEqual(formatBucketDateUtc(new Date("2025-02-01T12:34:56Z"), "hour"), "2025-02-01 12:00:00");
    assert.strictEqual(formatBucketDateUtc(new Date("2025-02-01T12:34:56Z"), "month"), "2025-02-01");
  });
});

describe("OpenClaw usage report", () => {
  it("aggregates usage from OpenClaw session jsonl files", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "clawops-analytics-"));
    try {
      const sessionsDir = path.join(tmpDir, "jax", "sessions");
      fs.mkdirSync(sessionsDir, { recursive: true });
      fs.writeFileSync(
        path.join(sessionsDir, "session-1.jsonl"),
        [
          JSON.stringify({
            type: "message",
            timestamp: "2026-03-19T09:15:00Z",
            message: {
              provider: "openrouter",
              model: "openrouter/google/gemini-2.5-flash",
              usage: {
                input: 100,
                output: 40,
                cost: { total: 0.12 },
              },
            },
          }),
          JSON.stringify({
            type: "message",
            timestamp: "2026-03-19T09:45:00Z",
            message: {
              provider: "anthropic",
              model: "anthropic/claude-sonnet-4-6",
              usage: {
                totalTokens: 90,
                cost: { total: 0.08 },
              },
            },
          }),
        ].join("\n"),
      );

      const report = getOpenClawUsageReport({
        agentsDir: tmpDir,
        hours: 1,
        now: new Date("2026-03-19T10:00:00Z"),
      });

      assert.equal(report.totalTokens, 230);
      assert.equal(report.totalMessages, 2);
      assert.equal(report.totalCost, 0.2);
      assert.equal(report.topAgents[0]?.agentId, "jax");
      assert.equal(report.topAgents[0]?.topModel, "anthropic/claude-sonnet-4-6");
      assert.equal(report.topProviders[0]?.provider, "openrouter");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("formats the OpenClaw usage report summary text", () => {
    const report = {
      hours: 1,
      agentsDir: "/tmp/agents",
      cutoff: new Date("2026-03-19T09:00:00Z"),
      totalTokens: 2300,
      totalMessages: 7,
      totalCost: 0.42,
      topProviders: [
        { provider: "openrouter", tokens: 2000, messages: 5, cost: 0.3 },
      ],
      topAgents: [
        {
          agentId: "jax",
          totalTokens: 1800,
          cost: 0.25,
          messages: 4,
          topModel: "openrouter/google/gemini-2.5-flash",
          models: [],
          providers: [],
        },
      ],
    };

    assert.equal(
      formatOpenClawUsageReport(report),
      [
        "Last 1h: 2.3K tok • 7 msgs • $0.420",
        "Providers: or 2.0K (5)",
        "Top agents:",
        "- jax: 1.8K • 4 msgs • $0.250 • gemini-2.5-flash",
      ].join("\n"),
    );
  });
});
