import { Command } from "commander";
import { ideaAdd, ideaList, ideaGetSections, ideaGetSection, ideaUpdateSection, ideaUpdateSections, ideaGetDraftPrd, ideaSetDraftPrd } from "../lib/client.js";
import type { IdeaSections } from "@clawops/ideas";

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

ideaCmd
  .command("sections")
  .description("Get all sections for an idea")
  .argument("<id>", "Idea ID")
  .option("--json", "Output raw JSON")
  .action(async (id, opts) => {
    const sections = await ideaGetSections(id);
    if (opts.json) {
      console.log(JSON.stringify(sections, null, 2));
    } else if (!sections) {
      console.log("No sections found for this idea.");
    } else {
      for (const [key, value] of Object.entries(sections)) {
        if (value) {
          console.log(`\n## ${key}`);
          console.log(value);
        }
      }
    }
  });

ideaCmd
  .command("section")
  .description("Get or update a specific section")
  .argument("<id>", "Idea ID")
  .argument("<section>", "Section name (brainstorming, research, similarIdeas, draftPrd, notes)")
  .option("--set <content>", "Set section content")
  .option("--json", "Output raw JSON")
  .action(async (id, section, opts) => {
    const validSections = ["brainstorming", "research", "similarIdeas", "draftPrd", "notes"];
    if (!validSections.includes(section)) {
      console.error(`Invalid section: ${section}. Valid sections: ${validSections.join(", ")}`);
      process.exit(1);
    }

    if (opts.set) {
      const idea = await ideaUpdateSection(id, section as keyof IdeaSections, opts.set as string);
      if (opts.json) {
        console.log(JSON.stringify(idea, null, 2));
      } else {
        console.log(`Updated section '${section}' for idea ${id}`);
      }
    } else {
      const content = await ideaGetSection(id, section as keyof IdeaSections);
      if (opts.json) {
        console.log(JSON.stringify({ section, content }, null, 2));
      } else if (!content) {
        console.log(`Section '${section}' is empty.`);
      } else {
        console.log(content);
      }
    }
  });

ideaCmd
  .command("update-sections")
  .description("Update multiple sections at once")
  .argument("<id>", "Idea ID")
  .option("--brainstorming <content>", "Brainstorming content")
  .option("--research <content>", "Research content")
  .option("--similar-ideas <content>", "Similar ideas content")
  .option("--draft-prd <content>", "Draft PRD content")
  .option("--notes <content>", "Notes content")
  .option("--json", "Output raw JSON")
  .action(async (id, opts) => {
    const sections: Partial<IdeaSections> = {};
    if (opts.brainstorming) sections.brainstorming = opts.brainstorming;
    if (opts.research) sections.research = opts.research;
    if (opts.similarIdeas) sections.similarIdeas = opts.similarIdeas;
    if (opts.draftPrd) sections.draftPrd = opts.draftPrd;
    if (opts.notes) sections.notes = opts.notes;

    if (Object.keys(sections).length === 0) {
      console.error("No sections provided. Use --brainstorming, --research, --similar-ideas, --draft-prd, or --notes");
      process.exit(1);
    }

    const idea = await ideaUpdateSections(id, sections);
    if (opts.json) {
      console.log(JSON.stringify(idea, null, 2));
    } else {
      console.log(`Updated sections for idea ${id}: ${Object.keys(sections).join(", ")}`);
    }
  });

ideaCmd
  .command("draft-prd")
  .description("Get or set the draft PRD for an idea")
  .argument("<id>", "Idea ID")
  .option("--set <content>", "Set draft PRD content")
  .option("--json", "Output raw JSON")
  .action(async (id, opts) => {
    if (opts.set) {
      const idea = await ideaSetDraftPrd(id, opts.set as string);
      if (opts.json) {
        console.log(JSON.stringify(idea, null, 2));
      } else {
        console.log(`Updated draft PRD for idea ${id}`);
      }
    } else {
      const content = await ideaGetDraftPrd(id);
      if (opts.json) {
        console.log(JSON.stringify({ draftPrd: content }, null, 2));
      } else if (!content) {
        console.log("No draft PRD found for this idea.");
      } else {
        console.log(content);
      }
    }
  });
