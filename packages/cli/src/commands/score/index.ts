import fs from "fs";
import chalk from "chalk";
import { loadConfig, getScoreJsonPath, getScoreMdPath } from "@agentranks/core";
import { loadFacts } from "../../utils/load.js";
import { computeScore } from "./logic.js";
import { buildScoreMd, printScoreReport } from "./report.js";

export type { CategoryScores, FactCounts, ScoreReport, SectionStatus, SectionDef } from "./types.js";
export { SECTIONS } from "./types.js";
export { isPublishable, isExcluded, getSectionHealth } from "./logic.js";
export {
  scoreCompanyProfile,
  scoreServiceProduct,
  scorePricingClarity,
  scoreFaqCoverage,
  scorePolicyClarity,
  scoreUseCaseCoverage,
  scoreDifferentiatorQuality,
  scoreEvidenceQuality,
  scoreRiskBurden,
  scoreOutputReadiness,
  generateRecommendations,
  computeScore,
} from "./logic.js";
export { buildScoreMd } from "./report.js";

export interface ScoreOptions {
  /** Print the full score report to stdout only, skip writing files. */
  dryRun?: boolean;
}

export async function runScore(
  opts: ScoreOptions = {},
  cwd: string = process.cwd()
): Promise<void> {
  console.log(chalk.bold.cyan("\n  AgentRanks Score\n"));

  const config = loadConfig(cwd);
  const businessName = config.name;

  let facts;
  try {
    facts = loadFacts(cwd);
  } catch (err) {
    console.error(chalk.red(`  ✗ ${(err as Error).message}`));
    process.exit(1);
  }

  const report = computeScore(facts);

  printScoreReport(report, businessName);

  if (!opts.dryRun) {
    const scoreJsonPath = getScoreJsonPath(cwd);
    const scoreMdPath = getScoreMdPath(cwd);

    fs.writeFileSync(scoreJsonPath, JSON.stringify(report, null, 2) + "\n", "utf-8");
    fs.writeFileSync(scoreMdPath, buildScoreMd(report, businessName), "utf-8");

    console.log(chalk.green(`  ✓ ${chalk.bold(scoreJsonPath)}`));
    console.log(chalk.green(`  ✓ ${chalk.bold(scoreMdPath)}`));
    console.log("");
  }
}
