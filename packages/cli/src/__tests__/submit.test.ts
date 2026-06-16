import { describe, it, mock, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runSubmit } from "../commands/submit.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "ar-submit-test-"));
}

const MOCK_CONFIG = {
  version: "1",
  name: "Acme Inc",
  baseUrl: "https://acme.com",
  maxPages: 50,
  crawlDelay: 500,
};

function writeConfig(dir: string, config = MOCK_CONFIG): void {
  const configDir = path.join(dir, ".agentranks");
  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(
    path.join(configDir, "config.json"),
    JSON.stringify(config, null, 2),
    "utf-8"
  );
}

function writeDeployJson(dir: string, publicUrls: string[]): void {
  const deployDir = path.join(dir, ".agentranks", "deploy");
  fs.mkdirSync(deployDir, { recursive: true });
  fs.writeFileSync(
    path.join(deployDir, "deploy.json"),
    JSON.stringify({ publicUrls, deployedAt: new Date().toISOString(), baseUrl: MOCK_CONFIG.baseUrl }, null, 2),
    "utf-8"
  );
}

function writeSubmitUrls(dir: string, urls: string[]): void {
  const deployDir = path.join(dir, ".agentranks", "deploy");
  fs.mkdirSync(deployDir, { recursive: true });
  fs.writeFileSync(
    path.join(deployDir, "submit-urls.txt"),
    urls.join("\n") + "\n",
    "utf-8"
  );
}

const TEST_URLS = [
  "https://acme.com/ai-profile/",
  "https://acme.com/services/",
  "https://acme.com/ai/intents/csm/",
];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("runSubmit — reads URLs from deploy.json", () => {
  it("reads publicUrls from deploy.json when present", async () => {
    const cwd = makeTmpDir();
    writeConfig(cwd);
    writeDeployJson(cwd, TEST_URLS);

    let captured: string[] = [];
    const fakeEndpoint = "http://localhost:9999/test-indexnow";

    // We override fetch to capture the payload
    const origFetch = globalThis.fetch;
    // @ts-expect-error -- test override
    globalThis.fetch = async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init?.body as string);
      captured = body.urlList;
      return { status: 200, statusText: "OK", text: async () => "" };
    };

    await runSubmit(
      { indexnow: true, key: "testkey123", dryRun: false, endpoint: fakeEndpoint },
      cwd
    );

    globalThis.fetch = origFetch;
    assert.deepEqual(captured, TEST_URLS);
  });
});

describe("runSubmit — falls back to submit-urls.txt", () => {
  it("uses submit-urls.txt when deploy.json is absent", async () => {
    const cwd = makeTmpDir();
    writeConfig(cwd);
    writeSubmitUrls(cwd, TEST_URLS);

    let captured: string[] = [];
    const fakeEndpoint = "http://localhost:9999/test-indexnow";

    const origFetch = globalThis.fetch;
    // @ts-expect-error -- test override
    globalThis.fetch = async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init?.body as string);
      captured = body.urlList;
      return { status: 200, statusText: "OK", text: async () => "" };
    };

    await runSubmit(
      { indexnow: true, key: "testkey123", dryRun: false, endpoint: fakeEndpoint },
      cwd
    );

    globalThis.fetch = origFetch;
    assert.deepEqual(captured, TEST_URLS);
  });
});

describe("runSubmit — dry run", () => {
  it("does not call fetch in dry-run mode", async () => {
    const cwd = makeTmpDir();
    writeConfig(cwd);
    writeDeployJson(cwd, TEST_URLS);

    let fetchCalled = false;
    const origFetch = globalThis.fetch;
    // @ts-expect-error -- test override
    globalThis.fetch = async () => {
      fetchCalled = true;
      return { status: 200, statusText: "OK", text: async () => "" };
    };

    await runSubmit(
      { indexnow: true, key: "testkey", dryRun: true },
      cwd
    );

    globalThis.fetch = origFetch;
    assert.equal(fetchCalled, false, "fetch should not be called in dry-run mode");
  });
});

describe("runSubmit — payload structure", () => {
  it("builds correct IndexNow payload with host, key, keyLocation, urlList", async () => {
    const cwd = makeTmpDir();
    writeConfig(cwd);
    writeDeployJson(cwd, TEST_URLS);

    let payload: Record<string, unknown> = {};
    const fakeEndpoint = "http://localhost:9999/test-indexnow";

    const origFetch = globalThis.fetch;
    // @ts-expect-error -- test override
    globalThis.fetch = async (_url: string, init: RequestInit) => {
      payload = JSON.parse(init?.body as string);
      return { status: 200, statusText: "OK", text: async () => "" };
    };

    await runSubmit(
      { indexnow: true, key: "mykey", endpoint: fakeEndpoint },
      cwd
    );

    globalThis.fetch = origFetch;
    assert.equal(payload.host, "acme.com");
    assert.equal(payload.key, "mykey");
    assert.ok(typeof payload.keyLocation === "string" && (payload.keyLocation as string).includes("mykey"));
    assert.ok(Array.isArray(payload.urlList) && (payload.urlList as string[]).length === TEST_URLS.length);
  });
});

describe("runSubmit — key handling", () => {
  it("uses --key when provided", async () => {
    const cwd = makeTmpDir();
    writeConfig(cwd);
    writeDeployJson(cwd, TEST_URLS);

    let usedKey = "";
    const origFetch = globalThis.fetch;
    // @ts-expect-error -- test override
    globalThis.fetch = async (_url: string, init: RequestInit) => {
      usedKey = JSON.parse(init?.body as string).key;
      return { status: 200, statusText: "OK", text: async () => "" };
    };

    await runSubmit({ indexnow: true, key: "explicit-key-abc", endpoint: "http://localhost:9999" }, cwd);

    globalThis.fetch = origFetch;
    assert.equal(usedKey, "explicit-key-abc");
  });

  it("reads key from --key-file when provided", async () => {
    const cwd = makeTmpDir();
    writeConfig(cwd);
    writeDeployJson(cwd, TEST_URLS);

    const keyFile = path.join(cwd, "mykey.txt");
    fs.writeFileSync(keyFile, "file-based-key-xyz\n", "utf-8");

    let usedKey = "";
    const origFetch = globalThis.fetch;
    // @ts-expect-error -- test override
    globalThis.fetch = async (_url: string, init: RequestInit) => {
      usedKey = JSON.parse(init?.body as string).key;
      return { status: 200, statusText: "OK", text: async () => "" };
    };

    await runSubmit({ indexnow: true, keyFile, endpoint: "http://localhost:9999" }, cwd);

    globalThis.fetch = origFetch;
    assert.equal(usedKey, "file-based-key-xyz");
  });

  it("generates a key and writes indexnow-key.txt when no key provided", async () => {
    const cwd = makeTmpDir();
    writeConfig(cwd);
    writeDeployJson(cwd, TEST_URLS);

    const origFetch = globalThis.fetch;
    // @ts-expect-error -- test override
    globalThis.fetch = async () => ({ status: 200, statusText: "OK", text: async () => "" });

    await runSubmit({ indexnow: true, endpoint: "http://localhost:9999" }, cwd);
    globalThis.fetch = origFetch;

    const keyPath = path.join(cwd, ".agentranks", "submit", "indexnow-key.txt");
    assert.ok(fs.existsSync(keyPath), "indexnow-key.txt should be created");
    const key = fs.readFileSync(keyPath, "utf-8").trim();
    assert.ok(key.length >= 16, "generated key should be at least 16 chars");
  });
});

describe("runSubmit — report files", () => {
  it("writes indexnow-report.json and indexnow-report.md", async () => {
    const cwd = makeTmpDir();
    writeConfig(cwd);
    writeDeployJson(cwd, TEST_URLS);

    const origFetch = globalThis.fetch;
    // @ts-expect-error -- test override
    globalThis.fetch = async () => ({ status: 200, statusText: "OK", text: async () => "" });

    await runSubmit({ indexnow: true, key: "mykey", endpoint: "http://localhost:9999" }, cwd);
    globalThis.fetch = origFetch;

    const reportJson = path.join(cwd, ".agentranks", "submit", "indexnow-report.json");
    const reportMd = path.join(cwd, ".agentranks", "submit", "indexnow-report.md");

    assert.ok(fs.existsSync(reportJson), "indexnow-report.json should exist");
    assert.ok(fs.existsSync(reportMd), "indexnow-report.md should exist");

    const report = JSON.parse(fs.readFileSync(reportJson, "utf-8"));
    assert.equal(report.urlCount, TEST_URLS.length);
    assert.equal(report.host, "acme.com");
  });

  it("handles non-200 HTTP responses gracefully", async () => {
    const cwd = makeTmpDir();
    writeConfig(cwd);
    writeDeployJson(cwd, TEST_URLS);

    const origFetch = globalThis.fetch;
    // @ts-expect-error -- test override
    globalThis.fetch = async () => ({ status: 422, statusText: "Unprocessable Entity", text: async () => "Bad key" });

    await runSubmit({ indexnow: true, key: "badkey", endpoint: "http://localhost:9999" }, cwd);
    globalThis.fetch = origFetch;

    const reportJson = path.join(cwd, ".agentranks", "submit", "indexnow-report.json");
    const report = JSON.parse(fs.readFileSync(reportJson, "utf-8"));
    assert.equal(report.status, 422);
    assert.equal(report.failed, TEST_URLS.length);
    assert.equal(report.submitted, 0);
  });
});

describe("runSubmit — no Google submission", () => {
  it("does not call Google endpoints", async () => {
    const cwd = makeTmpDir();
    writeConfig(cwd);
    writeDeployJson(cwd, TEST_URLS);

    const calledUrls: string[] = [];
    const origFetch = globalThis.fetch;
    // @ts-expect-error -- test override
    globalThis.fetch = async (url: string) => {
      calledUrls.push(url);
      return { status: 200, statusText: "OK", text: async () => "" };
    };

    await runSubmit({ indexnow: true, key: "mykey", endpoint: "https://api.indexnow.org/IndexNow" }, cwd);
    globalThis.fetch = origFetch;

    const hasGoogle = calledUrls.some(
      (u) => u.includes("google.com") || u.includes("googleapis.com")
    );
    assert.equal(hasGoogle, false, "should not call any Google endpoints");
  });
});
