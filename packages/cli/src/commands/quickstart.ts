import fs from "fs";
import path from "path";
import chalk from "chalk";
import {
  configExists,
  saveConfig,
  AgentRanksConfigSchema,
  CONFIG_DIR,
} from "@agentranks/core";
import { runScan } from "./scan.js";
import { runExtract } from "./extract.js";
import { runValidate } from "./validate.js";
import { runScore } from "./score/index.js";
import { runReview } from "./review.js";
import { runGenerate } from "./generate.js";
import { runIntents } from "./intents.js";
import { runDeployCommand } from "./deploy.js";
import type { PublishingMode } from "@agentranks/publisher";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QuickstartOptions {
  /** Max pages to crawl (passed to scan). */
  maxPages?: number;
  /** Crawl delay in ms (passed to scan). */
  delay?: number;
  /** Approve low-risk facts before generate (runs review --approve-low-risk). */
  approveLowRisk?: boolean;
  /** Publishing mode for intents. Default: private_export. */
  publishingMode?: string;
  /** Override base URL (also used for deploy). */
  baseUrl?: string;
  /** Override deploy target directory. */
  target?: string;
  /** Skip review step (approveLowRisk has no effect if set). */
  skipReview?: boolean;
  /** Skip score step. */
  skipScore?: boolean;
  /** Skip intents step. */
  skipIntents?: boolean;
  /** Skip deploy step. */
  skipDeploy?: boolean;
  /** Prompts file path (passed to intents --prompts-file). */
  promptsFile?: string;
  /** Print planned steps without running them or writing files. */
  dryRun?: boolean;
}

// ─── Step Runner ─────────────────────────────────────────────────────────────

function printStep(n: number, total: number, label: string): void {
  console.log(
    chalk.bold.cyan(`\n  ─── Step ${n}/${total}: ${label} ───────────────────────────────\n`)
  );
}

function printSkip(label: string): void {
  console.log(chalk.gray(`  ↷ Skipping ${label}\n`));
}

// ─── Config Bootstrapper ──────────────────────────────────────────────────────

/**
 * If no config exists and a URL is provided, create a minimal config automatically.
 * Used by quickstart to avoid an interactive init prompt.
 */
function bootstrapConfig(
  url: string,
  baseUrl: string | undefined,
  cwd: string
): void {
  const resolvedBaseUrl = baseUrl ?? url;
  let name: string;
  try {
    name = new URL(resolvedBaseUrl).hostname.replace(/^www\./, "");
  } catch {
    name = resolvedBaseUrl;
  }

  const rawConfig = {
    version: "1",
    baseUrl: resolvedBaseUrl,
    name,
    maxPages: 50,
    crawlDelay: 500,
    output: { dir: "agentranks-output" },
    createdAt: new Date().toISOString(),
  };

  const parsed = AgentRanksConfigSchema.safeParse(rawConfig);
  if (!parsed.success) {
    throw new Error(
      "Failed to create config: " +
        parsed.error.errors.map((e) => e.message).join(", ")
    );
  }

  saveConfig(parsed.data, cwd);

  const configPath = path.join(cwd, CONFIG_DIR, "config.json");
  console.log(chalk.green(`  ✓ Created config: ${chalk.bold(configPath)}\n`));
}

// ─── Main Command ─────────────────────────────────────────────────────────────

export async function runQuickstart(
  url?: string,
  opts: QuickstartOptions = {},
  cwd: string = process.cwd()
): Promise<void> {
  console.log(chalk.bold.cyan("\n  AgentRanks Quickstart\n"));
  console.log(
    chalk.gray(
      "  This chains init → scan → extract → validate → score → generate → intents → deploy.\n" +
        "  Use granular commands for finer control.\n"
    )
  );

  if (opts.dryRun) {
    console.log(chalk.yellow("  ⚠ Dry run — planned steps only, nothing will be written.\n"));
  }

  const publishingMode = (opts.publishingMode ?? "private_export") as PublishingMode;

  // ── Build step list ────────────────────────────────────────────────────────

  const steps: Array<{ label: string; skip: boolean }> = [
    { label: "init / config check", skip: false },
    { label: "scan", skip: false },
    { label: "extract", skip: false },
    { label: "validate", skip: false },
    { label: "score", skip: !!opts.skipScore },
    { label: "review --approve-low-risk", skip: !!opts.skipReview || !opts.approveLowRisk },
    { label: "generate", skip: false },
    { label: "intents", skip: !!opts.skipIntents },
    { label: "deploy", skip: !!opts.skipDeploy },
  ];

  const activeSteps = steps.filter((s) => !s.skip);
  const totalActive = activeSteps.length;

  if (opts.dryRun) {
    console.log(chalk.bold("  Planned steps:\n"));
    let activeN = 0;
    for (const step of steps) {
      if (step.skip) {
        console.log(chalk.gray(`    ↷ skipped: ${step.label}`));
      } else {
        activeN++;
        console.log(chalk.white(`    ${activeN}. ${step.label}`));
      }
    }
    if (opts.maxPages) console.log(chalk.gray(`\n  --max-pages:       ${opts.maxPages}`));
    if (opts.delay) console.log(chalk.gray(`  --delay:           ${opts.delay}`));
    if (opts.promptsFile) console.log(chalk.gray(`  --prompts-file:    ${opts.promptsFile}`));
    if (opts.target) console.log(chalk.gray(`  --target:          ${opts.target}`));
    if (opts.baseUrl) console.log(chalk.gray(`  --base-url:        ${opts.baseUrl}`));
    console.log(chalk.gray(`  --publishing-mode: ${publishingMode}`));
    console.log(
      chalk.gray("\n  Remove --dry-run to run the full quickstart pipeline.\n")
    );
    return;
  }

  let stepN = 0;

  // ── Step: init / config check ──────────────────────────────────────────────

  stepN++;
  printStep(stepN, totalActive, "init / config check");

  if (configExists(cwd)) {
    console.log(chalk.green("  ✓ Config already exists — reusing it.\n"));
  } else if (url) {
    bootstrapConfig(url, opts.baseUrl, cwd);
  } else {
    console.error(
      chalk.red(
        "  ✗ No config found and no URL provided.\n" +
          "    Run agentranks init first, or pass a URL:\n" +
          "    agentranks quickstart https://example.com\n"
      )
    );
    process.exit(1);
  }

  // ── Step: scan ────────────────────────────────────────────────────────────

  stepN++;
  printStep(stepN, totalActive, "scan");
  try {
    await runScan(url, {
      maxPages: opts.maxPages,
      delay: opts.delay,
    });
  } catch (err) {
    console.error(
      chalk.red(`  ✗ scan failed: ${(err as Error).message}\n`)
    );
    process.exit(1);
  }

  // ── Step: extract ─────────────────────────────────────────────────────────

  stepN++;
  printStep(stepN, totalActive, "extract");
  try {
    await runExtract({});
  } catch (err) {
    console.error(
      chalk.red(`  ✗ extract failed: ${(err as Error).message}\n`)
    );
    process.exit(1);
  }

  // ── Step: validate ────────────────────────────────────────────────────────

  stepN++;
  printStep(stepN, totalActive, "validate");
  try {
    await runValidate({});
  } catch (err) {
    console.error(
      chalk.red(`  ✗ validate failed: ${(err as Error).message}\n`)
    );
    process.exit(1);
  }

  // ── Step: score ───────────────────────────────────────────────────────────

  if (!opts.skipScore) {
    stepN++;
    printStep(stepN, totalActive, "score");
    try {
      await runScore({});
    } catch (err) {
      console.error(
        chalk.red(`  ✗ score failed: ${(err as Error).message}\n`)
      );
      process.exit(1);
    }
  } else {
    printSkip("score");
  }

  // ── Step: review --approve-low-risk ───────────────────────────────────────

  if (!opts.skipReview && opts.approveLowRisk) {
    stepN++;
    printStep(stepN, totalActive, "review --approve-low-risk");
    try {
      await runReview({ approveLowRisk: true });
    } catch (err) {
      console.error(
        chalk.red(`  ✗ review failed: ${(err as Error).message}\n`)
      );
      process.exit(1);
    }
  } else if (opts.skipReview) {
    printSkip("review");
  } else {
    printSkip("review --approve-low-risk (use --approve-low-risk to enable)");
  }

  // ── Step: generate ────────────────────────────────────────────────────────

  stepN++;
  printStep(stepN, totalActive, "generate");
  try {
    await runGenerate({});
  } catch (err) {
    console.error(
      chalk.red(`  ✗ generate failed: ${(err as Error).message}\n`)
    );
    process.exit(1);
  }

  // ── Step: intents ─────────────────────────────────────────────────────────

  if (!opts.skipIntents) {
    stepN++;
    printStep(stepN, totalActive, "intents");
    try {
      await runIntents({
        publishingMode,
        promptsFile: opts.promptsFile,
      });
    } catch (err) {
      console.error(
        chalk.red(`  ✗ intents failed: ${(err as Error).message}\n`)
      );
      process.exit(1);
    }
  } else {
    printSkip("intents");
  }

  // ── Step: deploy ──────────────────────────────────────────────────────────

  if (!opts.skipDeploy) {
    stepN++;
    printStep(stepN, totalActive, "deploy");
    try {
      await runDeployCommand({
        target: opts.target,
        baseUrl: opts.baseUrl,
      });
    } catch (err) {
      console.error(
        chalk.red(`  ✗ deploy failed: ${(err as Error).message}\n`)
      );
      process.exit(1);
    }
  } else {
    printSkip("deploy");
  }

  // ── Final Summary ─────────────────────────────────────────────────────────

  const targetDir = opts.target ?? "agentranks-public";
  const deployDir = path.join(cwd, ".agentranks", "deploy");

  console.log(chalk.bold.green("\n  ✓ Quickstart complete!\n"));
  console.log(chalk.white("  Output locations:"));

  if (!opts.skipDeploy) {
    const deploySummary = path.join(deployDir, "deploy-report.md");
    const sitemapHint = path.join(targetDir, "ai", "sitemap.xml");
    const submitUrlsHint = path.join(".agentranks", "deploy", "submit-urls.txt");

    if (fs.existsSync(deploySummary)) {
      console.log(chalk.gray(`    Deploy report:  .agentranks/deploy/deploy-report.md`));
    }
    console.log(chalk.gray(`    Sitemap:        ${sitemapHint}`));
    console.log(chalk.gray(`    Submit URLs:    ${submitUrlsHint}`));
    console.log(chalk.gray(`    Public folder:  ${targetDir}/`));
  }

  console.log(chalk.white("\n  Next steps:"));
  console.log(
    chalk.gray(`    1. Inspect agentranks-output/ and review the generated content.`)
  );
  if (!opts.skipDeploy) {
    console.log(
      chalk.gray(`    2. Copy ${targetDir}/ to your website's public root or CDN.`)
    );
    console.log(
      chalk.gray(
        "    3. Verify each URL returns HTTP 200, then optionally run:"
      )
    );
    console.log(
      chalk.gray(
        "       agentranks submit --indexnow --dry-run"
      )
    );
  }
  console.log(
    chalk.gray(
      "\n  Note: IndexNow and Google submission are not run automatically.\n" +
        "  Use agentranks submit --indexnow when ready.\n"
    )
  );
}
