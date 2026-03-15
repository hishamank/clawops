"use server";

import { redirect } from "next/navigation";

export async function createWorkflow(
  _prevState: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string }> {
  const name = formData.get("name") as string;
  const description = formData.get("description") as string | null;
  const status = formData.get("status") as string;
  const triggerType = formData.get("triggerType") as string;
  const triggerConfig = formData.get("triggerConfig") as string;
  const steps = formData.get("steps") as string;

  if (!name) {
    return { error: "Name is required" };
  }

  let parsedTriggerConfig: Record<string, unknown> | undefined;
  if (triggerConfig) {
    try {
      parsedTriggerConfig = JSON.parse(triggerConfig);
    } catch {
      return { error: "Trigger config must be valid JSON" };
    }
  }

  let parsedSteps: Array<Record<string, unknown>>;
  try {
    parsedSteps = JSON.parse(steps || "[]");
    if (!Array.isArray(parsedSteps) || parsedSteps.length === 0) {
      return { error: "At least one step is required" };
    }
  } catch {
    return { error: "Steps must be valid JSON" };
  }

  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/workflows`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description: description || undefined,
        status,
        triggerType,
        triggerConfig: parsedTriggerConfig,
        steps: parsedSteps,
      }),
    });

    if (!res.ok) {
      const errorData = await res.json();
      return { error: errorData.message || "Failed to create workflow" };
    }

    const workflow = await res.json();
    redirect(`/workflows/${workflow.id}`);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to create workflow" };
  }
}
