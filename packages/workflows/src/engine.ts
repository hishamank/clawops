import { createActivityEvent, type DB } from "@clawops/core";
import { createTask, updateTask } from "@clawops/tasks";
import { createNotification } from "@clawops/notifications";
import { triggerSupportedOpenClawEndpoint } from "@clawops/sync/openclaw";
import {
  createWorkflowRun,
  updateWorkflowRun,
  createWorkflowRunStep,
  updateWorkflowRunStep,
  getWorkflowDefinition,
  listWorkflowDefinitions,
  type WorkflowRecord,
  type WorkflowStepDefinition,
} from "./index.js";

export interface WorkflowExecutionInput {
  triggeredBy?: "human" | "agent" | "schedule" | "event";
  triggeredById?: string;
  metadata?: Record<string, unknown>;
}

interface StepContext {
  runId: string;
  stepResults: Record<string, unknown>;
}

export function matchEventTrigger(db: DB, eventType: string): WorkflowRecord[] {
  const workflows = listWorkflowDefinitions(db, {
    status: "active",
    triggerType: "event",
  });

  return workflows.filter(
    (w) => w.triggerConfigObject["eventType"] === eventType,
  );
}

function resolvePath(path: string, data: Record<string, unknown>): unknown {
  const parts = path.split(".");
  let current: unknown = data;
  for (const part of parts) {
    if (current == null || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function evaluateCondition(condition: string, ctx: StepContext): boolean {
  try {
    const parsed: unknown = JSON.parse(condition);
    if (
      parsed == null ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      return true;
    }

    const rule = parsed as Record<string, unknown>;
    const path = rule["path"];
    const op = rule["op"];
    const expected = rule["value"];

    if (typeof path !== "string" || typeof op !== "string") {
      return true;
    }

    const actual = resolvePath(path, ctx.stepResults);

    switch (op) {
      case "eq":
        return actual === expected;
      case "neq":
        return actual !== expected;
      case "gt":
        return typeof actual === "number" && typeof expected === "number" && actual > expected;
      case "lt":
        return typeof actual === "number" && typeof expected === "number" && actual < expected;
      default:
        return true;
    }
  } catch {
    return true;
  }
}

async function dispatchAction(
  db: DB,
  step: WorkflowStepDefinition,
  stepResults: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const config = (step.config ?? {}) as Record<string, unknown>;

  switch (step.type) {
    case "task": {
      if (config["action"] === "create") {
        const title = config["title"];
        if (typeof title !== "string") {
          throw new Error('task.create step requires "title" in config');
        }
        // Pass config as-is at runtime; engine trusts caller to provide valid fields
        const task = createTask(db, config as unknown as Parameters<typeof createTask>[1]);
        return { id: task.id, title: task.title, status: task.status };
      } else {
        const taskId = config["taskId"];
        if (typeof taskId !== "string") {
          throw new Error('task step with action "update" requires taskId in config');
        }
        const task = updateTask(db, taskId, config as unknown as Parameters<typeof updateTask>[2]);
        return { id: task.id, title: task.title, status: task.status };
      }
    }

    case "notification": {
      const notification = createNotification(db, {
        type: typeof config["type"] === "string" ? config["type"] : "info",
        title: typeof config["title"] === "string" ? config["title"] : "Workflow notification",
        body: typeof config["body"] === "string" ? config["body"] : "",
        entityType: typeof config["entityType"] === "string" ? config["entityType"] : "workflow",
        entityId: typeof config["entityId"] === "string" ? config["entityId"] : "",
      });
      return { id: notification.id };
    }

    case "agent": {
      const connectionId = config["connectionId"];
      const endpoint = config["endpoint"];
      if (typeof connectionId !== "string") {
        throw new Error("agent step requires connectionId in config");
      }
      if (typeof endpoint !== "string") {
        throw new Error("agent step requires endpoint in config");
      }
      const result = await triggerSupportedOpenClawEndpoint(db, {
        connectionId,
        endpoint,
        body: config["body"] as Record<string, unknown> | undefined,
        source: "workflow",
      });
      return { status: result.status, response: result.response };
    }

    case "condition": {
      const conditionStr = config["condition"];
      if (typeof conditionStr !== "string") {
        return { passed: true };
      }
      const ctx: StepContext = { runId: "", stepResults };
      return { passed: evaluateCondition(conditionStr, ctx) };
    }

    case "wait":
    case "webhook":
    case "script":
    case "parallel":
      throw new Error(`step type "${step.type}" not yet supported`);

    default:
      throw new Error(`unknown step type "${step.type}"`);
  }
}

export async function executeWorkflow(
  db: DB,
  workflowId: string,
  input: WorkflowExecutionInput,
): Promise<string> {
  const workflow = getWorkflowDefinition(db, workflowId);
  if (!workflow) {
    throw new Error(`Workflow "${workflowId}" not found`);
  }
  if (workflow.status !== "active") {
    throw new Error(`Workflow "${workflowId}" is not active (status: ${workflow.status})`);
  }

  const triggeredBy = input.triggeredBy ?? "human";

  const run = createWorkflowRun(db, {
    workflowId,
    triggeredBy,
    triggeredById: input.triggeredById,
    status: "running",
    startedAt: new Date(),
    metadata: input.metadata,
  });

  createActivityEvent(db, {
    source: "workflow",
    type: "workflow.run.started",
    title: `Workflow run started: ${workflow.name}`,
    entityType: "workflow",
    entityId: workflowId,
    metadata: JSON.stringify({ runId: run.id, triggeredBy }),
  });

  const stepResults: Record<string, unknown> = {};
  const ctx: StepContext = { runId: run.id, stepResults };

  let runFailed = false;
  let runError: string | undefined;

  for (let i = 0; i < workflow.stepsArray.length; i++) {
    const step = workflow.stepsArray[i];
    if (!step) continue;
    const stepKey = step.key?.trim() || `step-${i + 1}`;

    const stepRow = createWorkflowRunStep(db, {
      workflowRunId: run.id,
      stepIndex: i,
      stepKey,
      stepName: step.name,
      stepType: step.type,
      status: "running",
      startedAt: new Date(),
    });

    if (step.condition && !evaluateCondition(step.condition, ctx)) {
      updateWorkflowRunStep(db, stepRow.id, {
        status: "skipped",
        completedAt: new Date(),
      });
      continue;
    }

    const maxAttempts =
      (step.onError === "retry" ? (step.retryCount ?? 1) : 0) + 1;

    let stepResult: Record<string, unknown> | undefined;
    let stepFailed = false;
    let stepError: string | undefined;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        stepResult = await dispatchAction(db, step, stepResults);
        updateWorkflowRunStep(db, stepRow.id, {
          status: "completed",
          result: stepResult,
          completedAt: new Date(),
        });
        stepFailed = false;
        break;
      } catch (e) {
        stepError = e instanceof Error ? e.message : String(e);
        if (attempt === maxAttempts - 1) {
          stepFailed = true;
          updateWorkflowRunStep(db, stepRow.id, {
            status: "failed",
            error: stepError,
            completedAt: new Date(),
          });
        }
      }
    }

    if (stepFailed) {
      const onError = step.onError ?? "stop";
      if (onError === "stop") {
        runFailed = true;
        runError = stepError;
        break;
      } else {
        // onError === "continue"
        stepResults[stepKey] = { error: stepError };
        continue;
      }
    }

    stepResults[stepKey] = stepResult ?? {};
  }

  const finalStatus = runFailed ? "failed" : "completed";

  updateWorkflowRun(db, run.id, {
    status: finalStatus,
    completedAt: new Date(),
    result: { stepResults },
    error: runError ?? null,
  });

  createActivityEvent(db, {
    source: "workflow",
    type: runFailed ? "workflow.run.failed" : "workflow.run.completed",
    title: `Workflow run ${finalStatus}: ${workflow.name}`,
    entityType: "workflow",
    entityId: workflowId,
    metadata: JSON.stringify({ runId: run.id, triggeredBy, error: runError }),
  });

  return run.id;
}
