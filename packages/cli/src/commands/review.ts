import fs from "fs";
import chalk from "chalk";
import {
  getFactsPath,
  getReviewJsonPath,
  getReviewMdPath,
  BusinessFact,
  BusinessFactSchema,
  FactStatus,
  PublishPriority,
} from "@agentranks/core";
import { z } from "zod";
import { loadFacts as loadFactsFromFile } from "../utils/load.js";

export interface ReviewOptions {
  /** Write review.json + review.md from current agentranks.facts.json */
  apply?: boolean;
  /** Promote all extracted+low-risk+core/supporting facts to approved */
  approveLowRisk?: boolean;
  /** Reject all needs_review facts */
  rejectNeedsReview?: boolean;
}

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ReviewApplyStats {
  approved: number;
  extracted: number;
  needs_review: number;
  rejected: number;
  updated: number;
  unchanged: number;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_ORDER: FactStatus[] = ["needs_review", "extracted", "approved", "rejected"];

const RISK_BADGE: Record<string, string> = {
  low: "🟢 low",
  medium: "🟡 medium",
  high: "🔴 high",
};

const PRIORITY_BADGE: Record<PublishPriority, string> = {
  core: "⭐ core",
  supporting: "◎ supporting",
  legal: "⚖ legal",
  low: "· low",
};

export function suggestedAction(fact: BusinessFact): string {
  if (fact.status === "rejected") return "Rejected — will not be published.";
  if (fact.status === "approved") return "Approved — will be published.";

  if (fact.status === "needs_review") {
    if (fact.category === "claim" && fact.riskLevel === "high") {
      return "⚠ High-risk marketing claim — verify evidence or reject.";
    }
    if (fact.category === "proof_point") {
      return "⚠ Proof point — verify accuracy or reject.";
    }
    if (fact.riskLevel === "high") {
      return "⚠ High-risk — review carefully before approving.";
    }
    if (fact.riskLevel === "medium") {
      return "Review evidence, then approve or reject.";
    }
    return "Review and approve, or reject.";
  }

  // extracted
  if (fact.riskLevel === "low" && (fact.publishPriority === "core" || fact.publishPriority === "supporting")) {
    return "✓ Low-risk — ready to approve (or run --approve-low-risk).";
  }
  if (fact.riskLevel !== "low") {
    return "Elevated risk — review before approving.";
  }
  return "Review and approve when ready.";
}

// ─── Core logic (exported for tests) ──────────────────────────────────────────

/** Build the structured JSON for review — returns the full BusinessFact array. */
export function buildReviewJson(facts: BusinessFact[]): BusinessFact[] {
  return [...facts];
}

/** Build a human-friendly Markdown review document. */
export function buildReviewMd(facts: BusinessFact[]): string {
  const now = new Date().toISOString();
  const byStatus = groupByStatus(facts);
  const lines: string[] = [];

  lines.push("# AgentRanks Review");
  lines.push("");
  lines.push(`Generated: ${now}`);
  lines.push(`Total facts: ${facts.length}`);
  lines.push("");

  const counts = STATUS_ORDER.map(
    (s) => `${byStatus[s]?.length ?? 0} ${s}`
  ).join(" · ");
  lines.push(`Status breakdown: ${counts}`);
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("> **How to review:**");
  lines.push("> 1. Edit `.agentranks/review.json` — change `status` to `approved`, `rejected`, or keep as `extracted`/`needs_review`.");
  lines.push("> 2. Run `agentranks review --apply` to write your changes back to `agentranks.facts.json`.");
  lines.push("> 3. Or use shortcuts: `--approve-low-risk` / `--reject-needs-review`.");
  lines.push("");

  for (const status of STATUS_ORDER) {
    const group = byStatus[status];
    if (!group || group.length === 0) continue;

    const statusLabel = {
      needs_review: "Needs Review",
      extracted: "Extracted (unreviewed)",
      approved: "Approved",
      rejected: "Rejected",
    }[status];

    lines.push(`## ${statusLabel} (${group.length})`);
    lines.push("");

    const byCategory = groupByCategory(group);
    for (const [category, catFacts] of Object.entries(byCategory).sort()) {
      lines.push(`### ${category} (${catFacts.length})`);
      lines.push("");

      for (const fact of catFacts) {
        lines.push(`#### \`${fact.id}\``);
        lines.push("");
        lines.push(`**${fact.claim}**`);
        if (fact.detail) {
          lines.push(`> ${fact.detail}`);
        }
        lines.push("");
        lines.push(`- **Evidence:** ${fact.evidenceText}`);
        lines.push(`- **Source:** ${fact.sourceUrl}`);
        lines.push(`- **Confidence:** ${(fact.confidence * 100).toFixed(0)}%`);
        lines.push(`- **Risk:** ${RISK_BADGE[fact.riskLevel] ?? fact.riskLevel}`);
        lines.push(`- **Priority:** ${PRIORITY_BADGE[fact.publishPriority] ?? fact.publishPriority}`);
        if (fact.tags && fact.tags.length > 0) {
          lines.push(`- **Tags:** ${fact.tags.join(", ")}`);
        }
        lines.push(`- **Action:** ${suggestedAction(fact)}`);
        lines.push("");
      }
    }
  }

  return lines.join("\n");
}

/** Apply review.json edits back to the master facts array. */
export function applyReviewToFacts(
  reviewFacts: BusinessFact[],
  existingFacts: BusinessFact[]
): { facts: BusinessFact[]; stats: ReviewApplyStats } {
  const reviewById = new Map(reviewFacts.map((f) => [f.id, f]));
  const existingById = new Map(existingFacts.map((f) => [f.id, f]));

  const stats: ReviewApplyStats = {
    approved: 0,
    extracted: 0,
    needs_review: 0,
    rejected: 0,
    updated: 0,
    unchanged: 0,
  };

  // Merge: start with all existing facts, overlay review changes
  const merged = new Map<string, BusinessFact>();

  for (const existing of existingFacts) {
    const reviewed = reviewById.get(existing.id);
    if (reviewed) {
      const changed = reviewed.status !== existing.status ||
        reviewed.claim !== existing.claim ||
        reviewed.detail !== existing.detail ||
        reviewed.publishPriority !== existing.publishPriority;
      if (changed) {
        merged.set(existing.id, { ...existing, ...reviewed });
        stats.updated++;
      } else {
        merged.set(existing.id, existing);
        stats.unchanged++;
      }
    } else {
      // Not in review.json — keep as-is
      merged.set(existing.id, existing);
      stats.unchanged++;
    }
  }

  // Include any new facts added directly to review.json
  for (const reviewed of reviewFacts) {
    if (!existingById.has(reviewed.id)) {
      merged.set(reviewed.id, reviewed);
      stats.updated++;
    }
  }

  const facts = Array.from(merged.values());

  for (const f of facts) {
    stats[f.status as keyof typeof stats] = ((stats[f.status as keyof typeof stats] as number) ?? 0) + 1;
  }

  return { facts, stats };
}

/** Bulk-approve all extracted+low-risk+core/supporting facts. */
export function approveLowRiskFacts(facts: BusinessFact[]): {
  facts: BusinessFact[];
  count: number;
} {
  let count = 0;
  const updated = facts.map((f) => {
    if (
      f.status === "extracted" &&
      f.riskLevel === "low" &&
      (f.publishPriority === "core" || f.publishPriority === "supporting")
    ) {
      count++;
      return { ...f, status: "approved" as FactStatus };
    }
    return f;
  });
  return { facts: updated, count };
}

/** Bulk-reject all needs_review facts. */
export function rejectNeedsReviewFacts(facts: BusinessFact[]): {
  facts: BusinessFact[];
  count: number;
} {
  let count = 0;
  const updated = facts.map((f) => {
    if (f.status === "needs_review") {
      count++;
      return { ...f, status: "rejected" as FactStatus };
    }
    return f;
  });
  return { facts: updated, count };
}

// ─── Private helpers ───────────────────────────────────────────────────────────

function groupByStatus(facts: BusinessFact[]): Partial<Record<FactStatus, BusinessFact[]>> {
  const groups: Partial<Record<FactStatus, BusinessFact[]>> = {};
  for (const f of facts) {
    if (!groups[f.status]) groups[f.status] = [];
    groups[f.status]!.push(f);
  }
  return groups;
}

function groupByCategory(facts: BusinessFact[]): Record<string, BusinessFact[]> {
  const groups: Record<string, BusinessFact[]> = {};
  for (const f of facts) {
    if (!groups[f.category]) groups[f.category] = [];
    groups[f.category].push(f);
  }
  return groups;
}

function loadReviewFacts(cwd: string): BusinessFact[] {
  try {
    return loadFactsFromFile(cwd);
  } catch (err) {
    console.error(chalk.red(`  ✗ ${(err as Error).message}`));
    process.exit(1);
  }
}

function saveFacts(factsPath: string, facts: BusinessFact[]): void {
  fs.writeFileSync(factsPath, JSON.stringify(facts, null, 2) + "\n", "utf-8");
}

function printStatusSummary(facts: BusinessFact[]): void {
  const counts: Record<FactStatus, number> = { approved: 0, extracted: 0, needs_review: 0, rejected: 0 };
  for (const f of facts) counts[f.status]++;
  console.log(chalk.white(`  Approved:     ${chalk.bold.green(counts.approved)}`));
  console.log(chalk.white(`  Extracted:    ${chalk.bold.white(counts.extracted)}`));
  console.log(chalk.white(`  Needs review: ${chalk.bold.yellow(counts.needs_review)}`));
  console.log(chalk.white(`  Rejected:     ${chalk.bold.red(counts.rejected)}`));
}

// ─── Main command ──────────────────────────────────────────────────────────────

export async function runReview(
  opts: ReviewOptions = {},
  cwd: string = process.cwd()
): Promise<void> {
  console.log(chalk.bold.cyan("\n  AgentRanks Review\n"));

  const factsPath = getFactsPath(cwd);
  const reviewJsonPath = getReviewJsonPath(cwd);
  const reviewMdPath = getReviewMdPath(cwd);

  // ─── --apply ────────────────────────────────────────────────────────────────
  if (opts.apply) {
    console.log(chalk.white("  Applying review.json → agentranks.facts.json\n"));

    if (!fs.existsSync(reviewJsonPath)) {
      console.error(chalk.red(`  ✗ No review file found at ${reviewJsonPath}`));
      console.error(chalk.gray("  Run agentranks review first to create it."));
      process.exit(1);
    }

    let reviewFacts: BusinessFact[];
    try {
      const raw = JSON.parse(fs.readFileSync(reviewJsonPath, "utf-8"));
      const parsed = z.array(BusinessFactSchema).safeParse(raw);
      if (!parsed.success) {
        console.error(chalk.red(`  ✗ review.json is invalid: ${parsed.error.errors[0]?.message}`));
        process.exit(1);
      }
      reviewFacts = parsed.data;
    } catch (err) {
      console.error(chalk.red(`  ✗ Failed to read review.json: ${(err as Error).message}`));
      process.exit(1);
    }

    const existingFacts = loadReviewFacts(cwd);
    const { facts: merged, stats } = applyReviewToFacts(reviewFacts, existingFacts);

    saveFacts(factsPath, merged);

    console.log(chalk.green(`  ✓ ${stats.updated} fact(s) updated, ${stats.unchanged} unchanged\n`));
    printStatusSummary(merged);
    console.log("");
    console.log(chalk.green(`  ✓ Saved to ${chalk.bold(factsPath)}`));
    console.log(chalk.gray("\n  Next step: agentranks generate\n"));
    return;
  }

  // ─── --approve-low-risk ─────────────────────────────────────────────────────
  if (opts.approveLowRisk) {
    console.log(chalk.white("  Approving extracted low-risk core/supporting facts...\n"));
    const facts = loadReviewFacts(cwd);
    const { facts: updated, count } = approveLowRiskFacts(facts);
    saveFacts(factsPath, updated);

    if (count === 0) {
      console.log(chalk.yellow("  No eligible facts to approve."));
      console.log(chalk.gray("  (Only extracted + low-risk + core/supporting facts qualify)\n"));
    } else {
      console.log(chalk.green(`  ✓ Approved ${chalk.bold(count)} fact(s)\n`));
      printStatusSummary(updated);
      console.log("");
      console.log(chalk.green(`  ✓ Saved to ${chalk.bold(factsPath)}`));
    }
    console.log(chalk.gray("\n  Next step: agentranks generate\n"));
    return;
  }

  // ─── --reject-needs-review ──────────────────────────────────────────────────
  if (opts.rejectNeedsReview) {
    console.log(chalk.white("  Rejecting all needs_review facts...\n"));
    const facts = loadReviewFacts(cwd);
    const { facts: updated, count } = rejectNeedsReviewFacts(facts);
    saveFacts(factsPath, updated);

    if (count === 0) {
      console.log(chalk.yellow("  No needs_review facts to reject.\n"));
    } else {
      console.log(chalk.green(`  ✓ Rejected ${chalk.bold(count)} fact(s)\n`));
      printStatusSummary(updated);
      console.log("");
      console.log(chalk.green(`  ✓ Saved to ${chalk.bold(factsPath)}`));
    }
    console.log(chalk.gray("\n  Next step: AgentRanks generate\n"));
    return;
  }

  // ─── default: generate review files ─────────────────────────────────────────
  const facts = loadReviewFacts(cwd);

  if (facts.length === 0) {
    console.log(chalk.yellow("  No facts found. Run agentranks extract first.\n"));
    return;
  }

  const reviewJson = buildReviewJson(facts);
  const reviewMd = buildReviewMd(facts);

  fs.writeFileSync(reviewJsonPath, JSON.stringify(reviewJson, null, 2) + "\n", "utf-8");
  fs.writeFileSync(reviewMdPath, reviewMd, "utf-8");

  console.log(chalk.white(`  Facts total: ${chalk.bold(facts.length)}\n`));

  const counts: Record<FactStatus, number> = { approved: 0, extracted: 0, needs_review: 0, rejected: 0 };
  for (const f of facts) counts[f.status]++;

  printStatusSummary(facts);
  console.log("");
  console.log(chalk.green(`  ✓ ${chalk.bold(reviewJsonPath)}`));
  console.log(chalk.green(`  ✓ ${chalk.bold(reviewMdPath)}`));
  console.log("");
  console.log(chalk.white("  Next steps:"));
  console.log(chalk.gray(`    1. Open ${reviewMdPath} to read the review`));
  console.log(chalk.gray(`    2. Edit ${reviewJsonPath} — change "status" fields`));
  console.log(chalk.gray(`    3. Run agentranks review --apply`));
  if (counts.extracted > 0) {
    console.log(chalk.gray(`    Or: agentranks review --approve-low-risk  (${counts.extracted} extracted facts)`));
  }
  if (counts.needs_review > 0) {
    console.log(chalk.gray(`    Or: agentranks review --reject-needs-review  (${counts.needs_review} needs_review facts)`));
  }
  console.log("");
}
