import { eq, asc } from "drizzle-orm";
import type { DB, TaskTemplate, TaskTemplateStage } from "@clawops/core";
import { taskTemplates, taskTemplateStages } from "@clawops/core";

// ── Built-in Template Definitions ──────────────────────────────────────────

const BUILTIN_TEMPLATES = [
  {
    name: "coding",
    description: "Standard software development workflow",
    stages: [
      { name: "Analysis", description: "Understand requirements and constraints", order: 0 },
      { name: "Design", description: "Plan the implementation approach", order: 1 },
      { name: "Implementation", description: "Write the code", order: 2 },
      { name: "Testing", description: "Verify functionality with tests", order: 3 },
      { name: "Review", description: "Code review and refinements", order: 4 },
    ],
  },
  {
    name: "research",
    description: "Research and investigation workflow",
    stages: [
      { name: "Question Definition", description: "Define the research question", order: 0 },
      { name: "Data Collection", description: "Gather relevant information", order: 1 },
      { name: "Analysis", description: "Analyze findings", order: 2 },
      { name: "Synthesis", description: "Draw conclusions", order: 3 },
      { name: "Documentation", description: "Document results", order: 4 },
    ],
  },
  {
    name: "content",
    description: "Content creation workflow",
    stages: [
      { name: "Brief", description: "Define content requirements", order: 0 },
      { name: "Outline", description: "Create content structure", order: 1 },
      { name: "Draft", description: "Write initial content", order: 2 },
      { name: "Edit", description: "Review and refine", order: 3 },
      { name: "Publish", description: "Finalize and publish", order: 4 },
    ],
  },
  {
    name: "ops",
    description: "Operations and deployment workflow",
    stages: [
      { name: "Planning", description: "Plan the operation", order: 0 },
      { name: "Preparation", description: "Set up prerequisites", order: 1 },
      { name: "Execution", description: "Execute the operation", order: 2 },
      { name: "Verification", description: "Verify success", order: 3 },
      { name: "Documentation", description: "Document changes", order: 4 },
    ],
  },
  {
    name: "review",
    description: "Review and approval workflow",
    stages: [
      { name: "Intake", description: "Receive item for review", order: 0 },
      { name: "Initial Review", description: "First pass evaluation", order: 1 },
      { name: "Detailed Review", description: "In-depth analysis", order: 2 },
      { name: "Feedback", description: "Provide feedback", order: 3 },
      { name: "Follow-up", description: "Verify changes", order: 4 },
    ],
  },
];

// ── listTemplates ───────────────────────────────────────────────────────────

export function listTemplates(db: DB): TaskTemplate[] {
  return db.select().from(taskTemplates).all();
}

// ── getTemplate ─────────────────────────────────────────────────────────────

export function getTemplate(db: DB, id: string): (TaskTemplate & { stages: TaskTemplateStage[] }) | null {
  const template = db
    .select()
    .from(taskTemplates)
    .where(eq(taskTemplates.id, id))
    .get();
  
  if (!template) return null;

  const stages = db
    .select()
    .from(taskTemplateStages)
    .where(eq(taskTemplateStages.templateId, id))
    .orderBy(asc(taskTemplateStages.order))
    .all();

  return { ...template, stages };
}

// ── getTemplateByName ───────────────────────────────────────────────────────

export function getTemplateByName(db: DB, name: string): (TaskTemplate & { stages: TaskTemplateStage[] }) | null {
  const template = db
    .select()
    .from(taskTemplates)
    .where(eq(taskTemplates.name, name))
    .get();
  
  if (!template) return null;

  const stages = db
    .select()
    .from(taskTemplateStages)
    .where(eq(taskTemplateStages.templateId, template.id))
    .orderBy(asc(taskTemplateStages.order))
    .all();

  return { ...template, stages };
}

// ── createTemplate ──────────────────────────────────────────────────────────

interface CreateTemplateInput {
  name: string;
  description?: string;
  isBuiltIn?: boolean;
  isCustom?: boolean;
  stages?: Array<{ name: string; description?: string; order?: number }>;
}

export function createTemplate(db: DB, input: CreateTemplateInput): TaskTemplate {
  return db.transaction((tx) => {
    const template = tx
      .insert(taskTemplates)
      .values({
        name: input.name,
        description: input.description,
        isBuiltIn: input.isBuiltIn ?? false,
        isCustom: input.isCustom ?? false,
      })
      .returning()
      .get();

    if (input.stages && input.stages.length > 0) {
      for (const [stageIndex, stage] of input.stages.entries()) {
        tx.insert(taskTemplateStages).values({
          templateId: template.id,
          name: stage.name,
          description: stage.description,
          order: stage.order ?? stageIndex,
        }).run();
      }
    }

    return template;
  });
}

// ── listTemplateStages ──────────────────────────────────────────────────────

export function listTemplateStages(db: DB, templateId: string): TaskTemplateStage[] {
  return db
    .select()
    .from(taskTemplateStages)
    .where(eq(taskTemplateStages.templateId, templateId))
    .orderBy(asc(taskTemplateStages.order))
    .all();
}

// ── getStage ────────────────────────────────────────────────────────────────

export function getStage(db: DB, id: string): TaskTemplateStage | null {
  return db
    .select()
    .from(taskTemplateStages)
    .where(eq(taskTemplateStages.id, id))
    .get() ?? null;
}

// ── seedBuiltInTemplates ────────────────────────────────────────────────────

export function seedBuiltInTemplates(db: DB): void {
  db.transaction((tx) => {
    for (const templateDef of BUILTIN_TEMPLATES) {
      // Check if template already exists
      const existing = tx
        .select()
        .from(taskTemplates)
        .where(eq(taskTemplates.name, templateDef.name))
        .get();

      if (existing) {
        // Template exists, skip
        continue;
      }

      // Create the template
      const template = tx
        .insert(taskTemplates)
        .values({
          name: templateDef.name,
          description: templateDef.description,
          isBuiltIn: true,
          isCustom: false,
        })
        .returning()
        .get();

      // Create the stages
      for (const stageDef of templateDef.stages) {
        tx.insert(taskTemplateStages).values({
          templateId: template.id,
          name: stageDef.name,
          description: stageDef.description,
          order: stageDef.order,
        }).run();
      }
    }
  });
}

// ── getBuiltInTemplateNames ─────────────────────────────────────────────────

export function getBuiltInTemplateNames(): string[] {
  return BUILTIN_TEMPLATES.map((t) => t.name);
}
