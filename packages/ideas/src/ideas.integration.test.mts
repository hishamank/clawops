import assert from "node:assert";
import crypto from "node:crypto";
import { describe, it, mock } from "node:test";

type IdeaStatus = "raw" | "reviewed" | "promoted" | "archived";
type ProjectStatus = "planning" | "active" | "paused" | "done";
type IdeaSource = "human" | "agent";

interface IdeaRow {
  id: string;
  title: string;
  description: string | null;
  status: IdeaStatus;
  tags: string | null;
  sections: string | null;
  projectId: string | null;
  source: IdeaSource;
  createdAt: Date;
}

interface ProjectRow {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  ideaId: string | null;
  prd: string | null;
  prdUpdatedAt: Date | null;
  specContent: string | null;
  specUpdatedAt: Date | null;
  createdAt: Date;
}

interface TaskRow {
  id: string;
  projectId: string | null;
  ideaId: string | null;
}

type TableName = "ideas" | "projects" | "tasks";
type Row = IdeaRow | ProjectRow | TaskRow;

interface ColumnRef<T extends TableName> {
  field: string;
  table: T;
}

interface TableRef<T extends TableName> {
  __table: T;
  id: ColumnRef<T>;
  status: ColumnRef<T>;
  description: ColumnRef<T>;
  createdAt: ColumnRef<T>;
  projectId?: ColumnRef<T>;
  ideaId?: ColumnRef<T>;
  sections?: ColumnRef<T>;
}

interface Condition {
  field: string;
  table: TableName;
  value: unknown;
}

interface StoreState {
  ideas: IdeaRow[];
  projects: ProjectRow[];
  tasks: TaskRow[];
}

interface RuntimeDb {
  select: (fields?: Record<string, ColumnRef<TableName>>) => {
    from: (table: TableRef<TableName>) => {
      where: (condition: Condition) => {
        all: () => unknown[];
      };
      all: () => unknown[];
    };
  };
  insert: (table: TableRef<TableName>) => {
    values: (values: Record<string, unknown>) => {
      returning: () => {
        all: () => unknown[];
      };
    };
  };
  update: (table: TableRef<TableName>) => {
    set: (values: Record<string, unknown>) => {
      where: (condition: Condition) => {
        returning: () => {
          all: () => unknown[];
        };
        run: () => void;
      };
    };
  };
  transaction: <T>(callback: (tx: RuntimeDb) => T) => T;
}

function createDbFromState(state: StoreState): RuntimeDb {
  const db: RuntimeDb = {
    select(fields) {
      return {
        from(table) {
          let condition: Condition | null = null;

          return {
            where(nextCondition) {
              condition = nextCondition;
              return {
                all() {
                  return getRows(state, table)
                    .filter((row) => matchesCondition(row, condition))
                    .map((row) => pickFields(row, fields));
                },
              };
            },
            all() {
              return getRows(state, table).map((row) => pickFields(row, fields));
            },
          };
        },
      };
    },
    insert(table) {
      return {
        values(values) {
          const inserted = table.__table === "ideas"
            ? createIdeaRow(values)
            : createProjectRow(values);

          if (isIdeaRow(inserted)) {
            state.ideas.push(inserted);
          } else {
            state.projects.push(inserted);
          }

          return {
            returning() {
              return {
                all() {
                  return [inserted];
                },
              };
            },
          };
        },
      };
    },
    update(table) {
      return {
        set(values) {
          return {
            where(condition) {
              const rows = getRows(state, table);
              const updatedRows = rows
                .filter((row) => matchesCondition(row, condition))
                .map((row) => Object.assign(row, values));

              return {
                returning() {
                  return {
                    all() {
                      return updatedRows;
                    },
                  };
                },
                run() {},
              };
            },
          };
        },
      };
    },
    transaction(callback) {
      const transactionState = cloneState(state);
      const transactionDb = createDbFromState(transactionState);

      try {
        const result = callback(transactionDb);
        state.ideas = transactionState.ideas;
        state.projects = transactionState.projects;
        state.tasks = transactionState.tasks;
        return result;
      } catch (error: unknown) {
        return (() => {
          throw error;
        })();
      }
    },
  };

  return db;
}

function makeTable<T extends TableName>(
  table: T,
  fields: readonly string[],
): TableRef<T> {
  const entries = Object.fromEntries(
    fields.map((field) => [field, { table, field }]),
  );

  return {
    __table: table,
    ...(entries as Omit<TableRef<T>, "__table">),
  };
}

const ideaTable = makeTable("ideas", [
  "id",
  "status",
  "description",
  "createdAt",
  "projectId",
  "sections",
] as const);

const projectTable = makeTable("projects", [
  "id",
  "status",
  "description",
  "createdAt",
  "ideaId",
] as const);

const tasksTable = makeTable("tasks", [
  "id",
  "projectId",
  "ideaId",
] as const);

class MockNotFoundError extends Error {}
class MockConflictError extends Error {}

function parseJsonArray(value: string | null): string[] {
  return value ? (JSON.parse(value) as string[]) : [];
}

function parseJsonObject(value: string | null): Record<string, string> {
  return value ? (JSON.parse(value) as Record<string, string>) : {};
}

function toJsonArray(value: string[]): string {
  return JSON.stringify(value);
}

function toJsonObject(value: Record<string, string | undefined>): string {
  return JSON.stringify(value);
}

mock.module("@clawops/core", {
  namedExports: {
    ideas: ideaTable,
    projects: projectTable,
    tasks: tasksTable,
    parseJsonArray,
    parseJsonObject,
    toJsonArray,
    toJsonObject,
  },
});

mock.module("@clawops/domain", {
  namedExports: {
    ConflictError: MockConflictError,
    NotFoundError: MockNotFoundError,
  },
});

mock.module("drizzle-orm", {
  namedExports: {
    eq: (column: ColumnRef<TableName>, value: unknown): Condition => ({
      field: column.field,
      table: column.table,
      value,
    }),
  },
});

const {
  IDEA_SECTION_KEYS,
  createIdea,
  getIdeaDraftPrd,
  getIdeaSection,
  getIdeaSections,
  listIdeas,
  promoteIdeaToProject,
  setIdeaDraftPrd,
  updateIdea,
  updateIdeaSection,
  updateIdeaSections,
} = await import("../dist/index.js");

function cloneState(state: StoreState): StoreState {
  return {
    ideas: state.ideas.map((idea) => ({ ...idea })),
    projects: state.projects.map((project) => ({ ...project })),
    tasks: state.tasks.map((task) => ({ ...task })),
  };
}

function isIdeaRow(row: Row): row is IdeaRow {
  return "title" in row && "source" in row;
}

function createIdeaRow(values: Record<string, unknown>): IdeaRow {
  const source = values["source"];
  const status = values["status"];

  return {
    id: crypto.randomUUID(),
    title: String(values["title"]),
    description: typeof values["description"] === "string" ? values["description"] : null,
    status: status === "reviewed" || status === "promoted" || status === "archived" ? status : "raw",
    tags: typeof values["tags"] === "string" ? values["tags"] : null,
    sections: typeof values["sections"] === "string" ? values["sections"] : null,
    projectId: typeof values["projectId"] === "string" ? values["projectId"] : null,
    source: source === "agent" ? "agent" : "human",
    createdAt: new Date(),
  };
}

function createProjectRow(values: Record<string, unknown>): ProjectRow {
  const status = values["status"];

  return {
    id: crypto.randomUUID(),
    name: String(values["name"]),
    description: typeof values["description"] === "string" ? values["description"] : null,
    status: status === "active" || status === "paused" || status === "done" ? status : "planning",
    ideaId: typeof values["ideaId"] === "string" ? values["ideaId"] : null,
    prd: typeof values["prd"] === "string" ? values["prd"] : null,
    prdUpdatedAt: values["prdUpdatedAt"] instanceof Date ? values["prdUpdatedAt"] : null,
    specContent: typeof values["specContent"] === "string" ? values["specContent"] : null,
    specUpdatedAt: values["specUpdatedAt"] instanceof Date ? values["specUpdatedAt"] : null,
    createdAt: new Date(),
  };
}

function makeIdea(values: Partial<IdeaRow> & Pick<IdeaRow, "id" | "title">): IdeaRow {
  return {
    id: values.id,
    title: values.title,
    description: values.description ?? null,
    status: values.status ?? "raw",
    tags: values.tags ?? null,
    sections: values.sections ?? null,
    projectId: values.projectId ?? null,
    source: values.source ?? "human",
    createdAt: values.createdAt ?? new Date(),
  };
}

function getRows(state: StoreState, table: TableRef<TableName>): Row[] {
  if (table.__table === "ideas") return state.ideas;
  if (table.__table === "tasks") return state.tasks;
  return state.projects;
}

function matchesCondition(row: Row, condition: Condition | null): boolean {
  if (!condition) {
    return true;
  }

  const rowValue = Reflect.get(row, condition.field);
  return rowValue === condition.value;
}

function pickFields(
  row: Row,
  fields: Record<string, ColumnRef<TableName>> | undefined,
): Record<string, unknown> | Row {
  if (!fields) {
    return row;
  }

  return Object.fromEntries(
    Object.entries(fields).map(([key, column]) => [key, Reflect.get(row, column.field)]),
  );
}

function createDb(initialState: Partial<StoreState> = {}): RuntimeDb {
  const state: StoreState = {
    ideas: initialState.ideas ? initialState.ideas.map((idea) => ({ ...idea })) : [],
    projects: initialState.projects ? initialState.projects.map((project) => ({ ...project })) : [],
    tasks: initialState.tasks ? initialState.tasks.map((task) => ({ ...task })) : [],
  };
  return createDbFromState(state);
}

describe("ideas (integration)", () => {
  it("creates ideas with defaults and stores tags as JSON", () => {
    const db = createDb();
    const idea = createIdea(db as never, {
      title: "Tagged idea",
      tags: ["frontend", "ux"],
    });

    assert.ok(idea.id);
    assert.strictEqual(idea.status, "raw");
    assert.strictEqual(idea.source, "human");
    assert.ok(idea.createdAt);
    assert.deepStrictEqual(parseJsonArray(idea.tags), ["frontend", "ux"]);
  });

  it("lists persisted ideas and filters by tag", () => {
    const db = createDb({
      ideas: [
        makeIdea({ id: "idea-1", title: "Raw frontend", tags: JSON.stringify(["frontend"]) }),
        makeIdea({ id: "idea-2", title: "Reviewed backend", tags: JSON.stringify(["backend"]), source: "agent" }),
        makeIdea({ id: "idea-3", title: "Archived ux", status: "archived", tags: JSON.stringify(["ux"]) }),
      ],
    });

    const all = listIdeas(db as never);
    const ux = listIdeas(db as never, { tag: "ux" });

    assert.deepStrictEqual(all.map((idea) => idea.title).sort(), ["Archived ux", "Raw frontend", "Reviewed backend"].sort());
    assert.deepStrictEqual(ux.map((idea) => idea.title), ["Archived ux"]);
  });

  it("updates idea fields in persisted state", () => {
    const db = createDb();
    const idea = createIdea(db as never, { title: "Old title", tags: ["draft"] });

    const updated = updateIdea(db as never, idea.id, {
      title: "New title",
      status: "reviewed",
      tags: ["final"],
    });

    assert.strictEqual(updated.title, "New title");
    assert.strictEqual(updated.status, "reviewed");
    assert.deepStrictEqual(parseJsonArray(updated.tags), ["final"]);
  });

  it("merges structured sections and exposes section helpers", () => {
    const db = createDb();
    const idea = createIdea(db as never, { title: "Sectioned idea" });

    updateIdeaSections(db as never, idea.id, {
      brainstorming: "Brainstorm",
      research: "Research",
    });
    updateIdeaSection(db as never, idea.id, "notes", "Notes");
    setIdeaDraftPrd(db as never, idea.id, "Draft PRD");

    const sections = getIdeaSections(db as never, idea.id);

    assert.deepStrictEqual(Object.keys(sections).sort(), [...IDEA_SECTION_KEYS].filter((key) => key !== "similarIdeas").sort());
    assert.strictEqual(getIdeaSection(db as never, idea.id, "research"), "Research");
    assert.strictEqual(getIdeaDraftPrd(db as never, idea.id), "Draft PRD");
  });

  it("throws NotFoundError when reading or updating missing idea sections", () => {
    const db = createDb();

    assert.throws(
      () => getIdeaSections(db as never, "missing-idea"),
      (error: unknown) => error instanceof MockNotFoundError,
    );
    assert.throws(
      () => updateIdeaSection(db as never, "missing-idea", "brainstorming", "content"),
      (error: unknown) => error instanceof MockNotFoundError,
    );
  });

  it("promotes an idea into a project and preserves tag context in the project description", () => {
    const db = createDb();
    const idea = createIdea(db as never, {
      title: "Promote me",
      description: "A great idea",
      tags: ["automation", "ops"],
    });

    const result = promoteIdeaToProject(db as never, idea.id);

    assert.strictEqual(result.idea.status, "promoted");
    assert.strictEqual(result.idea.projectId, result.project.id);
    assert.strictEqual(result.project.name, "Promote me");
    assert.strictEqual(result.project.ideaId, idea.id);
    assert.strictEqual(result.project.description, "A great idea\n\nTags: automation, ops");
  });

  it("throws ConflictError when promoting an idea twice", () => {
    const db = createDb();
    const idea = createIdea(db as never, { title: "Already promoted" });

    promoteIdeaToProject(db as never, idea.id);

    assert.throws(
      () => promoteIdeaToProject(db as never, idea.id),
      (error: unknown) => error instanceof MockConflictError,
    );
  });

  it("throws NotFoundError when promoting a missing idea", () => {
    const db = createDb();

    assert.throws(
      () => promoteIdeaToProject(db as never, "missing-idea"),
      (error: unknown) => error instanceof MockNotFoundError,
    );
  });
});
