/**
 * Copies README.md and LICENSE from the repo root into packages/cli
 * before npm pack runs. These files are listed in the "files" field
 * and will appear in the published tarball.
 *
 * Runs as part of the "prepack" script.
 */
import { copyFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgDir = resolve(__dirname, "..");
const repoRoot = resolve(pkgDir, "../..");

const files = ["README.md", "LICENSE"];

for (const file of files) {
  const src = resolve(repoRoot, file);
  const dest = resolve(pkgDir, file);
  if (existsSync(src)) {
    copyFileSync(src, dest);
    console.log(`prepare-pack: copied ${file}`);
  } else {
    console.warn(`prepare-pack: ${file} not found at ${src}, skipping`);
  }
}
