import fs from "fs";
import path from "path";
import chalk from "chalk";
import ora from "ora";
import { loadConfig, getOutputDir, getIntentsDir } from "@agentranks/core";
import {
  generateIntents,
  generateIntentsFromPrompts,
  buildBriefMd,
  buildIndexMd,
  buildPromptsMd,
  computeRefreshStats,
  type PublishingMode,
  type IntentBrief,
  type IntentsOutput,
} from "@agentranks/publisher";
import { loadFacts } from "../utils/load.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IntentsOptions {
  outputDir?: string;
  publishingMode?: PublishingMode;
  refresh?: boolean;
  dryRun?: boolean;
  /** Path to a plain-text prompts file (one prompt per line). */
  promptsFile?: string;
}

/** Read prompts from a plain .txt file. Skips empty lines and # comments. */
export function readPromptsFile(filePath: string): string[] {
  const content = fs.readFileSync(filePath, "utf-8");
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

const VALID_PUBLISHING_MODES: PublishingMode[] = [
  "private_export",
  "public_indexable",
  "public_noindex",
];

// ─── Main Command ─────────────────────────────────────────────────────────────

export async function runIntents(
  opts: IntentsOptions = {},
  cwd: string = process.cwd()
): Promise<void> {
  console.log(chalk.bold.cyan("\n  AgentRanks Intents\n"));

  // Validate publishing mode
  const publishingMode: PublishingMode = opts.publishingMode ?? "private_export";
  if (!VALID_PUBLISHING_MODES.includes(publishingMode)) {
    console.error(
      chalk.red(
        `  ✗ Invalid publishing mode: "${publishingMode}". ` +
          `Choose: ${VALID_PUBLISHING_MODES.join(", ")}`
      )
    );
    process.exit(1);
  }

  if (publishingMode === "public_noindex") {
    console.log(
      chalk.yellow(
        "  ⚠ Publishing mode public_noindex: content will have noindex meta tags.\n" +
          "    This may reduce eligibility for some Google/Search/AI features.\n"
      )
    );
  }

  const config = loadConfig(cwd);
  const outputDir = getOutputDir(cwd, config, opts.outputDir);
  const intentsDir = getIntentsDir(outputDir);
  const intentsJsonPath = path.join(intentsDir, "intents.json");

  // Load facts
  let facts;
  try {
    facts = loadFacts(cwd);
  } catch (err) {
    console.error(chalk.red(`  ✗ ${(err as Error).message}`));
    process.exit(1);
  }

  // Load existing intents.json for refresh comparison
  let previousBriefs: IntentBrief[] = [];
  if (opts.refresh && fs.existsSync(intentsJsonPath)) {
    try {
      const existing: IntentsOutput = JSON.parse(
        fs.readFileSync(intentsJsonPath, "utf-8")
      );
      previousBriefs = existing.briefs ?? [];
    } catch {
      // Non-fatal — treat as fresh generation
    }
  }

  // Load and validate prompts file if provided
  let userPrompts: string[] = [];
  if (opts.promptsFile) {
    const absPromptsFile = path.resolve(cwd, opts.promptsFile);
    if (!fs.existsSync(absPromptsFile)) {
      console.error(chalk.red(`  ✗ Prompts file not found: ${absPromptsFile}`));
      process.exit(1);
    }
    userPrompts = readPromptsFile(absPromptsFile);
    console.log(
      chalk.white(`  Prompts file:     ${chalk.bold(opts.promptsFile)} (${userPrompts.length} prompts)`)
    );
  }

  console.log(chalk.white(`  Facts (total):    ${chalk.bold(facts.length)}`));
  console.log(chalk.white(`  Publishing mode:  ${chalk.bold(publishingMode)}`));
  console.log(chalk.white(`  Output dir:       ${chalk.bold(intentsDir)}\n`));

  const spinner = ora({ text: "Generating intent briefs...", color: "cyan" }).start();

  // Generate auto briefs from fact graph
  const output = generateIntents(facts, config, { publishingMode });
  let { briefs } = output;

  // Generate prompt-file briefs and merge
  let promptsFileSkipped: Array<{ prompt: string; reason: string }> = [];
  if (userPrompts.length > 0) {
    const existingSlugs = new Set(briefs.map((b) => b.slug));
    const pfResult = generateIntentsFromPrompts(userPrompts, facts, config, {
      publishingMode,
      existingSlugs,
    });
    promptsFileSkipped = pfResult.skipped;
    briefs = [...briefs, ...pfResult.briefs];
  }

  // Update output with merged briefs
  const mergedOutput: IntentsOutput = { ...output, briefs };

  spinner.stop();

  if (briefs.length === 0) {
    console.log(chalk.yellow("  ⚠ No intent briefs generated."));
    console.log(
      chalk.gray(
        "  Ensure facts have publishable status (approved or extracted+low-risk+core/supporting)."
      )
    );
    console.log(
      chalk.gray("  Run agentranks review --approve-low-risk to approve safe facts.\n")
    );
    return;
  }

  // Refresh stats
  if (opts.refresh && previousBriefs.length > 0) {
    const stats = computeRefreshStats(previousBriefs, briefs);
    console.log(chalk.white(`  Refresh stats:`));
    console.log(chalk.white(`    Unchanged:  ${chalk.bold(stats.unchanged)}`));
    console.log(chalk.white(`    Changed:    ${chalk.bold.yellow(stats.changed)}`));
    console.log(chalk.white(`    New:        ${chalk.bold.green(stats.newBriefs)}`));
    console.log(chalk.white(`    Removed:    ${chalk.bold.red(stats.removed)}`));
    console.log("");
  }

  // Report skipped prompts
  if (promptsFileSkipped.length > 0) {
    console.log(
      chalk.yellow(
        `  ⚠ Skipped ${promptsFileSkipped.length} prompt(s) — no matching facts:\n`
      )
    );
    for (const { prompt } of promptsFileSkipped) {
      console.log(chalk.gray(`    • "${prompt}"`));
    }
    console.log("");
  }

  // Dry-run: print summary and exit
  if (opts.dryRun) {
    const autoBriefs = briefs.filter((b) => b.sourceType !== "prompts_file");
    const pfBriefs = briefs.filter((b) => b.sourceType === "prompts_file");
    console.log(
      chalk.bold(
        `  Planned intent briefs (${chalk.green(briefs.length)} total — ${autoBriefs.length} auto, ${pfBriefs.length} from prompts file):\n`
      )
    );
    for (const brief of briefs) {
      const tag = brief.sourceType === "prompts_file" ? chalk.magenta(" [pf]") : "";
      console.log(
        chalk.white(
          `    ${chalk.bold(brief.slug)}${tag} — ${brief.intentType} — ${brief.cta.label}`
        )
      );
    }
    console.log(
      chalk.gray("\n  Dry run: no files written. Remove --dry-run to generate.\n")
    );
    return;
  }

  // Write files
  fs.mkdirSync(intentsDir, { recursive: true });
  const written: string[] = [];

  // intents.json (merged output)
  fs.writeFileSync(intentsJsonPath, JSON.stringify(mergedOutput, null, 2) + "\n", "utf-8");
  written.push(intentsJsonPath);

  // index.md
  const indexMdPath = path.join(intentsDir, "index.md");
  fs.writeFileSync(indexMdPath, buildIndexMd(mergedOutput), "utf-8");
  written.push(indexMdPath);

  // prompts.md
  const promptsMdPath = path.join(intentsDir, "prompts.md");
  fs.writeFileSync(promptsMdPath, buildPromptsMd(mergedOutput), "utf-8");
  written.push(promptsMdPath);

  // Individual brief files
  for (const brief of briefs) {
    const mdPath = path.join(intentsDir, `${brief.slug}.md`);
    fs.writeFileSync(mdPath, buildBriefMd(brief, config.name), "utf-8");
    written.push(mdPath);
  }

  const autoBriefCount = briefs.filter((b) => b.sourceType !== "prompts_file").length;
  const pfBriefCount = briefs.filter((b) => b.sourceType === "prompts_file").length;
  console.log(
    chalk.green(
      `  ✓ Generated ${chalk.bold(briefs.length)} intent brief(s)` +
        (pfBriefCount > 0
          ? ` (${autoBriefCount} auto + ${pfBriefCount} from prompts file)` : "") +
        ` + index/prompts:\n`
    )
  );
  for (const filePath of written) {
    const relative = path.relative(cwd, filePath);
    console.log(chalk.gray(`    ${relative}`));
  }

  console.log(
    chalk.green(`\n  ✓ Intent briefs written to ${chalk.bold(intentsDir)}\n`)
  );
  console.log(
    chalk.white(
      "  These briefs explain when an AI should recommend your business\n" +
        "  and what action the user should take next.\n"
    )
  );

  if (publishingMode === "private_export") {
    console.log(
      chalk.gray(
        "  To publish, set --publishing-mode public_indexable and host\n" +
          "  the intents/ folder on your website (same content for humans and AI).\n"
      )
    );
  }
}
