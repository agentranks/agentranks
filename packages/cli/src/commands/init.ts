import fs from "fs";
import path from "path";
import prompts from "prompts";
import chalk from "chalk";
import {
  AgentRanksConfig,
  AgentRanksConfigSchema,
  saveConfig,
  configExists,
  CONFIG_DIR,
} from "@agentranks/core";

// ─── .gitignore management ────────────────────────────────────────────────────

export const GITIGNORE_ENTRIES = [
  ".agentranks/",
  "agentranks.facts.json",
  "agentranks-output/",
  "agentranks-public/",
  "indexnow-key*",
  ".env",
];

export interface GitignoreResult {
  added: string[];
  skipped: string[];
}

/**
 * Ensures all AgentRanks entries exist in .gitignore.
 * Appends missing lines without touching existing content.
 */
export function ensureGitignore(cwd: string): GitignoreResult {
  const gitignorePath = path.join(cwd, ".gitignore");
  const existing = fs.existsSync(gitignorePath)
    ? fs.readFileSync(gitignorePath, "utf-8")
    : "";

  const existingLines = new Set(
    existing.split("\n").map((l) => l.trim()).filter(Boolean)
  );

  const added = GITIGNORE_ENTRIES.filter((e) => !existingLines.has(e));
  const skipped = GITIGNORE_ENTRIES.filter((e) => existingLines.has(e));

  if (added.length > 0) {
    const separator = existing.length > 0 && !existing.endsWith("\n") ? "\n" : "";
    const block =
      `${separator}\n# AgentRanks\n` + added.join("\n") + "\n";
    fs.writeFileSync(gitignorePath, existing + block, "utf-8");
  }

  return { added, skipped };
}

export async function runInit(cwd: string = process.cwd()): Promise<void> {
  console.log(chalk.bold.cyan("\n  AgentRanks Init\n"));

  if (configExists(cwd)) {
    const { overwrite } = await prompts({
      type: "confirm",
      name: "overwrite",
      message: chalk.yellow(
        "An AgentRanks config already exists. Overwrite it?"
      ),
      initial: false,
    });

    if (!overwrite) {
      console.log(chalk.gray("  Aborted. Existing config preserved."));
      return;
    }
  }

  const answers = await prompts(
    [
      {
        type: "text",
        name: "baseUrl",
        message: "Website URL to analyze:",
        validate: (v) => {
          try {
            new URL(v);
            return true;
          } catch {
            return "Please enter a valid URL (e.g. https://example.com)";
          }
        },
      },
      {
        type: "text",
        name: "name",
        message: "Business name:",
        validate: (v) =>
          v.trim().length > 0 ? true : "Business name is required",
      },
      {
        type: "text",
        name: "description",
        message: "Short description (optional):",
      },
      {
        type: "number",
        name: "maxPages",
        message: "Max pages to crawl:",
        initial: 50,
        min: 1,
        max: 500,
      },
      {
        type: "number",
        name: "crawlDelay",
        message: "Delay between requests (ms):",
        initial: 500,
        min: 100,
        max: 5000,
      },
      {
        type: "text",
        name: "llmBaseUrl",
        message: "LLM API base URL:",
        initial: "https://api.deepseek.com/v1",
      },
      {
        type: "text",
        name: "llmModel",
        message: "LLM model name:",
        initial: "deepseek-v4-pro",
      },
    ],
    {
      onCancel: () => {
        console.log(chalk.gray("\n  Init cancelled."));
        process.exit(0);
      },
    }
  );

  const rawConfig = {
    version: "1",
    baseUrl: answers.baseUrl,
    name: answers.name,
    description: answers.description || undefined,
    maxPages: answers.maxPages,
    crawlDelay: answers.crawlDelay,
    llm: {
      baseUrl: answers.llmBaseUrl,
      model: answers.llmModel,
    },
    output: {
      dir: "agentranks-output",
    },
    createdAt: new Date().toISOString(),
  };

  const parsed = AgentRanksConfigSchema.safeParse(rawConfig);
  if (!parsed.success) {
    console.error(
      chalk.red("\n  Config validation failed:"),
      parsed.error.errors
    );
    process.exit(1);
  }

  saveConfig(parsed.data, cwd);

  const configPath = path.join(cwd, CONFIG_DIR, "config.json");
  console.log(chalk.green(`\n  ✓ Config saved to ${chalk.bold(configPath)}`));

  // Update .gitignore
  const { added: gitignoreAdded } = ensureGitignore(cwd);
  if (gitignoreAdded.length > 0) {
    console.log(
      chalk.green(
        `  ✓ .gitignore updated (added: ${gitignoreAdded.join(", ")})`
      )
    );
  }

  console.log(chalk.gray("\n  Next steps:"));
  console.log(chalk.white(`    agentranks scan ${answers.baseUrl}`));
  console.log(chalk.white("    agentranks extract"));
  console.log(chalk.white("    agentranks validate"));
  console.log(chalk.white("    agentranks score"));
  console.log(chalk.white("    agentranks review"));
  console.log(chalk.white("    agentranks generate\n"));
}
