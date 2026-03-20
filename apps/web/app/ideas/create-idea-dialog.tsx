"use client";

import { useActionState, useCallback, useEffect, useState } from "react";
import { Plus, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Textarea, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createIdeaAction, type CreateIdeaActionState } from "./actions";

interface Project {
  id: string;
  name: string;
}

const initialState: CreateIdeaActionState = {};

export function CreateIdeaDialog({ projects }: { projects: Project[] }): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [formVersion, setFormVersion] = useState(0);
  const [state, formAction, isPending] = useActionState(createIdeaAction, initialState);

  const closeDialog = useCallback((): void => {
    setOpen(false);
    setFormVersion((current) => current + 1);
  }, []);

  useEffect(() => {
    if (state.success) {
      closeDialog();
    }
  }, [closeDialog, state.success]);

  if (open) {
    return (
      <div key={formVersion} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              <CardTitle>New Idea</CardTitle>
            </div>
          </CardHeader>
          <form action={formAction}>
            <CardContent className="space-y-4">
              {state.error && (
                <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                  {state.error}
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="title">Title <span className="text-destructive">*</span></Label>
                <Input
                  id="title"
                  name="title"
                  placeholder="Brief title for your idea"
                  required
                  autoFocus
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="Detailed description of your idea"
                  rows={4}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tags">Tags</Label>
                <Input
                  id="tags"
                  name="tags"
                  placeholder="ux, research, feature (comma-separated)"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="project">Project</Label>
                <Select
                  id="project"
                  name="projectId"
                  defaultValue=""
                >
                  <option value="">No project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeDialog}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Creating..." : "Create Idea"}
                </Button>
              </div>
            </CardContent>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <Button onClick={() => setOpen(true)}>
      <Plus className="h-4 w-4 mr-2" />
      New Idea
    </Button>
  );
}
