"use client";

import { useActionState } from "react";
import { Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createWorkflow } from "./actions";

const initialState = { error: undefined };

export function NewWorkflowForm(): React.JSX.Element {
  const [state, formAction, isPending] = useActionState(createWorkflow, initialState);

  return (
    <div>
      {/* Error message */}
      {state.error && (
        <div className="rounded-lg bg-red-500/10 p-4 text-sm text-red-400 border border-red-500/20">
          {state.error}
        </div>
      )}

      <form action={formAction}>
        <Card>
          <CardHeader>
            <CardTitle>Workflow Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Name */}
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">
                Name *
              </label>
              <input
                id="name"
                name="name"
                placeholder="My workflow"
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label htmlFor="description" className="text-sm font-medium">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                placeholder="Describe what this workflow does"
                rows={3}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            {/* Status & Trigger Type */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="status" className="text-sm font-medium">
                  Status
                </label>
                <select
                  id="status"
                  name="status"
                  defaultValue="draft"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="deprecated">Deprecated</option>
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="triggerType" className="text-sm font-medium">
                  Trigger Type
                </label>
                <select
                  id="triggerType"
                  name="triggerType"
                  defaultValue="manual"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="manual">Manual</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="event">Event</option>
                  <option value="webhook">Webhook</option>
                </select>
              </div>
            </div>

            {/* Trigger Config */}
            <div className="space-y-2">
              <label htmlFor="triggerConfig" className="text-sm font-medium">
                Trigger Config (JSON)
              </label>
              <textarea
                id="triggerConfig"
                name="triggerConfig"
                placeholder='{"cronExpr": "0 * * * *"}'
                rows={3}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono"
              />
            </div>

            {/* Steps */}
            <div className="space-y-2">
              <label htmlFor="steps" className="text-sm font-medium">
                Steps (JSON) *
              </label>
              <textarea
                id="steps"
                name="steps"
                placeholder='[{"name": "Create Task", "type": "task", "config": {}}]'
                rows={8}
                required
                className="flex min-h-[160px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Define workflow steps as a JSON array. Each step needs a name and type.
              </p>
            </div>

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Create Workflow
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
