/**
 * Removes the README.md and LICENSE copies that prepare-pack.mjs placed
 * in packages/cli after npm pack completes.
 *
 * Runs as part of the "postpack" script.
 * Only deletes files if they were copied from the repo root (not committed
 * package-local files).
 */
import { unlinkSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgDir = resolve(__dirname, "..");
const repoRoot = resolve(pkgDir, "../..");

const files = ["README.md", "LICENSE"];

for (const file of files) {
  const pkgFile = resolve(pkgDir, file);
  const rootFile = resolve(repoRoot, file);
  // Only remove if the root source still exists (i.e. this was a copy, not original)
  if (existsSync(pkgFile) && existsSync(rootFile)) {
    unlinkSync(pkgFile);
    console.log(`cleanup-pack: removed ${file}`);
  }
}
