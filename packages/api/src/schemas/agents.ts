import { z } from "zod";

export const createAgentSchema = z.object({
  name: z.string().min(1, "Name is required"),
  metadata: z.record(z.unknown()).optional(),
});

export const updateAgentSchema = z.object({
  status: z.enum(["online", "offline", "error"]),
  metadata: z.record(z.unknown()).optional(),
});

export const agentIdParamSchema = z.object({
  id: z.string().uuid("Invalid agent ID"),
});
