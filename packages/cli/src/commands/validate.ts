import chalk from "chalk";
import { loadConfig } from "@agentranks/core";
import { validateFacts } from "@agentranks/publisher";
import { loadFacts } from "../utils/load.js";

export interface ValidateOptions {
  strict?: boolean;
}

export async function runValidate(
  opts: ValidateOptions = {},
  cwd: string = process.cwd()
): Promise<void> {
  console.log(chalk.bold.cyan("\n  AgentRanks Validate\n"));

  loadConfig(cwd); // Ensure config exists

  let facts;
  try {
    facts = loadFacts(cwd);
  } catch (err) {
    console.error(chalk.red(`  ✗ ${(err as Error).message}`));
    process.exit(1);
  }

  const report = validateFacts(facts);

  const errors = report.issues.filter((i) => i.severity === "error");
  const warnings = report.issues.filter((i) => i.severity === "warning");

  // Summary
  console.log(chalk.white(`  Total facts:   ${chalk.bold(report.totalFacts)}`));
  console.log(chalk.white(`  Valid facts:   ${chalk.bold(report.validFacts)}`));
  console.log(
    chalk.white(
      `  Errors:        ${errors.length > 0 ? chalk.red(errors.length) : chalk.green(errors.length)}`
    )
  );
  console.log(
    chalk.white(
      `  Warnings:      ${warnings.length > 0 ? chalk.yellow(warnings.length) : chalk.green(warnings.length)}`
    )
  );

  if (errors.length > 0) {
    console.log(chalk.red("\n  Errors:"));
    for (const issue of errors) {
      console.log(
        chalk.red(`    [${issue.factId}] ${issue.field}: ${issue.message}`)
      );
    }
  }

  if (warnings.length > 0) {
    console.log(chalk.yellow("\n  Warnings:"));
    for (const issue of warnings.slice(0, 20)) {
      console.log(
        chalk.yellow(`    [${issue.factId}] ${issue.field}: ${issue.message}`)
      );
    }
    if (warnings.length > 20) {
      console.log(
        chalk.gray(`    ... and ${warnings.length - 20} more warnings`)
      );
    }
  }

  if (report.valid) {
    console.log(chalk.green("\n  ✓ All facts passed validation"));
  } else {
    console.log(
      chalk.red(
        `\n  ✗ Validation failed with ${errors.length} error(s)`
      )
    );
    if (opts.strict) {
      process.exit(1);
    }
  }

  if (opts.strict && warnings.length > 0) {
    console.log(chalk.red("\n  Strict mode: warnings treated as errors"));
    process.exit(1);
  }

  console.log(chalk.gray("\n  Next step: agentranks generate\n"));
}
