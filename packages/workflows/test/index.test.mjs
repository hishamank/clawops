import assert from "node:assert";
import { describe, it } from "node:test";

import * as workflows from "../dist/index.js";

describe("validateCreateWorkflow", () => {
  it("accepts a valid workflow definition", () => {
    assert.doesNotThrow(() => {
      workflows.validateCreateWorkflow({
        name: "Deploy workflow",
        triggerType: "manual",
        steps: [
          { name: "Create task", type: "task" },
          { name: "Notify", type: "notification", onError: "continue" },
        ],
      });
    });
  });

  it("rejects empty step arrays", () => {
    assert.throws(
      () => {
        workflows.validateCreateWorkflow({
          name: "Broken workflow",
          steps: [],
        });
      },
      /at least one step/i,
    );
  });
});

describe("validateUpdateWorkflow", () => {
  it("accepts partial updates without name or steps", () => {
    assert.doesNotThrow(() => {
      workflows.validateUpdateWorkflow({
        status: "paused",
      });
    });
  });

  it("rejects empty names when explicitly provided", () => {
    assert.throws(
      () => {
        workflows.validateUpdateWorkflow({
          name: "   ",
        });
      },
      /cannot be empty/i,
    );
  });
});

describe("validateTriggerConfig", () => {
  it("requires eventType for event triggers", () => {
    assert.throws(
      () => {
        workflows.validateTriggerConfig("event", {});
      },
      /eventType/i,
    );
  });

  it("accepts webhook triggers with a path", () => {
    assert.doesNotThrow(() => {
      workflows.validateTriggerConfig("webhook", { path: "/hooks/workflow" });
    });
  });
});
