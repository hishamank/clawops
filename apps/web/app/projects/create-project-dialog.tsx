"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function CreateProjectDialog(): React.JSX.Element {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [directoryPath, setDirectoryPath] = useState("");

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const apiKey = localStorage.getItem("apiKey");
      if (!apiKey) {
        setError("Not authenticated. Please log in.");
        return;
      }
      try {
        const response = await fetch("/api/projects", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
          },
          body: JSON.stringify({
            name,
            description: description || undefined,
            repoUrl: repoUrl || undefined,
            directoryPath: directoryPath || undefined,
          }),
        });
        if (!response.ok) {
          const data = await response.json();
          setError(data.error || "Failed to create project");
          return;
        }
        setOpen(false);
        setName("");
        setDescription("");
        setRepoUrl("");
        setDirectoryPath("");
        router.refresh();
      } catch {
        setError("Failed to create project");
      }
    });
  }

  if (open) {
    return (
      <Card className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 bg-card p-4">
        <div className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Create New Project</CardTitle>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <div className="rounded-md bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-sm text-rose-400">
                  {error}
                </div>
              )}
              <div className="space-y-2 gap-1.5">
                <label htmlFor="name" className="text-sm font-medium">
                  Name <span className="text-rose-400">*</span>
                </label>
                <input
                  id="name"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Project name"
                  required
                />
              </div>
              <div className="space-y-2 gap-1.5">
                <label htmlFor="description" className="text-sm font-medium">
                  Description
                </label>
                <textarea
                  id="description"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[100px]"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Project description"
                  rows={4}
                />
              </div>
              <div className="space-y-2 gap-1.5">
                <label htmlFor="repoUrl" className="text-sm font-medium">
                  Repo URL
                </label>
                <input
                  id="repoUrl"
                  type="url"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  placeholder="https://github.com/owner/repo"
                />
              </div>
              <div className="space-y-2 gap-1.5">
                <label htmlFor="directoryPath" className="text-sm font-medium">
                  Directory Path
                </label>
                <input
                  id="directoryPath"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={directoryPath}
                  onChange={(e) => setDirectoryPath(e.target.value)}
                  placeholder="/path/to/project"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending || !name.trim()}>
                  {isPending ? "Creating..." : "Create Project"}
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
      New Project
    </Button>
  );
}
