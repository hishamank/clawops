import { Command } from "commander";
import { ideaAdd, ideaList } from "../lib/client.js";

export const ideaCmd = new Command("idea").description("Manage ideas");

ideaCmd
  .command("add")
  .description("Add a new idea")
  .argument("<title>", "Idea title")
  .option("--desc <description>", "Idea description")
  .option("--tags <tags>", "Comma-separated tags")
  .option("--json", "Output raw JSON")
  .action(async (title: string, opts) => {
    const idea = await ideaAdd({
      title,
      description: opts.desc,
      tags: opts.tags ? (opts.tags as string).split(",") : undefined,
    });
    if (opts.json) {
      console.log(JSON.stringify(idea, null, 2));
    } else {
      console.log(`Added idea ${idea.id}: ${idea.title}`);
    }
  });

ideaCmd
  .command("list")
  .description("List ideas")
  .option("--status <status>", "Filter by status")
  .option("--tag <tag>", "Filter by tag")
  .option("--json", "Output raw JSON")
  .action(async (opts) => {
    const ideas = await ideaList({
      status: opts.status,
      tag: opts.tag,
    });
    if (opts.json) {
      console.log(JSON.stringify(ideas, null, 2));
    } else if (ideas.length === 0) {
      console.log("No ideas found.");
    } else {
      for (const i of ideas) {
        console.log(`[${i.status}] ${i.id}  ${i.title}`);
      }
    }
  });
