"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Textarea, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Project {
  id: string;
  name: string;
}

function parseTags(tags: string): string[] {
  return tags
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function getApiKey(): string | null {
  if (typeof document === "undefined") return null;
  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split("=");
    if (name === "api_key") {
      return decodeURIComponent(value);
    }
  }
  return null;
}

export function CreateIdeaDialog(): React.JSX.Element {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [projectId, setProjectId] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && projects.length === 0) {
      fetch("/api/projects")
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setProjects(data);
          }
        })
        .catch(() => {
          setProjects([]);
        });
    }
  }, [open, projects.length]);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    setError(null);
    startTransition(async () => {
      const apiKey = getApiKey();
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (apiKey) {
        headers["x-api-key"] = apiKey;
      }

      const body: Record<string, unknown> = {
        title: title.trim(),
        source: "human",
      };

      if (description.trim()) {
        body.description = description.trim();
      }

      const parsedTags = parseTags(tags);
      if (parsedTags.length > 0) {
        body.tags = parsedTags;
      }

      if (projectId) {
        body.projectId = projectId;
      }

      try {
        const response = await fetch("/api/ideas", {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });

        if (response.ok) {
          setOpen(false);
          setTitle("");
          setDescription("");
          setTags("");
          setProjectId("");
          setError(null);
          router.refresh();
        } else {
          const data = await response.json().catch(() => ({}));
          setError(data.error || "Failed to create idea");
        }
      } catch {
        setError("Failed to create idea");
      }
    });
  }

  if (open) {
    return (
      <Card className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              <CardTitle>New Idea</CardTitle>
            </div>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="title">Title <span className="text-destructive">*</span></Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Brief title for your idea"
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detailed description of your idea"
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tags">Tags</Label>
                <Input
                  id="tags"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="ux, research, feature (comma-separated)"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="project">Project</Label>
                <Select
                  id="project"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
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
                  onClick={() => {
                    setOpen(false);
                    setError(null);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending || !title.trim()}>
                  {isPending ? "Creating..." : "Create Idea"}
                </Button>
              </div>
            </CardContent>
          </form>
        </div>
      </Card>
    );
  }

  return (
    <Button onClick={() => setOpen(true)}>
      <Plus className="h-4 w-4 mr-2" />
      New Idea
    </Button>
  );
}
