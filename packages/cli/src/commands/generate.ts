import fs from "fs";
import path from "path";
import chalk from "chalk";
import ora from "ora";
import { loadConfig, getPagesPath, getOutputDir } from "@agentranks/core";
import {
  buildAgentRanksOutput,
  writeAllOutputs,
  type PublishStats,
} from "@agentranks/publisher";
import { loadFacts, loadPages } from "../utils/load.js";

export interface GenerateOptions {
  outputDir?: string;
  /** Only publish explicitly approved facts. Excludes extracted+low-risk. */
  strict?: boolean;
  /** Also include low-priority facts (granular role/tool lists, legal pages). */
  includeLow?: boolean;
}

export async function runGenerate(
  opts: GenerateOptions = {},
  cwd: string = process.cwd()
): Promise<void> {
  console.log(chalk.bold.cyan("\n  AgentRanks Generate\n"));

  if (opts.strict) {
    console.log(chalk.yellow("  Mode: strict (approved facts only)\n"));
  }

  const config = loadConfig(cwd);
  const outputDir = getOutputDir(cwd, config, opts.outputDir);

  // Load facts
  let facts;
  try {
    facts = loadFacts(cwd);
  } catch (err) {
    console.error(chalk.red(`  ✗ ${(err as Error).message}`));
    process.exit(1);
  }

  // Count pages if available (non-fatal if missing)
  let pagesScanned = 0;
  const pagesPath = getPagesPath(cwd);
  if (fs.existsSync(pagesPath)) {
    try {
      pagesScanned = loadPages(cwd).length;
    } catch {
      // Non-fatal — pages count is informational
    }
  }

  console.log(chalk.white(`  Facts (total):  ${chalk.bold(facts.length)}`));
  console.log(chalk.white(`  Pages scanned:  ${chalk.bold(pagesScanned)}`));
  console.log(chalk.white(`  Output dir:     ${chalk.bold(outputDir)}\n`));

  const spinner = ora({ text: "Generating outputs...", color: "cyan" }).start();

  let writtenFiles: string[];
  let publishStats: PublishStats;

  try {
    const output = buildAgentRanksOutput(facts, config, pagesScanned, { strict: opts.strict, includeLow: opts.includeLow });
    publishStats = output.publishStats;
    writtenFiles = writeAllOutputs({ outputDir, output });
  } catch (err) {
    spinner.fail(chalk.red("Generation failed"));
    console.error(chalk.red(`  ${(err as Error).message}`));
    process.exit(1);
  }

  spinner.stop();

  // Publish stats
  console.log(chalk.white(`  Facts published:    ${chalk.bold.green(publishStats.published)}`));
  if (publishStats.excluded.needs_review > 0) {
    console.log(chalk.white(`  Excluded (needs_review):   ${chalk.bold.yellow(publishStats.excluded.needs_review)} — run with --strict or approve manually`));
  }
  if (publishStats.excluded.extracted_high_risk > 0) {
    console.log(chalk.white(`  Excluded (extracted/risk): ${chalk.bold.yellow(publishStats.excluded.extracted_high_risk)}${opts.strict ? "" : " — approve to publish"}`));
  }
  if (publishStats.excluded.low_priority > 0) {
    console.log(chalk.white(`  Excluded (low priority):   ${chalk.bold.gray(publishStats.excluded.low_priority)} — use --include-low to publish`));
  }
  if (publishStats.excluded.rejected > 0) {
    console.log(chalk.white(`  Excluded (rejected):       ${chalk.bold.red(publishStats.excluded.rejected)}`));
  }
  console.log("");

  console.log(chalk.green(`  ✓ Generated ${chalk.bold(writtenFiles.length)} files:\n`));
  for (const filePath of writtenFiles) {
    const relative = path.relative(cwd, filePath);
    console.log(chalk.gray(`    ${relative}`));
  }

  console.log(
    chalk.green(`\n  ✓ All outputs written to ${chalk.bold(outputDir)}\n`)
  );
  console.log(
    chalk.white(
      "  Your AI-readable business profile is ready. " +
        "You can serve these files from your website or share them with AI agents.\n"
    )
  );
}
