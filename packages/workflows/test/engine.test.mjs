/**
 * Engine unit tests using module mocks (no SQLite needed).
 *
 * All DB-touching dependencies are replaced with in-memory maps so the
 * engine logic can be exercised without native bindings.
 */
import assert from "node:assert";
import { describe, it, mock, before } from "node:test";

// ── In-memory stores ─────────────────────────────────────────────────────────

const workflowStore = new Map();
const runStore = new Map();
const stepStore = new Map();
let idSeq = 0;
const mkId = (prefix) => `${prefix}-${++idSeq}`;

function resetStores() {
  workflowStore.clear();
  runStore.clear();
  stepStore.clear();
}

function addWorkflow(def) {
  const id = def.id ?? mkId("wf");
  const record = {
    id,
    name: def.name,
    description: def.description ?? null,
    version: def.version ?? "1",
    status: def.status ?? "draft",
    projectId: def.projectId ?? null,
    triggerType: def.triggerType ?? "manual",
    triggerConfig: null,
    steps: JSON.stringify(def.steps ?? []),
    createdAt: new Date(),
    updatedAt: new Date(),
    // Parsed helpers used by the engine
    triggerConfigObject: def.triggerConfig ?? {},
    stepsArray: def.steps ?? [],
  };
  workflowStore.set(id, record);
  return record;
}

// ── Module mocks (must be set up before dynamic import) ──────────────────────

mock.module("@clawops/core", {
  namedExports: {
    createActivityEvent: () => ({ id: mkId("evt") }),
  },
});

mock.module("@clawops/tasks", {
  namedExports: {
    createTask: (_db, input) => ({
      id: mkId("task"),
      title: input.title ?? "",
      status: input.status ?? "backlog",
    }),
    updateTask: (_db, id, updates) => ({
      id,
      title: updates.title ?? "task",
      status: updates.status ?? "backlog",
    }),
  },
});

mock.module("@clawops/notifications", {
  namedExports: {
    createNotification: (_db, input) => ({ id: mkId("notif"), ...input }),
  },
});

mock.module("@clawops/sync/openclaw", {
  namedExports: {
    triggerSupportedOpenClawEndpoint: async () => ({ status: "ok", response: {} }),
  },
});

// Mock ../dist/index.js — replaced with in-memory workflow CRUD implementations.
// This is the same module that dist/engine.js imports from "./index.js".
mock.module("../dist/index.js", {
  namedExports: {
    getWorkflowDefinition: (_db, id) => workflowStore.get(id) ?? null,
    listWorkflowDefinitions: (_db, filters = {}) =>
      [...workflowStore.values()].filter((w) => {
        if (filters.status && w.status !== filters.status) return false;
        if (filters.triggerType && w.triggerType !== filters.triggerType) return false;
        return true;
      }),
    createWorkflowRun: (_db, input) => {
      const run = {
        id: mkId("run"),
        workflowId: input.workflowId,
        status: input.status ?? "running",
        triggeredBy: input.triggeredBy,
        triggeredById: input.triggeredById ?? null,
        startedAt: input.startedAt ?? null,
        completedAt: null,
        result: null,
        error: null,
        metadata: null,
        resultObject: {},
        metadataObject: {},
        createdAt: new Date(),
        steps: [],
      };
      runStore.set(run.id, run);
      return run;
    },
    updateWorkflowRun: (_db, id, input) => {
      const run = runStore.get(id);
      if (!run) throw new Error(`Run ${id} not found`);
      if (input.status !== undefined) run.status = input.status;
      if (input.completedAt !== undefined) run.completedAt = input.completedAt;
      if (input.result !== undefined) run.result = input.result;
      if (input.error !== undefined) run.error = input.error;
      return run;
    },
    createWorkflowRunStep: (_db, input) => {
      const step = {
        id: mkId("step"),
        workflowRunId: input.workflowRunId,
        stepIndex: input.stepIndex,
        stepKey: input.stepKey ?? `step-${input.stepIndex + 1}`,
        stepName: input.stepName,
        stepType: input.stepType,
        status: input.status ?? "running",
        input: null,
        result: null,
        error: null,
        startedAt: input.startedAt ?? null,
        completedAt: null,
        inputObject: {},
        resultObject: {},
        createdAt: new Date(),
      };
      stepStore.set(step.id, step);
      const run = runStore.get(input.workflowRunId);
      if (run) run.steps.push(step);
      return step;
    },
    updateWorkflowRunStep: (_db, id, input) => {
      const step = stepStore.get(id);
      if (!step) throw new Error(`Step ${id} not found`);
      if (input.status !== undefined) step.status = input.status;
      if (input.result !== undefined) step.result = input.result;
      if (input.error !== undefined) step.error = input.error;
      if (input.completedAt !== undefined) step.completedAt = input.completedAt;
      return step;
    },
  },
});

// Dynamic import AFTER all mocks are registered
const { executeWorkflow, matchEventTrigger, evaluateCondition, WorkflowNotActiveError } =
  await import("../dist/engine.js");

// Null DB — all DB calls are intercepted by module mocks above
const db = null;

// ── matchEventTrigger ────────────────────────────────────────────────────────

describe("matchEventTrigger", () => {
  before(() => resetStores());

  it("returns workflows matching eventType; skips inactive / wrong-type / wrong-eventType", () => {
    const active = addWorkflow({
      name: "Active event wf",
      status: "active",
      triggerType: "event",
      triggerConfig: { eventType: "task.completed" },
      steps: [{ name: "Notify", type: "notification" }],
    });

    // Paused — should not match
    addWorkflow({
      name: "Paused event wf",
      status: "paused",
      triggerType: "event",
      triggerConfig: { eventType: "task.completed" },
      steps: [{ name: "Notify", type: "notification" }],
    });

    // Wrong eventType
    addWorkflow({
      name: "Wrong eventType wf",
      status: "active",
      triggerType: "event",
      triggerConfig: { eventType: "idea.created" },
      steps: [{ name: "Notify", type: "notification" }],
    });

    // Manual trigger
    addWorkflow({
      name: "Manual wf",
      status: "active",
      triggerType: "manual",
      steps: [{ name: "Notify", type: "notification" }],
    });

    const matches = matchEventTrigger(db, "task.completed");
    assert.strictEqual(matches.length, 1);
    assert.strictEqual(matches[0].id, active.id);
  });
});

// ── evaluateCondition ────────────────────────────────────────────────────────

describe("evaluateCondition", () => {
  const ctx = { runId: "r1", stepResults: { stepA: { count: 5, label: "done" } } };

  it("eq — matches equal value", () => {
    assert.strictEqual(
      evaluateCondition(JSON.stringify({ path: "stepA.label", op: "eq", value: "done" }), ctx),
      true,
    );
  });

  it("eq — rejects non-equal value", () => {
    assert.strictEqual(
      evaluateCondition(JSON.stringify({ path: "stepA.label", op: "eq", value: "fail" }), ctx),
      false,
    );
  });

  it("neq — truthy for different value", () => {
    assert.strictEqual(
      evaluateCondition(JSON.stringify({ path: "stepA.label", op: "neq", value: "fail" }), ctx),
      true,
    );
  });

  it("gt — truthy when actual > expected", () => {
    assert.strictEqual(
      evaluateCondition(JSON.stringify({ path: "stepA.count", op: "gt", value: 3 }), ctx),
      true,
    );
  });

  it("lt — falsy when actual is not less than expected", () => {
    assert.strictEqual(
      evaluateCondition(JSON.stringify({ path: "stepA.count", op: "lt", value: 3 }), ctx),
      false,
    );
  });

  it("missing path resolves to undefined, eq returns false", () => {
    assert.strictEqual(
      evaluateCondition(JSON.stringify({ path: "stepX.missing", op: "eq", value: "x" }), ctx),
      false,
    );
  });

  it("invalid JSON returns true (safe default)", () => {
    assert.strictEqual(evaluateCondition("{not valid json", ctx), true);
  });
});

// ── executeWorkflow ──────────────────────────────────────────────────────────

describe("executeWorkflow — notification step succeeds", () => {
  before(() => resetStores());

  it("run status is completed and step status is completed", async () => {
    const wf = addWorkflow({
      name: "Notify wf",
      status: "active",
      triggerType: "manual",
      steps: [
        {
          key: "notify",
          name: "Send notification",
          type: "notification",
          config: { title: "Hello", body: "World" },
        },
      ],
    });

    const runId = await executeWorkflow(db, wf.id, { triggeredBy: "human" });
    assert.ok(runId, "should return a run ID");

    const run = runStore.get(runId);
    assert.strictEqual(run.status, "completed");
    assert.strictEqual(run.steps[0].status, "completed");
  });
});

describe("executeWorkflow — condition false skips step", () => {
  before(() => resetStores());

  it("step is skipped and run completes", async () => {
    const wf = addWorkflow({
      name: "Condition wf",
      status: "active",
      triggerType: "manual",
      steps: [
        {
          key: "guarded",
          name: "Skippable step",
          type: "notification",
          // Condition: stepResults.nonexistent.value === "yes" → false (path missing)
          condition: JSON.stringify({ path: "nonexistent.value", op: "eq", value: "yes" }),
          config: { title: "Should be skipped" },
        },
      ],
    });

    const runId = await executeWorkflow(db, wf.id, { triggeredBy: "human" });
    const run = runStore.get(runId);
    assert.strictEqual(run.status, "completed");
    assert.strictEqual(run.steps[0].status, "skipped");
  });
});

describe("executeWorkflow — onError stop (default) fails the run", () => {
  before(() => resetStores());

  it("run is failed and step error is captured", async () => {
    const wf = addWorkflow({
      name: "Stop wf",
      status: "active",
      triggerType: "manual",
      steps: [
        {
          key: "bad",
          name: "Unsupported step",
          type: "wait", // dispatchAction throws "not yet supported"
          // onError defaults to "stop"
        },
      ],
    });

    const runId = await executeWorkflow(db, wf.id, { triggeredBy: "human" });
    const run = runStore.get(runId);
    assert.strictEqual(run.status, "failed");
    assert.strictEqual(run.steps[0].status, "failed");
    assert.ok(typeof run.error === "string" && run.error.includes("not yet supported"));
  });
});

describe("executeWorkflow — onError continue allows run to complete", () => {
  before(() => resetStores());

  it("run completes even after step failure; failed step is recorded", async () => {
    const wf = addWorkflow({
      name: "Continue wf",
      status: "active",
      triggerType: "manual",
      steps: [
        {
          key: "bad",
          name: "Failing step",
          type: "wait",
          onError: "continue",
        },
        {
          key: "ok",
          name: "Success step",
          type: "notification",
          config: { title: "After failure" },
        },
      ],
    });

    const runId = await executeWorkflow(db, wf.id, { triggeredBy: "human" });
    const run = runStore.get(runId);
    assert.strictEqual(run.status, "completed");
    assert.strictEqual(run.steps[0].status, "failed");
    assert.strictEqual(run.steps[1].status, "completed");
  });
});

describe("executeWorkflow — onError retry exhausted fails the run", () => {
  before(() => resetStores());

  it("run is failed (not completed) after retry exhaustion", async () => {
    const wf = addWorkflow({
      name: "Retry wf",
      status: "active",
      triggerType: "manual",
      steps: [
        {
          key: "always-fails",
          name: "Always fails",
          type: "wait",
          onError: "retry",
          retryCount: 2,
        },
      ],
    });

    const runId = await executeWorkflow(db, wf.id, { triggeredBy: "human" });
    const run = runStore.get(runId);
    assert.strictEqual(run.status, "failed", "run should be failed, not completed");
    assert.strictEqual(run.steps[0].status, "failed");
  });
});

describe("executeWorkflow — inactive workflow and not found", () => {
  before(() => resetStores());

  it("throws WorkflowNotActiveError for draft workflow", async () => {
    const wf = addWorkflow({
      name: "Draft wf",
      status: "draft",
      triggerType: "manual",
      steps: [{ name: "Notify", type: "notification" }],
    });

    await assert.rejects(
      () => executeWorkflow(db, wf.id, { triggeredBy: "human" }),
      (err) => err instanceof WorkflowNotActiveError,
    );
  });

  it("throws generic Error for missing workflow ID", async () => {
    await assert.rejects(
      () => executeWorkflow(db, "nonexistent-id", { triggeredBy: "human" }),
      (err) => err instanceof Error && err.message.includes("not found"),
    );
  });
});
