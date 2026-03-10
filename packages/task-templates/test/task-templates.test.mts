import { before, describe, it } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { DB } from "@clawops/core";
import * as schema from "@clawops/core";
import {
  listTemplates,
  getTemplateByName,
  listTemplateStages,
  createTemplate,
  getBuiltInTemplateNames,
} from "../dist/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let db: DB;

before(() => {
  const sqlite = new Database(":memory:");
  db = drizzle(sqlite, { schema }) as DB;
  sqlite.exec(
    fs.readFileSync(path.resolve(__dirname, "../../core/migrations/0003_romantic_garia.sql"), "utf8"),
  );
});

describe("task templates (integration)", () => {
  it("built-in templates exist after migrations", () => {
    const templates = listTemplates(db);
    const builtInNames = new Set(templates.filter((template) => template.isBuiltIn).map((template) => template.name));

    assert.deepStrictEqual([...builtInNames].sort(), [...getBuiltInTemplateNames()].sort());
  });

  it("built-in stages are ordered within a template", () => {
    const coding = getTemplateByName(db, "coding");

    assert.ok(coding);
    assert.deepStrictEqual(
      coding.stages.map((stage) => stage.order),
      [...coding.stages].map((stage) => stage.order).sort((left, right) => left - right),
    );
    assert.strictEqual(coding.stages[0]?.name, "Analysis");
    assert.strictEqual(coding.stages.at(-1)?.name, "Review");
  });

  it("createTemplate stores template-scoped stages", () => {
    const template = createTemplate(db, {
      name: "custom-flow",
      description: "Custom workflow",
      isCustom: true,
      stages: [
        { name: "First" },
        { name: "Second", order: 4 },
      ],
    });

    const stages = listTemplateStages(db, template.id);

    assert.strictEqual(stages.length, 2);
    assert.ok(stages.every((stage) => stage.templateId === template.id));
    assert.deepStrictEqual(
      stages.map((stage) => ({ name: stage.name, order: stage.order })),
      [
        { name: "First", order: 0 },
        { name: "Second", order: 4 },
      ],
    );
  });
});
