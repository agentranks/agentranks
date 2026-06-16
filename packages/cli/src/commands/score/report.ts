import chalk from "chalk";
import { CategoryScores, ScoreReport } from "./types.js";

// ─── Formatting helpers ───────────────────────────────────────────────────────

const SCORE_GRADE = (s: number): string => {
  if (s >= 85) return "A";
  if (s >= 70) return "B";
  if (s >= 55) return "C";
  if (s >= 40) return "D";
  return "F";
};

const SCORE_LABEL = (s: number): string => {
  if (s >= 85) return "Excellent";
  if (s >= 70) return "Good";
  if (s >= 55) return "Fair";
  if (s >= 40) return "Poor";
  return "Critical";
};

const CAT_BAR = (s: number): string => {
  const filled = Math.round(s);
  return "█".repeat(filled) + "░".repeat(10 - filled);
};

const CATEGORY_LABELS: Record<keyof CategoryScores, string> = {
  companyProfile:        "Company Profile",
  serviceProduct:        "Service/Product Clarity",
  pricingClarity:        "Pricing Clarity",
  faqCoverage:           "FAQ Coverage",
  policyClarity:         "Policy Clarity",
  useCaseCoverage:       "Use-Case Coverage",
  differentiatorQuality: "Differentiator Quality",
  evidenceQuality:       "Evidence Quality",
  riskBurden:            "Risk/Review Burden",
  outputReadiness:       "AI Output Readiness",
};

// ─── Markdown report ──────────────────────────────────────────────────────────

export function buildScoreMd(report: ScoreReport, businessName: string): string {
  const lines: string[] = [];
  const grade = SCORE_GRADE(report.overallScore);
  const label = SCORE_LABEL(report.overallScore);

  lines.push(`# AgentRanks AI-Readiness Score — ${businessName}`);
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");
  lines.push(`## Overall Score: ${report.overallScore}/100 (${grade} — ${label})`);
  lines.push("");

  lines.push("## Category Scores");
  lines.push("");
  lines.push("| Category | Score | Bar |");
  lines.push("|----------|------:|-----|");
  for (const [key, score] of Object.entries(report.categoryScores) as [keyof CategoryScores, number][]) {
    const catLabel = CATEGORY_LABELS[key];
    const bar = CAT_BAR(score);
    lines.push(`| ${catLabel} | ${score}/10 | \`${bar}\` |`);
  }
  lines.push("");

  if (report.healthySections.length > 0) {
    lines.push("## ✅ Healthy Sections");
    lines.push("");
    for (const s of report.healthySections) lines.push(`- ${s}`);
    lines.push("");
  }

  if (report.weakSections.length > 0) {
    lines.push("## ⚠ Weak Sections");
    lines.push("");
    lines.push("These sections have publishable facts but are below the healthy threshold or have evidence/confidence issues.");
    lines.push("");
    for (const s of report.weakSections) lines.push(`- ${s}`);
    lines.push("");
  }

  if (report.notPublishableSections.length > 0) {
    lines.push("## 🔒 Not-Publishable Sections");
    lines.push("");
    lines.push("Facts exist but none are publishable (all need review or are rejected).");
    lines.push("");
    for (const s of report.notPublishableSections) lines.push(`- ${s}`);
    lines.push("");
  }

  if (report.missingSections.length > 0) {
    lines.push("## ❌ Missing Sections");
    lines.push("");
    lines.push("No facts were found in these categories.");
    lines.push("");
    for (const s of report.missingSections) lines.push(`- ${s}`);
    lines.push("");
  }

  lines.push("## Fact Count Summary");
  lines.push("");
  lines.push("| Metric | Count |");
  lines.push("|--------|------:|");
  lines.push(`| Total facts | ${report.counts.totalFacts} |`);
  lines.push(`| Publishable | ${report.counts.publishableFacts} |`);
  lines.push(`| Approved | ${report.counts.approvedFacts} |`);
  lines.push(`| Extracted (unreviewed) | ${report.counts.extractedFacts} |`);
  lines.push(`| Needs review | ${report.counts.needsReviewFacts} |`);
  lines.push(`| Rejected | ${report.counts.rejectedFacts} |`);
  lines.push(`| High risk | ${report.counts.highRiskFacts} |`);
  lines.push(`| Low priority | ${report.counts.lowPriorityFacts} |`);
  lines.push("");

  if (report.recommendations.length > 0) {
    lines.push("## Top Recommendations");
    lines.push("");
    report.recommendations.forEach((rec, i) => {
      lines.push(`${i + 1}. ${rec}`);
    });
    lines.push("");
  }

  return lines.join("\n");
}

// ─── Terminal output ──────────────────────────────────────────────────────────

export function printScoreReport(report: ScoreReport, businessName: string): void {
  const grade = SCORE_GRADE(report.overallScore);
  const label = SCORE_LABEL(report.overallScore);
  const scoreColor = report.overallScore >= 70
    ? chalk.green
    : report.overallScore >= 40
    ? chalk.yellow
    : chalk.red;

  console.log(chalk.white(`  Business: ${chalk.bold(businessName)}\n`));
  console.log(
    `  Overall Score: ${scoreColor.bold(`${report.overallScore}/100`)}  ${chalk.gray(`${grade} — ${label}`)}\n`
  );

  console.log(chalk.white("  Category Scores:\n"));
  for (const [key, score] of Object.entries(report.categoryScores) as [keyof CategoryScores, number][]) {
    const catLabel = CATEGORY_LABELS[key].padEnd(28);
    const scoreStr = `${score}/10`.padStart(5);
    const bar = CAT_BAR(score);
    const color = score >= 8 ? chalk.green : score >= 5 ? chalk.yellow : chalk.red;
    console.log(`    ${catLabel} ${color(scoreStr)}  ${chalk.gray(bar)}`);
  }
  console.log("");

  const sections = [
    { list: report.healthySections,        label: "✅ Healthy:       ", color: chalk.green },
    { list: report.weakSections,           label: "⚠  Weak:          ", color: chalk.yellow },
    { list: report.notPublishableSections, label: "🔒 Not publishable:", color: chalk.yellow },
    { list: report.missingSections,        label: "❌ Missing:       ", color: chalk.red },
  ];
  for (const { list, label, color } of sections) {
    if (list.length > 0) {
      console.log(`  ${label} ${color(list.join(", "))}`);
    }
  }
  console.log("");

  console.log(
    chalk.white(
      `  Facts:  ${chalk.bold(report.counts.totalFacts)} total  |  ` +
      `${chalk.green.bold(report.counts.publishableFacts)} publishable  |  ` +
      `${chalk.yellow(report.counts.needsReviewFacts)} needs_review  |  ` +
      `${chalk.red(report.counts.rejectedFacts)} rejected`
    )
  );
  console.log("");

  if (report.recommendations.length > 0) {
    console.log(chalk.white("  Top Recommendations:\n"));
    report.recommendations.slice(0, 5).forEach((rec, i) => {
      console.log(chalk.gray(`    ${i + 1}. ${rec}`));
    });
    if (report.recommendations.length > 5) {
      console.log(
        chalk.gray(`    ... and ${report.recommendations.length - 5} more (see .agentranks/score.md)`)
      );
    }
    console.log("");
  }
}
