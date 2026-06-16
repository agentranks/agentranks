import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runQuickstart } from "../commands/quickstart.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "ar-quickstart-test-"));
}

// ─── dry-run tests ────────────────────────────────────────────────────────────
// These tests use --dry-run which only prints planned steps and never calls
// external commands (scan, extract, etc.), so no LLM or network access is needed.

describe("runQuickstart --dry-run", () => {
  it("prints planned steps and writes nothing when dry-run", async () => {
    const cwd = makeTmpDir();

    // Capture console output
    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: unknown[]) => logs.push(args.join(" "));

    await runQuickstart("https://example.com", { dryRun: true }, cwd);

    console.log = origLog;

    const output = logs.join("\n");
    assert.ok(output.includes("Planned steps"), "should show planned steps");
    assert.ok(output.includes("dry-run") || output.includes("Dry run"), "should mention dry run");

    // No files should be written
    const agentranks = path.join(cwd, ".agentranks");
    assert.ok(!fs.existsSync(agentranks), "should not create .agentranks dir in dry-run");
  });

  it("shows init step as planned", async () => {
    const cwd = makeTmpDir();

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: unknown[]) => logs.push(args.join(" "));

    await runQuickstart("https://example.com", { dryRun: true }, cwd);

    console.log = origLog;

    const output = logs.join("\n");
    assert.ok(output.includes("init"), "should mention init step");
  });

  it("shows skip steps when skip flags are set", async () => {
    const cwd = makeTmpDir();

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: unknown[]) => logs.push(args.join(" "));

    await runQuickstart("https://example.com", {
      dryRun: true,
      skipScore: true,
      skipIntents: true,
      skipDeploy: true,
    }, cwd);

    console.log = origLog;
    const output = logs.join("\n");

    assert.ok(output.includes("skipped") && output.includes("score"), "should mark score as skipped");
    assert.ok(output.includes("skipped") && output.includes("intents"), "should mark intents as skipped");
    assert.ok(output.includes("skipped") && output.includes("deploy"), "should mark deploy as skipped");
  });

  it("shows max-pages in dry-run output", async () => {
    const cwd = makeTmpDir();

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: unknown[]) => logs.push(args.join(" "));

    await runQuickstart("https://example.com", {
      dryRun: true,
      maxPages: 25,
    }, cwd);

    console.log = origLog;
    const output = logs.join("\n");
    assert.ok(output.includes("25"), "should show max-pages value");
  });

  it("shows prompts-file in dry-run output", async () => {
    const cwd = makeTmpDir();

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: unknown[]) => logs.push(args.join(" "));

    await runQuickstart("https://example.com", {
      dryRun: true,
      promptsFile: "my-prompts.txt",
    }, cwd);

    console.log = origLog;
    const output = logs.join("\n");
    assert.ok(output.includes("my-prompts.txt"), "should show prompts-file in dry-run");
  });

  it("does not include submit in the planned steps", async () => {
    const cwd = makeTmpDir();

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: unknown[]) => logs.push(args.join(" "));

    await runQuickstart("https://example.com", { dryRun: true }, cwd);

    console.log = origLog;
    const output = logs.join("\n").toLowerCase();
    // submit/indexnow should only appear as a suggestion, not as a step
    // The step list should not include "submit" as an active step
    const stepLines = output.split("\n").filter((l) => /^\s+\d+\./.test(l));
    const hasSubmitStep = stepLines.some((l) => l.includes("submit"));
    assert.equal(hasSubmitStep, false, "submit should not be an automatic step");
  });

  it("approve-low-risk is only shown when flag is set", async () => {
    const cwd = makeTmpDir();

    const logsWithout: string[] = [];
    const origLog = console.log;
    console.log = (...args: unknown[]) => logsWithout.push(args.join(" "));
    await runQuickstart("https://example.com", { dryRun: true }, cwd);
    console.log = origLog;

    const logsWith: string[] = [];
    console.log = (...args: unknown[]) => logsWith.push(args.join(" "));
    await runQuickstart("https://example.com", { dryRun: true, approveLowRisk: true }, cwd);
    console.log = origLog;

    const withoutOutput = logsWithout.join("\n");
    const withOutput = logsWith.join("\n");

    // Without flag: review step is skipped
    const withoutStepLines = withoutOutput.split("\n").filter((l) => /^\s+\d+\./.test(l));
    const hasReviewStep = withoutStepLines.some((l) => l.includes("approve-low-risk"));
    assert.equal(hasReviewStep, false, "approve-low-risk should not appear without flag");

    // With flag: review step is included
    const withStepLines = withOutput.split("\n").filter((l) => /^\s+\d+\./.test(l));
    const hasReviewWithFlag = withStepLines.some((l) => l.includes("approve-low-risk"));
    assert.equal(hasReviewWithFlag, true, "approve-low-risk should appear when flag is set");
  });
});
