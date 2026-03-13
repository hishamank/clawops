import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import * as schema from "../dist/index.js";

let db;

function makeStore() {
  return {
    agents: [],
    projects: [],
    tasks: [],
    activityEvents: [],
    workflowDefinitions: [],
    workflowRuns: [],
    workflowRunSteps: [],
  };
}

function getTableName(table) {
  return table[Symbol.for("drizzle:Name")] ?? table._.name;
}

function getRows(store, table) {
  const tableName = getTableName(table);

  switch (tableName) {
    case "agents":
      return store.agents;
    case "projects":
      return store.projects;
    case "tasks":
      return store.tasks;
    case "activity_events":
      return store.activityEvents;
    case "workflow_definitions":
      return store.workflowDefinitions;
    case "workflow_runs":
      return store.workflowRuns;
    case "workflow_run_steps":
      return store.workflowRunSteps;
    default:
      throw new Error(`Unsupported table: ${tableName}`);
  }
}

function normalizeInsertValues(values) {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => {
      if (value === undefined) {
        return [key, null];
      }

      return [key, value];
    }),
  );
}

function extractCondition(condition) {
  const chunks = condition?.queryChunks ?? [];
  const column = chunks.find((chunk) => typeof chunk?.name === "string");
  const param = chunks.find((chunk) => Object.hasOwn(chunk ?? {}, "encoder"));

  return column && param
    ? { field: column.name, value: param.value }
    : null;
}

function toRowField(field) {
  return field.replace(/_([a-z])/g, (_match, letter) => letter.toUpperCase());
}

function matchesCondition(row, condition) {
  if (!condition) {
    return true;
  }

  if (Array.isArray(condition)) {
    return condition.every((entry) => matchesCondition(row, entry));
  }

  const extracted = extractCondition(condition);
  return extracted ? row[toRowField(extracted.field)] === extracted.value : true;
}

function createSelectResult(rows) {
  return {
    where(condition) {
      return createSelectResult(rows.filter((row) => matchesCondition(row, condition)));
    },
    orderBy() {
      return createSelectResult([...rows]);
    },
    all() {
      return rows;
    },
    get() {
      return rows[0];
    },
  };
}

function createDb() {
  const store = makeStore();

  return {
    insert(table) {
      return {
        values(values) {
          const rows = getRows(store, table);
          const inserted = {
            id: values.id ?? crypto.randomUUID(),
            createdAt: values.createdAt ?? new Date(),
            updatedAt: values.updatedAt ?? new Date(),
            ...normalizeInsertValues(values),
          };

          rows.push(inserted);

          return {
            run() {
              return inserted;
            },
            returning() {
              return {
                get() {
                  return inserted;
                },
              };
            },
          };
        },
      };
    },
    select() {
      return {
        from(table) {
          return createSelectResult(getRows(store, table));
        },
      };
    },
    update(table) {
      const rows = getRows(store, table);
      const state = {
        values: {},
      };

      return {
        set(values) {
          state.values = values;
          return this;
        },
        where(condition) {
          const row = rows.find((entry) => matchesCondition(entry, condition));
          if (row) {
            Object.assign(row, normalizeInsertValues(state.values));
          }

          return {
            returning() {
              return {
                get() {
                  return row;
                },
              };
            },
          };
        },
      };
    },
  };
}

function seedAgent(id) {
  db.insert(schema.agents)
    .values({
      id,
      name: `Agent ${id}`,
      model: "gpt-4",
      role: "operator",
    })
    .run();
}

function seedProject(id) {
  db.insert(schema.projects)
    .values({
      id,
      name: `Project ${id}`,
    })
    .run();
}

function seedTask(id, projectId) {
  db.insert(schema.tasks)
    .values({
      id,
      title: `Task ${id}`,
      projectId,
    })
    .run();
}

beforeEach(() => {
  db = createDb();
  seedAgent("agent-1");
  seedProject("project-1");
  seedTask("task-1", "project-1");
});

describe("activity event helpers", () => {
  it("exports the full activity helper surface from @clawops/core", () => {
    assert.equal(typeof schema.createActivityEvent, "function");
    assert.equal(typeof schema.normalizeActivityEvent, "function");
    assert.equal(typeof schema.buildActivityEventQueryConditions, "function");
    assert.equal(typeof schema.parseActivityEventMetadata, "function");
  });

  it("createActivityEvent inserts and returns a normalized activity event", () => {
    const event = schema.createActivityEvent(db, {
      source: "system",
      severity: "warning",
      type: "sync.failed",
      title: "Sync failed",
      body: "Gateway request timed out",
      agentId: "agent-1",
      entityType: "task",
      entityId: "task-1",
      projectId: "project-1",
      taskId: "task-1",
      metadata: '{"retry":2,"reason":"timeout"}',
    });

    assert.ok(event.id);
    assert.equal(event.type, "sync.failed");
    assert.equal(event.metadata, '{"retry":2,"reason":"timeout"}');

    const persisted = db
      .select()
      .from(schema.activityEvents)
      .where(schema.eq(schema.activityEvents.id, event.id))
      .get();

    assert.ok(persisted);
    assert.equal(persisted.id, event.id);
  });

  it("normalizeActivityEvent rejects malformed metadata instead of silently replacing it", () => {
    assert.throws(
      () =>
        schema.normalizeActivityEvent({
          source: "system",
          severity: "info",
          type: "sync.started",
          title: "Sync started",
          metadata: "{bad json",
        }),
      /metadata must be a JSON object/i,
    );
  });

  it("normalizeActivityEvent rejects non-object JSON metadata", () => {
    assert.throws(
      () =>
        schema.normalizeActivityEvent({
          source: "system",
          severity: "info",
          type: "sync.started",
          title: "Sync started",
          metadata: "[1,2,3]",
        }),
      /metadata must be a JSON object/i,
    );
  });

  it("buildActivityEventQueryConditions supports the documented filters", () => {
    const conditions = schema.buildActivityEventQueryConditions({
      type: "sync.failed",
      agentId: "agent-1",
      entityType: "task",
      entityId: "task-1",
      projectId: "project-1",
      taskId: "task-1",
      severity: "error",
      source: "sync",
    });

    const extracted = conditions.map(extractCondition);

    assert.equal(conditions.length, 8);
    assert.deepStrictEqual(extracted, [
      { field: "type", value: "sync.failed" },
      { field: "agent_id", value: "agent-1" },
      { field: "entity_type", value: "task" },
      { field: "entity_id", value: "task-1" },
      { field: "project_id", value: "project-1" },
      { field: "task_id", value: "task-1" },
      { field: "severity", value: "error" },
      { field: "source", value: "sync" },
    ]);
  });

  it("parseActivityEventMetadata returns parsed metadata objects", () => {
    const event = schema.createActivityEvent(db, {
      source: "hook",
      severity: "critical",
      type: "hook.failed",
      title: "Hook failed",
      metadata: '{"attempt":3,"urgent":true}',
    });

    assert.deepStrictEqual(schema.parseActivityEventMetadata(event), {
      attempt: 3,
      urgent: true,
    });
  });
});

describe("workflow persistence helpers", () => {
  it("exports the workflow helper surface from @clawops/core", () => {
    assert.equal(typeof schema.createWorkflowDefinition, "function");
    assert.equal(typeof schema.getWorkflowDefinition, "function");
    assert.equal(typeof schema.listWorkflowDefinitions, "function");
    assert.equal(typeof schema.startWorkflowRun, "function");
    assert.equal(typeof schema.recordWorkflowRunStep, "function");
    assert.equal(typeof schema.finishWorkflowRun, "function");
  });

  it("creates, gets, and lists workflow definitions with parsed config and steps", () => {
    const created = schema.createWorkflowDefinition(db, {
      name: " Task created workflow ",
      description: " Notify on task create ",
      status: "active",
      projectId: "project-1",
      triggerType: "event",
      triggerConfig: { eventType: "task.created" },
      steps: [{ key: "step-1", name: "Notify", type: "notification" }],
    });

    assert.equal(created.name, "Task created workflow");
    assert.equal(created.description, "Notify on task create");
    assert.equal(created.triggerConfigObject.eventType, "task.created");
    assert.equal(created.stepsArray[0]?.name, "Notify");

    const fetched = schema.getWorkflowDefinition(db, created.id);
    assert.ok(fetched);
    assert.equal(fetched?.id, created.id);

    const listed = schema.listWorkflowDefinitions(db, {
      status: "active",
      projectId: "project-1",
      triggerType: "event",
      limit: 1,
    });

    assert.equal(listed.length, 1);
    assert.equal(listed[0]?.id, created.id);
  });

  it("starts runs, records steps, and finishes runs with parsed metadata", () => {
    const workflow = schema.createWorkflowDefinition(db, {
      name: "Deploy workflow",
      status: "active",
      triggerType: "manual",
      steps: [{ name: "Create task", type: "task" }],
    });

    const run = schema.startWorkflowRun(db, {
      workflowId: workflow.id,
      triggeredBy: "human",
      triggeredById: "agent-1",
      metadata: { source: "manual-test" },
    });

    assert.equal(run.status, "running");
    assert.equal(run.metadataObject.source, "manual-test");

    const step = schema.recordWorkflowRunStep(db, {
      workflowRunId: run.id,
      stepIndex: 0,
      stepName: "Create task",
      stepType: "task",
      status: "completed",
      input: { title: "Follow up" },
      result: { taskId: "task-1" },
    });

    assert.equal(step.stepKey, "step-1");
    assert.equal(step.inputObject.title, "Follow up");
    assert.equal(step.resultObject.taskId, "task-1");

    const finished = schema.finishWorkflowRun(db, run.id, {
      status: "completed",
      result: { createdTaskId: "task-1" },
      metadata: { source: "manual-test", steps: 1 },
    });

    assert.equal(finished.status, "completed");
    assert.equal(finished.resultObject.createdTaskId, "task-1");
    assert.equal(finished.metadataObject.steps, 1);

    const persistedRun = db
      .select()
      .from(schema.workflowRuns)
      .where(schema.eq(schema.workflowRuns.id, run.id))
      .get();
    const persistedStep = db
      .select()
      .from(schema.workflowRunSteps)
      .where(schema.eq(schema.workflowRunSteps.id, step.id))
      .get();

    assert.equal(persistedRun.status, "completed");
    assert.equal(persistedStep.stepName, "Create task");
  });
});
