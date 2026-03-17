import type { Agent as DbAgent } from "@clawops/core";
import type { Task as DbTask, Artifact as DbArtifact, ResourceLink as DbResourceLink } from "@clawops/core";
import type { Project as DbProject } from "@clawops/core";
import type { Habit as DbHabit } from "@clawops/core";
import type { Idea as DbIdea } from "@clawops/core";
import type { Habit as HabitType, Task as TaskType, Artifact as ArtifactType, ResourceLink as ResourceLinkType, ProjectListItem as ProjectListItemType, Agent as AgentType, Idea as IdeaType } from "@/lib/types";

export function mapAgent(dbAgent: DbAgent): AgentType {
  return {
    ...dbAgent,
    lastActive: dbAgent.lastActive?.toISOString() ?? null,
    createdAt: dbAgent.createdAt.toISOString(),
  };
}

export function mapTask(dbTask: DbTask): TaskType {
  return {
    ...dbTask,
    createdAt: dbTask.createdAt.toISOString(),
    dueDate: dbTask.dueDate?.toISOString() ?? null,
    completedAt: dbTask.completedAt?.toISOString() ?? null,
    specUpdatedAt: dbTask.specUpdatedAt?.toISOString() ?? null,
  };
}

export function mapArtifact(dbArtifact: DbArtifact): ArtifactType {
  return {
    ...dbArtifact,
    createdAt: dbArtifact.createdAt.toISOString(),
  };
}

export function mapResourceLink(dbResourceLink: DbResourceLink): ResourceLinkType {
  return {
    ...dbResourceLink,
    createdAt: dbResourceLink.createdAt.toISOString(),
  };
}

export function mapProject(dbProject: DbProject): ProjectListItemType {
  return {
    ...dbProject,
    createdAt: dbProject.createdAt.toISOString(),
    prdUpdatedAt: dbProject.prdUpdatedAt?.toISOString() ?? null,
    specUpdatedAt: dbProject.specUpdatedAt?.toISOString() ?? null,
  };
}

export function mapHabit(dbHabit: DbHabit): HabitType {
  return {
    ...dbHabit,
    createdAt: dbHabit.createdAt.toISOString(),
    lastRun: dbHabit.lastRun?.toISOString() ?? null,
    nextRun: dbHabit.nextRun?.toISOString() ?? null,
  };
}

export function mapIdea(dbIdea: DbIdea): IdeaType {
  return {
    ...dbIdea,
    createdAt: dbIdea.createdAt.toISOString(),
  };
}
