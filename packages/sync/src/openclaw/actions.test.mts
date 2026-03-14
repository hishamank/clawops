import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  OpenClawActionError,
  triggerAgent,
  updateCronJob,
  writeTrackedFile,
} from "./actions.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("updateCronJob", () => {
  it("PATCHes the gateway cron job endpoint", async () => {
    let request: Request | null = null;

    globalThis.fetch = async (input, init) => {
      request = new Request(input, init);
      return new Response(JSON.stringify({ id: "cron-1", enabled: false }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    const result = await updateCronJob(
      "https://gateway.example.test/base/",
      "secret-token",
      "cron-1",
      { enabled: false },
    );

    assert.deepEqual(result, { id: "cron-1", enabled: false });
    assert.ok(request);
    assert.equal(request.method, "PATCH");
    assert.equal(request.url, "https://gateway.example.test/api/cron/cron-1");
    assert.equal(request.headers.get("authorization"), "Bearer secret-token");
    assert.deepEqual(await request.json(), { enabled: false });
  });

  it("throws OpenClawActionError for non-ok responses", async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ error: "cron missing" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });

    await assert.rejects(
      updateCronJob("https://gateway.example.test", "secret-token", "cron-404", {
        enabled: true,
      }),
      (error: unknown) =>
        error instanceof OpenClawActionError &&
        error.code === "OPENCLAW_ACTION_REQUEST_FAILED" &&
        error.status === 502 &&
        error.responseStatus === 404 &&
        error.message.includes("cron missing"),
    );
  });
});

describe("triggerAgent", () => {
  it("POSTs agent messages to the session send endpoint", async () => {
    let request: Request | null = null;

    globalThis.fetch = async (input, init) => {
      request = new Request(input, init);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    const result = await triggerAgent(
      "https://gateway.example.test",
      "secret-token",
      "agent-7",
      "Run the deploy checklist",
    );

    assert.deepEqual(result, { ok: true });
    assert.ok(request);
    assert.equal(request.method, "POST");
    assert.equal(request.url, "https://gateway.example.test/api/sessions/agent-7/send");
    assert.deepEqual(await request.json(), { message: "Run the deploy checklist" });
  });
});

describe("writeTrackedFile", () => {
  it("POSTs file content to the workspace files endpoint", async () => {
    let request: Request | null = null;

    globalThis.fetch = async (input, init) => {
      request = new Request(input, init);
      return new Response(JSON.stringify({ filePath: "notes/today.md" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    const result = await writeTrackedFile(
      "https://gateway.example.test",
      "secret-token",
      "notes/today.md",
      "hello",
    );

    assert.deepEqual(result, { filePath: "notes/today.md" });
    assert.ok(request);
    assert.equal(request.method, "POST");
    assert.equal(request.url, "https://gateway.example.test/api/workspace/files");
    assert.deepEqual(await request.json(), {
      filePath: "notes/today.md",
      content: "hello",
    });
  });

  it("wraps network failures in OpenClawActionError", async () => {
    globalThis.fetch = async () => {
      throw new TypeError("fetch failed");
    };

    await assert.rejects(
      writeTrackedFile(
        "https://gateway.example.test",
        "secret-token",
        "notes/today.md",
        "hello",
      ),
      (error: unknown) =>
        error instanceof OpenClawActionError &&
        error.code === "OPENCLAW_ACTION_REQUEST_FAILED" &&
        error.status === 502 &&
        error.message.includes("network request failed"),
    );
  });
});
