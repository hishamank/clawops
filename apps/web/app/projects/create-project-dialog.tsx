"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createProjectAction, type CreateProjectActionState } from "./actions";

const initialState: CreateProjectActionState = {};

export function CreateProjectDialog(): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(createProjectAction, initialState);

  useEffect(() => {
    if (state.success) {
      setOpen(false);
    }
  }, [state.success]);

  function handleOpenChange(nextOpen: boolean): void {
    setOpen(nextOpen);
  }

  if (open) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Create New Project</CardTitle>
          </CardHeader>
          <form action={formAction}>
            <CardContent className="space-y-4">
              {state.error && (
                <div className="rounded-md bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-sm text-rose-400">
                  {state.error}
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="name" className="text-sm font-medium">
                  Name <span className="text-rose-400">*</span>
                </label>
                <input
                  id="name"
                  name="name"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="Project name"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="description" className="text-sm font-medium">
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[100px]"
                  placeholder="Project description"
                  rows={4}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="repoUrl" className="text-sm font-medium">
                  Repo URL
                </label>
                <input
                  id="repoUrl"
                  name="repoUrl"
                  type="url"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="https://github.com/owner/repo"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="directoryPath" className="text-sm font-medium">
                  Directory Path
                </label>
                <input
                  id="directoryPath"
                  name="directoryPath"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="/path/to/project"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Creating..." : "Create Project"}
                </Button>
              </div>
            </CardContent>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <Button onClick={() => handleOpenChange(true)}>
      <Plus className="h-4 w-4 mr-2" />
      New Project
    </Button>
  );
}
