# Release Checklist

Use this before every public release of `agentranks`.

## Pre-release

- [ ] All tests pass: `pnpm test`
- [ ] Build succeeds: `pnpm build`
- [ ] TypeScript check passes: `pnpm -r exec tsc --noEmit`
- [ ] Version bumped in all `package.json` files (CLI + workspace libs)
- [ ] `CHANGELOG.md` updated (if maintained)
- [ ] README reflects the new version and any new features
- [ ] `docs/cli-reference.md` updated for any new or changed commands
- [ ] `docs/architecture.md` up to date

## Package contents check

```bash
cd packages/cli
npm pack --dry-run
```

Verify the tarball includes:
- `dist/index.js`
- `package.json`
- `README.md`
- `LICENSE`

Verify the tarball excludes:
- `src/`
- `*.test.*`
- `*.map`
- `.env`
- `.agentranks/`
- `agentranks-output/`
- `agentranks-public/`
- Any API keys or IndexNow keys

No `workspace:*` in runtime dependencies of the packed package.

## Binary smoke test

```bash
cd packages/cli
npm pack
npm install -g ./agentranks-*.tgz

agentranks --version
agentranks --help
agentrank --help
agentranks quickstart https://example.com --dry-run
```

## Final checks

- [ ] No uncommitted private files or secrets in the commit
- [ ] `.gitignore` covers: `.env`, `.agentranks/`, `agentranks-output/`, `agentranks-public/`, `indexnow-key*`
- [ ] GitHub Actions CI passes on the release branch
- [ ] Tag format: `v0.2.0`
- [ ] npm publish: `npm publish --access public` from `packages/cli/` (only when ready)

## Post-publish

- [ ] Verify `npm info agentranks` shows correct version, license, homepage
- [ ] Smoke test from a fresh environment: `npm install -g agentranks@latest`
- [ ] Update `agentranks.io` documentation if applicable
