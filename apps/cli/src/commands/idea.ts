import { Command } from "commander";
import { api } from "../lib/client.js";

export const ideaCmd = new Command("idea").description("Manage ideas");

ideaCmd
  .command("add")
  .description("Add a new idea")
  .argument("<title>", "Idea title")
  .option("--desc <description>", "Idea description")
  .option("--tags <tags>", "Comma-separated tags")
  .option("--json", "Output raw JSON")
  .action(async (title: string, opts) => {
    const body: Record<string, unknown> = { title };
    if (opts.desc) body["description"] = opts.desc;
    if (opts.tags) body["tags"] = (opts.tags as string).split(",");
    const idea = await api.post("/ideas", body);
    if (opts.json) {
      console.log(JSON.stringify(idea, null, 2));
    } else {
      const i = idea as Record<string, unknown>;
      console.log(`Added idea ${i["id"]}: ${i["title"]}`);
    }
  });

ideaCmd
  .command("list")
  .description("List ideas")
  .option("--status <status>", "Filter by status")
  .option("--tag <tag>", "Filter by tag")
  .option("--json", "Output raw JSON")
  .action(async (opts) => {
    const params = new URLSearchParams();
    if (opts.status) params.set("status", opts.status);
    if (opts.tag) params.set("tag", opts.tag);
    const qs = params.toString();
    const ideas = await api.get(`/ideas${qs ? `?${qs}` : ""}`);
    if (opts.json) {
      console.log(JSON.stringify(ideas, null, 2));
    } else {
      const list = ideas as Array<Record<string, unknown>>;
      if (list.length === 0) {
        console.log("No ideas found.");
      } else {
        for (const i of list) {
          console.log(`[${i["status"]}] ${i["id"]}  ${i["title"]}`);
        }
      }
    }
  });
