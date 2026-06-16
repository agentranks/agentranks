import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ensureGitignore, GITIGNORE_ENTRIES } from "../commands/init.js";

// ─── Helper ───────────────────────────────────────────────────────────────────

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "agentranks-test-"));
}

function readGitignore(dir: string): string {
  return fs.readFileSync(path.join(dir, ".gitignore"), "utf-8");
}

// Track temp dirs for cleanup
const tempDirs: string[] = [];
after(() => {
  for (const dir of tempDirs) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
});

function tmpDir(): string {
  const d = makeTempDir();
  tempDirs.push(d);
  return d;
}

// ─── ensureGitignore ──────────────────────────────────────────────────────────

describe("ensureGitignore", () => {
  it("creates .gitignore with all entries when none exists", () => {
    const dir = tmpDir();
    const { added, skipped } = ensureGitignore(dir);

    assert.equal(added.length, GITIGNORE_ENTRIES.length);
    assert.equal(skipped.length, 0);

    const content = readGitignore(dir);
    for (const entry of GITIGNORE_ENTRIES) {
      assert.ok(content.includes(entry), `${entry} should be in .gitignore`);
    }
  });

  it("adds missing entries to an existing .gitignore", () => {
    const dir = tmpDir();
    fs.writeFileSync(
      path.join(dir, ".gitignore"),
      "node_modules/\n.DS_Store\n",
      "utf-8"
    );

    const { added, skipped } = ensureGitignore(dir);

    assert.equal(added.length, GITIGNORE_ENTRIES.length);
    assert.equal(skipped.length, 0);

    const content = readGitignore(dir);
    assert.ok(content.includes("node_modules/"), "existing lines preserved");
    assert.ok(content.includes(".DS_Store"), "existing lines preserved");
    for (const entry of GITIGNORE_ENTRIES) {
      assert.ok(content.includes(entry), `${entry} should be added`);
    }
  });

  it("does not duplicate entries that already exist", () => {
    const dir = tmpDir();
    fs.writeFileSync(
      path.join(dir, ".gitignore"),
      GITIGNORE_ENTRIES.join("\n") + "\n",
      "utf-8"
    );

    const { added, skipped } = ensureGitignore(dir);

    assert.equal(added.length, 0, "nothing should be added");
    assert.equal(skipped.length, GITIGNORE_ENTRIES.length);

    // Content should be unchanged
    const content = readGitignore(dir);
    const lines = content.split("\n").filter(Boolean);
    for (const entry of GITIGNORE_ENTRIES) {
      assert.equal(
        lines.filter((l) => l.trim() === entry).length,
        1,
        `${entry} should appear exactly once`
      );
    }
  });

  it("does not duplicate entries on repeated calls", () => {
    const dir = tmpDir();

    ensureGitignore(dir);
    ensureGitignore(dir); // second call should not add anything

    const content = readGitignore(dir);
    for (const entry of GITIGNORE_ENTRIES) {
      const count = content.split("\n").filter((l) => l.trim() === entry).length;
      assert.equal(count, 1, `${entry} should appear exactly once after two calls`);
    }
  });

  it("adds only the missing subset when some entries already exist", () => {
    const dir = tmpDir();
    fs.writeFileSync(
      path.join(dir, ".gitignore"),
      ".agentranks/\n.env\n",
      "utf-8"
    );

    const { added, skipped } = ensureGitignore(dir);

    assert.ok(skipped.includes(".agentranks/"));
    assert.ok(skipped.includes(".env"));
    assert.ok(added.includes("agentranks.facts.json"));
    assert.ok(added.includes("agentranks-output/"));
    assert.ok(added.includes("agentranks-public/"));
    assert.ok(added.includes("indexnow-key*"));

    const content = readGitignore(dir);
    for (const entry of GITIGNORE_ENTRIES) {
      assert.ok(content.includes(entry), `${entry} should be in .gitignore`);
    }
  });

  it("preserves trailing content in existing .gitignore", () => {
    const dir = tmpDir();
    const original = "# My project\nbuild/\ndist/\n";
    fs.writeFileSync(path.join(dir, ".gitignore"), original, "utf-8");

    ensureGitignore(dir);

    const content = readGitignore(dir);
    assert.ok(content.startsWith(original), "original content should be at the start");
  });
});
