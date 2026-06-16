import fs from "fs";
import chalk from "chalk";
import ora from "ora";
import {
  loadConfig,
  getPagesPath,
  getFactsPath,
  getContentGapsPath,
  resolveLLMConfig,
  Page,
  PageSchema,
} from "@agentranks/core";
import {
  extractFactsFromPages,
  mergeExtractionResults,
} from "@agentranks/ai";
import { z } from "zod";
import { truncateUrl } from "../utils.js";

export interface ExtractOptions {
  maxPages?: number;
  dryRun?: boolean;
}

export async function runExtract(
  opts: ExtractOptions = {},
  cwd: string = process.cwd()
): Promise<void> {
  console.log(chalk.bold.cyan("\n  AgentRanks Extract\n"));

  const config = loadConfig(cwd);
  const llmConfig = resolveLLMConfig(config);

  if (!llmConfig.apiKey) {
    console.error(chalk.red("  ✗ LLM API key not found."));
    console.error(
      chalk.gray(
        "  Set AGENTRANKS_LLM_API_KEY in your environment or .env file."
      )
    );
    process.exit(1);
  }

  // Load pages
  const pagesPath = getPagesPath(cwd);
  if (!fs.existsSync(pagesPath)) {
    console.error(
      chalk.red(`  ✗ No pages found at ${pagesPath}`)
    );
    console.error(chalk.gray("  Run agentranks scan first."));
    process.exit(1);
  }

  let pages: Page[];
  try {
    const raw = JSON.parse(fs.readFileSync(pagesPath, "utf-8"));
    const parsed = z.array(PageSchema).safeParse(raw);
    if (!parsed.success) {
      console.error(
        chalk.red(
          `  ✗ pages.json is malformed: ${parsed.error.errors[0]?.message}`
        )
      );
      process.exit(1);
    }
    pages = parsed.data;
  } catch (err) {
    console.error(
      chalk.red(`  ✗ Failed to read pages.json: ${(err as Error).message}`)
    );
    process.exit(1);
  }

  const limit = opts.maxPages ?? pages.length;
  const pagesToProcess = pages.slice(0, limit);

  console.log(
    chalk.white(
      `  Processing ${chalk.bold(pagesToProcess.length)} pages with ${chalk.bold(llmConfig.model)}`
    )
  );
  console.log(chalk.white(`  LLM endpoint: ${chalk.dim(llmConfig.baseUrl)}\n`));

  if (opts.dryRun) {
    console.log(chalk.yellow("  [dry-run] Skipping actual LLM calls.\n"));
    return;
  }

  const spinner = ora({ text: "Extracting facts...", color: "cyan" }).start();
  const results = await extractFactsFromPages(pagesToProcess, {
    baseUrl: llmConfig.baseUrl,
    apiKey: llmConfig.apiKey,
    model: llmConfig.model,
    temperature: llmConfig.temperature,
    maxTokens: llmConfig.maxTokens,
    onProgress: (current, total, url) => {
      spinner.text =
        `Extracting... ${chalk.bold(current)}/${total}` +
        ` | ${chalk.dim(truncateUrl(url, 50))}`;
    },
  });

  spinner.stop();

  const errors = results.filter((r) => r.error);
  const successResults = results.filter((r) => !r.error);
  const facts = mergeExtractionResults(successResults);

  // Save facts
  const factsPath = getFactsPath(cwd);
  fs.writeFileSync(factsPath, JSON.stringify(facts, null, 2) + "\n", "utf-8");

  // Collect and save content gaps
  const allGaps = results.flatMap((r) => r.contentGaps ?? []);
  if (allGaps.length > 0) {
    const gapsPath = getContentGapsPath(cwd);
    fs.writeFileSync(gapsPath, JSON.stringify(allGaps, null, 2) + "\n", "utf-8");
  }

  // Report
  const totalRaw = results.reduce((sum, r) => sum + r.facts.length, 0);
  console.log(
    chalk.green(
      `  ✓ Extracted ${chalk.bold(totalRaw)} raw facts from ${successResults.length} pages`
    )
  );
  console.log(
    chalk.green(`  ✓ ${chalk.bold(facts.length)} unique facts after deduplication`)
  );

  if (errors.length > 0) {
    console.log(chalk.yellow(`\n  ⚠ ${errors.length} pages had extraction errors:`));
    for (const err of errors.slice(0, 5)) {
      console.log(
        chalk.gray(
          `    ${truncateUrl(err.sourceUrl, 50)}: ${err.error?.slice(0, 80)}`
        )
      );
    }
  }

  // Category breakdown
  const categories: Record<string, number> = {};
  for (const f of facts) {
    categories[f.category] = (categories[f.category] ?? 0) + 1;
  }
  console.log(chalk.white("\n  Fact categories:"));
  for (const [cat, count] of Object.entries(categories).sort((a, b) => b[1] - a[1])) {
    console.log(chalk.gray(`    ${cat.padEnd(18)} ${count}`));
  }

  console.log(chalk.green(`\n  ✓ Facts saved to ${chalk.bold(factsPath)}`));

  if (allGaps.length > 0) {
    console.log(chalk.yellow(`  ⚠ ${allGaps.length} content gaps saved to ${chalk.bold(getContentGapsPath(cwd))}`));
    console.log(chalk.gray(`    (incomplete FAQ answers and weak-evidence facts — not included in output)`));
  }

  console.log(chalk.gray("\n  Next step: agentranks validate\n"));
}
