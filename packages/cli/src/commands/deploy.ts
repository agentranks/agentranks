import fs from "fs";
import path from "path";
import chalk from "chalk";
import ora from "ora";
import {
  loadConfig,
  CONFIG_DIR,
  getOutputDir,
  getDeployTargetDir,
} from "@agentranks/core";
import { runDeploy } from "@agentranks/publisher";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DeployCommandOptions {
  /** Override target deploy directory. Default: agentranks-public */
  target?: string;
  /** Override base URL from config. */
  baseUrl?: string;
  /** Add noindex meta tag for public_noindex pages. */
  includeNoindex?: boolean;
  /** Print planned output without writing any files. */
  dryRun?: boolean;
  /** Remove previously generated AgentRanks paths before writing. */
  clean?: boolean;
  /** Allow deploying private_export intent briefs. */
  force?: boolean;
}

// ─── Main Command ─────────────────────────────────────────────────────────────

export async function runDeployCommand(
  opts: DeployCommandOptions = {},
  cwd: string = process.cwd()
): Promise<void> {
  console.log(chalk.bold.cyan("\n  AgentRanks Deploy\n"));

  const config = loadConfig(cwd);
  const inputDir = getOutputDir(cwd, config);
  const targetDir = getDeployTargetDir(cwd, opts.target);
  const baseUrl = opts.baseUrl ?? config.baseUrl;
  const configDir = path.join(cwd, CONFIG_DIR);

  // Verify input exists
  if (!fs.existsSync(inputDir)) {
    console.error(chalk.red(`\n  ✗ Input directory not found: ${inputDir}`));
    console.error(chalk.gray("    Run agentranks generate then agentranks intents first.\n"));
    process.exit(1);
  }

  // Surface flags to user before running
  if (opts.dryRun) {
    console.log(chalk.yellow("  ⚠ Dry run mode — no files will be written.\n"));
  }
  if (opts.clean) {
    console.log(
      chalk.yellow(
        "  ⚠ Clean mode — previously generated AgentRanks paths will be removed.\n"
      )
    );
  }
  if (opts.force) {
    console.log(
      chalk.yellow(
        "  ⚠ Force mode — private_export intent briefs will be included.\n"
      )
    );
  }
  if (opts.includeNoindex) {
    console.log(
      chalk.yellow(
        "  ⚠ --include-noindex active — public_noindex pages will carry noindex meta.\n"
      )
    );
  }

  console.log(chalk.white(`  Input:    ${chalk.bold(inputDir)}`));
  console.log(chalk.white(`  Target:   ${chalk.bold(targetDir)}`));
  console.log(chalk.white(`  Base URL: ${chalk.bold(baseUrl)}\n`));

  const spinner = ora({
    text: "Building static deploy output...",
    color: "cyan",
  }).start();

  let result;
  try {
    result = await runDeploy({
      inputDir,
      targetDir,
      baseUrl,
      configDir,
      includeNoindex: opts.includeNoindex,
      dryRun: opts.dryRun,
      clean: opts.clean,
      force: opts.force,
    });
  } catch (err) {
    spinner.stop();
    console.error(chalk.red(`\n  ✗ Deploy failed:\n`));
    console.error(chalk.red(`  ${(err as Error).message}\n`));
    process.exit(1);
  }

  spinner.stop();

  // Print warnings
  if (result.warnings.length > 0) {
    console.log(chalk.yellow("  Warnings:\n"));
    for (const w of result.warnings) {
      console.log(chalk.yellow(`    ⚠ ${w}`));
    }
    console.log("");
  }

  // Dry-run summary
  if (opts.dryRun) {
    console.log(
      chalk.bold(
        `  Planned output (${chalk.green(String(result.deployedFiles.length))} files):\n`
      )
    );
    for (const filePath of result.deployedFiles) {
      console.log(chalk.gray(`    ${path.relative(cwd, filePath)}`));
    }
    console.log(
      chalk.gray("\n  Dry run: no files written. Remove --dry-run to deploy.\n")
    );
    return;
  }

  // Success summary
  const targetName = path.relative(cwd, targetDir) || path.basename(targetDir);
  console.log(
    chalk.green(
      `  ✓ Deployed ${chalk.bold(String(result.deployedFiles.length))} files\n`
    )
  );
  console.log(chalk.white(`  Target:  ${chalk.bold(targetDir)}`));
  console.log(chalk.white(`  Sitemap: ${chalk.bold(result.sitemapUrl)}\n`));

  console.log(chalk.white("  Next steps:"));
  console.log(
    chalk.gray(
      `    1. Copy ${chalk.italic(targetName + "/")} to your website's public root or CDN`
    )
  );
  console.log(
    chalk.gray(
      "    2. Verify each URL returns HTTP 200 before submitting to search engines"
    )
  );
  console.log(chalk.gray("    3. Submit sitemap to Google Search Console:"));
  console.log(chalk.gray(`       ${result.sitemapUrl}`));
  console.log(
    chalk.gray(
      "    4. Submit URLs to IndexNow: agentranks submit --indexnow\n"
    )
  );

  console.log(
    chalk.gray(
      "  Note: indexing is not instant — Google typically crawls new pages within days to weeks.\n"
    )
  );
}
