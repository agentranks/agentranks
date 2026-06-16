import fs from "fs";
import path from "path";
import chalk from "chalk";
import ora from "ora";
import {
  loadConfig,
  getPagesPath,
  AgentRanksConfigSchema,
} from "@agentranks/core";
import { crawlSite, CrawlProgress } from "@agentranks/crawler";
import { truncateUrl } from "../utils.js";

export interface ScanOptions {
  maxPages?: number;
  delay?: number;
}

export async function runScan(
  url?: string,
  opts: ScanOptions = {},
  cwd: string = process.cwd()
): Promise<void> {
  console.log(chalk.bold.cyan("\n  AgentRanks Scan\n"));

  let config = loadConfig(cwd);

  // Override URL and options if provided via CLI
  if (url) {
    try {
      new URL(url);
    } catch {
      console.error(chalk.red(`  Invalid URL: ${url}`));
      process.exit(1);
    }
    config = AgentRanksConfigSchema.parse({ ...config, baseUrl: url });
  }

  if (opts.maxPages) config = { ...config, maxPages: opts.maxPages };
  if (opts.delay) config = { ...config, crawlDelay: opts.delay };

  const startUrl = config.baseUrl;
  const maxPages = config.maxPages ?? 50;
  const crawlDelay = config.crawlDelay ?? 500;

  console.log(chalk.white(`  Target: ${chalk.bold(startUrl)}`));
  console.log(chalk.white(`  Max pages: ${chalk.bold(maxPages)}`));
  console.log(chalk.white(`  Delay: ${chalk.bold(crawlDelay + "ms")}\n`));

  const spinner = ora({ text: "Starting crawl...", color: "cyan" }).start();

  const result = await crawlSite(startUrl, {
    maxPages,
    crawlDelay,
    includePatterns: config.includePatterns,
    excludePatterns: config.excludePatterns,
    onPageCrawled: (page, progress: CrawlProgress) => {
      spinner.text =
        `Crawling... ${chalk.bold(progress.crawled)}/${maxPages} pages` +
        ` | Queued: ${progress.queued}` +
        ` | ${chalk.dim(truncateUrl(page.url, 50))}`;
    },
  });

  spinner.stop();

  // Save pages
  const pagesPath = getPagesPath(cwd);
  fs.mkdirSync(path.dirname(pagesPath), { recursive: true });
  fs.writeFileSync(pagesPath, JSON.stringify(result.pages, null, 2) + "\n", "utf-8");

  // Report
  console.log(chalk.green(`  ✓ Crawled ${chalk.bold(result.pages.length)} pages`));

  if (result.errors.length > 0) {
    console.log(
      chalk.yellow(`  ⚠ ${result.errors.length} errors encountered:`)
    );
    for (const err of result.errors.slice(0, 5)) {
      console.log(chalk.gray(`    ${truncateUrl(err.url, 60)}: ${err.error}`));
    }
    if (result.errors.length > 5) {
      console.log(chalk.gray(`    ... and ${result.errors.length - 5} more`));
    }
  }

  if (result.progress.skipped > 0) {
    console.log(
      chalk.gray(`  ℹ ${result.progress.skipped} pages skipped (robots.txt / patterns)`)
    );
  }

  console.log(chalk.green(`\n  ✓ Pages saved to ${chalk.bold(pagesPath)}`));
  console.log(chalk.gray("\n  Next step: agentranks extract\n"));
}
