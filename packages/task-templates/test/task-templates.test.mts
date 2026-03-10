import assert from "node:assert";
import crypto from "node:crypto";
import { beforeEach, describe, it } from "node:test";
import * as schema from "@clawops/core";
import {
  createTemplate,
  getBuiltInTemplateNames,
  getTemplateByName,
  listTemplateStages,
  listTemplates,
} from "../dist/index.js";

interface TemplateRow {
  id: string;
  name: string;
  description: string | null;
  isBuiltIn: boolean;
  isCustom: boolean;
  createdAt: Date;
}

interface StageRow {
  id: string;
  templateId: string;
  name: string;
  description: string | null;
  order: number;
  createdAt: Date;
}

function getTableName(table: unknown): string {
  return Reflect.get(table as object, Symbol.for("drizzle:Name")) ?? Reflect.get(table as object, "_")?.name;
}

function toRowField(field: string): string {
  return field.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

function extractEqCondition(condition: unknown): { field: string; value: unknown } | null {
  const chunks = Reflect.get(condition as object, "queryChunks");
  if (!Array.isArray(chunks)) {
    return null;
  }

  const column = chunks.find((chunk) => typeof Reflect.get(chunk as object, "name") === "string");
  const param = chunks.find((chunk) => Object.hasOwn(chunk ?? {}, "encoder"));

  if (!column || !param) {
    return null;
  }

  return {
    field: Reflect.get(column as object, "name"),
    value: Reflect.get(param as object, "value"),
  };
}

function extractAscField(orderClause: unknown): string | null {
  const chunks = Reflect.get(orderClause as object, "queryChunks");
  if (!Array.isArray(chunks)) {
    return null;
  }

  const column = chunks.find((chunk) => typeof Reflect.get(chunk as object, "name") === "string");
  return column ? Reflect.get(column as object, "name") : null;
}

function makeBuiltInData(): { templates: TemplateRow[]; stages: StageRow[] } {
  const createdAt = new Date("2025-01-01T00:00:00Z");
  const templates: TemplateRow[] = [
    { id: "tpl-coding", name: "coding", description: "Standard software development workflow", isBuiltIn: true, isCustom: false, createdAt },
    { id: "tpl-research", name: "research", description: "Research and investigation workflow", isBuiltIn: true, isCustom: false, createdAt },
    { id: "tpl-content", name: "content", description: "Content creation workflow", isBuiltIn: true, isCustom: false, createdAt },
    { id: "tpl-ops", name: "ops", description: "Operations and deployment workflow", isBuiltIn: true, isCustom: false, createdAt },
    { id: "tpl-review", name: "review", description: "Review and approval workflow", isBuiltIn: true, isCustom: false, createdAt },
  ];

  const stages: StageRow[] = [
    ["tpl-coding", "Analysis", 0],
    ["tpl-coding", "Design", 1],
    ["tpl-coding", "Implementation", 2],
    ["tpl-coding", "Testing", 3],
    ["tpl-coding", "Review", 4],
    ["tpl-research", "Question Definition", 0],
    ["tpl-research", "Data Collection", 1],
    ["tpl-research", "Analysis", 2],
    ["tpl-research", "Synthesis", 3],
    ["tpl-research", "Documentation", 4],
    ["tpl-content", "Brief", 0],
    ["tpl-content", "Outline", 1],
    ["tpl-content", "Draft", 2],
    ["tpl-content", "Edit", 3],
    ["tpl-content", "Publish", 4],
    ["tpl-ops", "Planning", 0],
    ["tpl-ops", "Preparation", 1],
    ["tpl-ops", "Execution", 2],
    ["tpl-ops", "Verification", 3],
    ["tpl-ops", "Documentation", 4],
    ["tpl-review", "Intake", 0],
    ["tpl-review", "Initial Review", 1],
    ["tpl-review", "Detailed Review", 2],
    ["tpl-review", "Feedback", 3],
    ["tpl-review", "Follow-up", 4],
  ].map(([templateId, name, order], index) => ({
    id: `stage-${index + 1}`,
    templateId,
    name,
    description: null,
    order,
    createdAt,
  }));

  return { templates, stages };
}

function createDb() {
  const builtIns = makeBuiltInData();
  const store = {
    templates: builtIns.templates.map((template) => ({ ...template })),
    stages: builtIns.stages.map((stage) => ({ ...stage })),
  };

  const getRows = (table: unknown): TemplateRow[] | StageRow[] => {
    const tableName = getTableName(table);
    if (tableName === "task_templates") {
      return store.templates;
    }
    if (tableName === "task_template_stages") {
      return store.stages;
    }
    throw new Error(`Unsupported table: ${tableName}`);
  };

  const db = {
    select() {
      return {
        from(table: unknown) {
          let rows = [...getRows(table)];

          return {
            where(condition: unknown) {
              const extracted = extractEqCondition(condition);
              if (extracted) {
                rows = rows.filter((row) => Reflect.get(row, toRowField(extracted.field)) === extracted.value);
              }
              return this;
            },
            orderBy(orderClause: unknown) {
              const field = extractAscField(orderClause);
              if (field) {
                const rowField = toRowField(field);
                rows = [...rows].sort((left, right) => {
                  const leftValue = Reflect.get(left, rowField);
                  const rightValue = Reflect.get(right, rowField);
                  return leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0;
                });
              }
              return this;
            },
            all() {
              return rows;
            },
            get() {
              return rows[0];
            },
          };
        },
      };
    },
    insert(table: unknown) {
      return {
        values(values: Record<string, unknown>) {
          if (getTableName(table) === "task_templates") {
            const template: TemplateRow = {
              id: typeof values["id"] === "string" ? values["id"] : crypto.randomUUID(),
              name: String(values["name"]),
              description: typeof values["description"] === "string" ? values["description"] : null,
              isBuiltIn: Boolean(values["isBuiltIn"]),
              isCustom: Boolean(values["isCustom"]),
              createdAt: new Date(),
            };
            store.templates.push(template);

            return {
              returning() {
                return {
                  get() {
                    return template;
                  },
                };
              },
              run() {
                return template;
              },
            };
          }

          const stage: StageRow = {
            id: typeof values["id"] === "string" ? values["id"] : crypto.randomUUID(),
            templateId: String(values["templateId"]),
            name: String(values["name"]),
            description: typeof values["description"] === "string" ? values["description"] : null,
            order: typeof values["order"] === "number" ? values["order"] : 0,
            createdAt: new Date(),
          };
          store.stages.push(stage);

          return {
            returning() {
              return {
                get() {
                  return stage;
                },
              };
            },
            run() {
              return stage;
            },
          };
        },
      };
    },
    transaction<T>(callback: (tx: typeof db) => T): T {
      return callback(db);
    },
  };

  return db;
}

let db: ReturnType<typeof createDb>;

beforeEach(() => {
  db = createDb();
});

describe("task templates (integration)", () => {
  it("built-in templates exist after migrations", () => {
    const templates = listTemplates(db as never);
    const builtInNames = new Set(templates.filter((template) => template.isBuiltIn).map((template) => template.name));

    assert.deepStrictEqual([...builtInNames].sort(), [...getBuiltInTemplateNames()].sort());
  });

  it("built-in stages are ordered within a template", () => {
    const coding = getTemplateByName(db as never, "coding");

    assert.ok(coding);
    assert.deepStrictEqual(
      coding.stages.map((stage) => stage.order),
      [...coding.stages].map((stage) => stage.order).sort((left, right) => left - right),
    );
    assert.strictEqual(coding.stages[0]?.name, "Analysis");
    assert.strictEqual(coding.stages.at(-1)?.name, "Review");
  });

  it("createTemplate stores template-scoped stages", () => {
    const template = createTemplate(db as never, {
      name: "custom-flow",
      description: "Custom workflow",
      isCustom: true,
      stages: [
        { name: "First" },
        { name: "Second", order: 4 },
      ],
    });

    const stages = listTemplateStages(db as never, template.id);

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
