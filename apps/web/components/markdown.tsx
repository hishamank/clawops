import React from "react";
import { cn } from "@/lib/utils";

// ─── Inline parser ────────────────────────────────────────────────────────────

function renderInline(text: string, key?: string | number): React.ReactNode {
  // Split on **bold**, *italic*, `code` — in that priority order
  const parts = text.split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`)/g);

  if (parts.length === 1) return text;

  return (
    <React.Fragment key={key}>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i} className="font-semibold text-[#ededef]">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
          return <em key={i} className="italic">{part.slice(1, -1)}</em>;
        }
        if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
          return (
            <code
              key={i}
              className="rounded bg-white/8 px-1.5 py-0.5 font-mono text-[0.8em] text-[#ededef]"
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        return part || null;
      })}
    </React.Fragment>
  );
}

// ─── Block parser ─────────────────────────────────────────────────────────────

interface ParsedBlock {
  type: "h1" | "h2" | "h3" | "h4" | "hr" | "code" | "ul" | "ol" | "p" | "empty";
  content?: string;
  language?: string;
  items?: string[];
}

function parseBlocks(markdown: string): ParsedBlock[] {
  const lines = markdown.split("\n");
  const blocks: ParsedBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Code block
    if (trimmed.startsWith("```")) {
      const language = trimmed.slice(3).trim() || undefined;
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push({ type: "code", content: codeLines.join("\n"), language });
      i++;
      continue;
    }

    // Headings
    if (trimmed.startsWith("#### ")) {
      blocks.push({ type: "h4", content: trimmed.slice(5) });
      i++; continue;
    }
    if (trimmed.startsWith("### ")) {
      blocks.push({ type: "h3", content: trimmed.slice(4) });
      i++; continue;
    }
    if (trimmed.startsWith("## ")) {
      blocks.push({ type: "h2", content: trimmed.slice(3) });
      i++; continue;
    }
    if (trimmed.startsWith("# ")) {
      blocks.push({ type: "h1", content: trimmed.slice(2) });
      i++; continue;
    }

    // Horizontal rule
    if (/^---+$/.test(trimmed) || /^\*\*\*+$/.test(trimmed)) {
      blocks.push({ type: "hr" });
      i++; continue;
    }

    // Unordered list
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*] /.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*] /, ""));
        i++;
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    // Ordered list
    if (/^\d+\. /.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\. /.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\. /, ""));
        i++;
      }
      blocks.push({ type: "ol", items });
      continue;
    }

    // Empty line
    if (trimmed === "") {
      blocks.push({ type: "empty" });
      i++; continue;
    }

    // Paragraph — collect consecutive non-special lines
    const pLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].trim().startsWith("#") &&
      !lines[i].trim().startsWith("```") &&
      !/^---+$/.test(lines[i].trim()) &&
      !/^\d+\. /.test(lines[i].trim()) &&
      !/^\s*[-*] /.test(lines[i])
    ) {
      pLines.push(lines[i].trim());
      i++;
    }
    if (pLines.length > 0) {
      blocks.push({ type: "p", content: pLines.join(" ") });
    }
  }

  return blocks;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface MarkdownProps {
  content: string;
  className?: string;
}

export function Markdown({ content, className }: MarkdownProps): React.JSX.Element {
  const blocks = parseBlocks(content);

  const rendered = blocks.map((block, i) => {
    switch (block.type) {
      case "h1":
        return (
          <h1 key={i} className="mb-3 mt-6 text-xl font-semibold tracking-tight text-[#ededef] first:mt-0">
            {renderInline(block.content ?? "")}
          </h1>
        );
      case "h2":
        return (
          <h2 key={i} className="mb-2 mt-5 text-base font-semibold text-[#ededef] first:mt-0">
            {renderInline(block.content ?? "")}
          </h2>
        );
      case "h3":
        return (
          <h3 key={i} className="mb-2 mt-4 text-sm font-semibold text-[#ededef] first:mt-0">
            {renderInline(block.content ?? "")}
          </h3>
        );
      case "h4":
        return (
          <h4 key={i} className="mb-1.5 mt-3 text-sm font-medium text-[#ededef]/80 first:mt-0">
            {renderInline(block.content ?? "")}
          </h4>
        );
      case "hr":
        return <hr key={i} className="my-4 border-white/10" />;
      case "code":
        return (
          <div key={i} className="my-3 overflow-x-auto rounded-lg bg-white/5 ring-1 ring-white/8">
            {block.language && (
              <div className="border-b border-white/8 px-4 py-1.5">
                <span className="font-mono text-[10px] uppercase tracking-wider text-[#6b7080]">
                  {block.language}
                </span>
              </div>
            )}
            <pre className="overflow-x-auto px-4 py-3">
              <code className="font-mono text-xs leading-relaxed text-[#c9d1d9]">
                {block.content}
              </code>
            </pre>
          </div>
        );
      case "ul":
        return (
          <ul key={i} className="my-2 space-y-1 pl-4">
            {(block.items ?? []).map((item, j) => (
              <li key={j} className="flex items-start gap-2 text-sm text-[#ededef]/80">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[#6b7080]" />
                <span>{renderInline(item, j)}</span>
              </li>
            ))}
          </ul>
        );
      case "ol":
        return (
          <ol key={i} className="my-2 space-y-1 pl-4">
            {(block.items ?? []).map((item, j) => (
              <li key={j} className="flex items-start gap-2 text-sm text-[#ededef]/80">
                <span className="mt-0.5 shrink-0 font-mono text-xs text-[#6b7080]">{j + 1}.</span>
                <span>{renderInline(item, j)}</span>
              </li>
            ))}
          </ol>
        );
      case "p":
        return (
          <p key={i} className="text-sm leading-relaxed text-[#ededef]/80">
            {renderInline(block.content ?? "")}
          </p>
        );
      case "empty":
        return <div key={i} className="h-2" />;
      default:
        return null;
    }
  });

  return (
    <div className={cn("min-w-0", className)}>
      {rendered}
    </div>
  );
}

// ─── Fallback for plain text ───────────────────────────────────────────────────

export function PlainText({ content, className }: MarkdownProps): React.JSX.Element {
  return (
    <pre className={cn("whitespace-pre-wrap font-sans text-sm leading-relaxed text-[#ededef]/80", className)}>
      {content}
    </pre>
  );
}
