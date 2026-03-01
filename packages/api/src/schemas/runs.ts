import { z } from "zod";

export const createRunSchema = z.object({
  agentId: z.string().uuid("Invalid agent ID"),
  task: z.string().min(1, "Task is required"),
});

export const updateRunSchema = z.object({
  status: z.enum(["pending", "running", "completed", "failed"]).optional(),
  output: z.string().optional(),
  error: z.string().optional(),
});

export const runIdParamSchema = z.object({
  id: z.string().uuid("Invalid run ID"),
});

export const listRunsQuerySchema = z.object({
  agent: z.string().uuid("Invalid agent ID").optional(),
  status: z.enum(["pending", "running", "completed", "failed"]).optional(),
});
