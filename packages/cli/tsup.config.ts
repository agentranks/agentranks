import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  platform: "node",
  target: "node18",
  outDir: "dist",
  splitting: false,
  sourcemap: false,
  clean: false, // tsc already compiled tests; only overwrite dist/index.js
  dts: false,   // CLI binary; consumers don't import it
  shims: true,
  // Inject a real createRequire so CJS deps (iconv-lite via cheerio) can require() Node builtins
  banner: {
    js: `import { createRequire as __cjsRequire } from "module";\nconst require = __cjsRequire(import.meta.url);`,
  },
  // src/index.ts already has the shebang; tsup moves it to line 1 automatically
  // Bundle all internal workspace packages; keep external npm deps external
  noExternal: [
    "@agentranks/core",
    "@agentranks/crawler",
    "@agentranks/ai",
    "@agentranks/publisher",
  ],
});
