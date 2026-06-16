#!/usr/bin/env node

import { config as loadEnv } from "dotenv";
import { Command } from "commander";
import chalk from "chalk";
import { runInit } from "./commands/init.js";
import { runScan } from "./commands/scan.js";
import { runExtract } from "./commands/extract.js";
import { runValidate } from "./commands/validate.js";
import { runGenerate } from "./commands/generate.js";
import { runReview } from "./commands/review.js";
import { runScore } from "./commands/score/index.js";
import { runIntents } from "./commands/intents.js";
import { runDeployCommand } from "./commands/deploy.js";
import { runSubmit } from "./commands/submit.js";
import { runQuickstart } from "./commands/quickstart.js";

// Load .env from working directory
loadEnv({ path: ".env" });

const program = new Command();

program
  .name("agentranks")
  .description("AgentRanks — Build an AI-readable source of truth for your business")
  .version("0.2.0");

// ─── init ─────────────────────────────────────────────────────────────────────
program
  .command("init")
  .description("Initialize a new AgentRanks project in the current directory")
  .action(async () => {
    try {
      await runInit();
    } catch (err) {
      handleError(err);
    }
  });

// ─── scan ─────────────────────────────────────────────────────────────────────
program
  .command("scan [url]")
  .description("Crawl the target website and save page data to .agentranks/pages.json")
  .option("-m, --max-pages <number>", "Maximum pages to crawl", parseInt)
  .option("-d, --delay <ms>", "Delay between requests (ms)", parseInt)
  .action(async (url: string | undefined, opts) => {
    try {
      await runScan(url, {
        maxPages: opts.maxPages,
        delay: opts.delay,
      });
    } catch (err) {
      handleError(err);
    }
  });

// ─── extract ──────────────────────────────────────────────────────────────────
program
  .command("extract")
  .description("Use an LLM to extract business facts from crawled pages")
  .option("-m, --max-pages <number>", "Limit extraction to N pages", parseInt)
  .option("--dry-run", "Print what would be extracted without calling the LLM")
  .action(async (opts) => {
    try {
      await runExtract({
        maxPages: opts.maxPages,
        dryRun: opts.dryRun,
      });
    } catch (err) {
      handleError(err);
    }
  });

// ─── validate ─────────────────────────────────────────────────────────────────
program
  .command("validate")
  .description("Validate extracted facts against the AgentRanks schema")
  .option("--strict", "Treat warnings as errors and exit with non-zero code")
  .action(async (opts) => {
    try {
      await runValidate({ strict: opts.strict });
    } catch (err) {
      handleError(err);
    }
  });

// ─── generate ─────────────────────────────────────────────────────────────────
program
  .command("generate")
  .description("Generate AI-readable output files from validated facts")
  .option("-o, --output-dir <path>", "Override output directory")
  .option("--strict", "Only publish explicitly approved facts (excludes extracted+low-risk)")
  .option("--include-low", "Also include low-priority facts (granular lists, legal pages)")
  .action(async (opts) => {
    try {
      await runGenerate({ outputDir: opts.outputDir, strict: opts.strict, includeLow: opts.includeLow });
    } catch (err) {
      handleError(err);
    }
  });

// ─── review ───────────────────────────────────────────────────────────────────
program
  .command("review")
  .description("Review, approve, and reject extracted facts before publishing")
  .option("--apply", "Apply edits from .agentranks/review.json back to agentranks.facts.json")
  .option("--approve-low-risk", "Approve all extracted low-risk core/supporting facts")
  .option("--reject-needs-review", "Reject all needs_review facts")
  .action(async (opts) => {
    try {
      await runReview({
        apply: opts.apply,
        approveLowRisk: opts.approveLowRisk,
        rejectNeedsReview: opts.rejectNeedsReview,
      });
    } catch (err) {
      handleError(err);
    }
  });

// ─── score ────────────────────────────────────────────────────────────────────
program
  .command("score")
  .description("Score your business AI-readiness from extracted facts (no LLM required)")
  .option("--dry-run", "Print score report without writing score.json / score.md")
  .action(async (opts) => {
    try {
      await runScore({ dryRun: opts.dryRun });
    } catch (err) {
      handleError(err);
    }
  });

// ─── intents ──────────────────────────────────────────────────────────────────
program
  .command("intents")
  .description("Generate AI Intent Pages from the fact graph (no LLM required)")
  .option("-o, --output-dir <path>", "Override output directory")
  .option("--publishing-mode <mode>", "private_export | public_indexable | public_noindex", "private_export")
  .option("--refresh", "Compare with existing intents.json and report changes")
  .option("--dry-run", "Print planned briefs without writing files")
  .option("--prompts-file <path>", "Generate additional intent briefs from a prompts .txt file")
  .action(async (opts) => {
    try {
      await runIntents({
        outputDir: opts.outputDir,
        publishingMode: opts.publishingMode,
        refresh: opts.refresh,
        dryRun: opts.dryRun,
        promptsFile: opts.promptsFile,
      });
    } catch (err) {
      handleError(err);
    }
  });

// ─── deploy ───────────────────────────────────────────────────────────────────
program
  .command("deploy")
  .description(
    "Build a static website-ready output folder from agentranks-output/ (no LLM required)"
  )
  .option("--target <dir>", "Override deploy target directory", "agentranks-public")
  .option("--base-url <url>", "Override base URL from config")
  .option("--include-noindex", "Add noindex meta tag for public_noindex intent pages")
  .option("--dry-run", "Print planned output without writing files")
  .option("--clean", "Remove previously generated AgentRanks paths before writing")
  .option("--force", "Allow deploying private_export intent briefs")
  .action(async (opts) => {
    try {
      await runDeployCommand({
        target: opts.target,
        baseUrl: opts.baseUrl,
        includeNoindex: opts.includeNoindex,
        dryRun: opts.dryRun,
        clean: opts.clean,
        force: opts.force,
      });
    } catch (err) {
      handleError(err);
    }
  });

// ─── submit ───────────────────────────────────────────────────────────────────
program
  .command("submit")
  .description("Submit deployed URLs to search engines (IndexNow supported)")
  .option("--indexnow", "Submit URLs to IndexNow")
  .option("--key <key>", "IndexNow API key")
  .option("--key-file <path>", "Path to file containing the IndexNow API key")
  .option("--host <host>", "Override host (default: derived from config baseUrl)")
  .option("--dry-run", "Print payload without making network calls")
  .option("--endpoint <url>", "Override IndexNow endpoint (for testing)")
  .action(async (opts) => {
    try {
      await runSubmit({
        indexnow: opts.indexnow,
        key: opts.key,
        keyFile: opts.keyFile,
        host: opts.host,
        dryRun: opts.dryRun,
        endpoint: opts.endpoint,
      });
    } catch (err) {
      handleError(err);
    }
  });

// ─── quickstart ───────────────────────────────────────────────────────────────
program
  .command("quickstart [url]")
  .description(
    "Chain init → scan → extract → validate → score → generate → intents → deploy in one command"
  )
  .option("-m, --max-pages <number>", "Max pages to crawl", parseInt)
  .option("-d, --delay <ms>", "Crawl delay in ms", parseInt)
  .option("--approve-low-risk", "Run review --approve-low-risk before generate")
  .option("--publishing-mode <mode>", "Publishing mode for intents", "private_export")
  .option("--base-url <url>", "Override base URL")
  .option("--target <dir>", "Override deploy target directory")
  .option("--skip-review", "Skip the review step entirely")
  .option("--skip-score", "Skip the score step")
  .option("--skip-intents", "Skip the intents step")
  .option("--skip-deploy", "Skip the deploy step")
  .option("--prompts-file <path>", "Pass a prompts file to intents step")
  .option("--dry-run", "Print planned steps without running them")
  .action(async (url: string | undefined, opts) => {
    try {
      await runQuickstart(url, {
        maxPages: opts.maxPages,
        delay: opts.delay,
        approveLowRisk: opts.approveLowRisk,
        publishingMode: opts.publishingMode,
        baseUrl: opts.baseUrl,
        target: opts.target,
        skipReview: opts.skipReview,
        skipScore: opts.skipScore,
        skipIntents: opts.skipIntents,
        skipDeploy: opts.skipDeploy,
        promptsFile: opts.promptsFile,
        dryRun: opts.dryRun,
      });
    } catch (err) {
      handleError(err);
    }
  });

program.parse(process.argv);

function handleError(err: unknown): never {
  if (err instanceof Error) {
    console.error(chalk.red(`\n  Error: ${err.message}\n`));
    if (process.env.DEBUG) {
      console.error(err.stack);
    }
  } else {
    console.error(chalk.red("\n  An unexpected error occurred.\n"));
  }
  process.exit(1);
}
