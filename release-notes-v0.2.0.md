## AgentRanks Core v0.2.0

First polished public release of AgentRanks Core — the open-source CLI that turns a business website into an AI-readable, source-backed source of truth.

### Added

- **Deterministic retrieval vocabulary** on every AI intent brief — a visible "Related terms and user language" section derived from your publishable facts. No LLM, no hidden text, no keyword stuffing.
- New core types: `RetrievalTerm`, `RetrievalVocabulary`, `ImportedRetrievalTerm` in `@agentranks/core`.
- Primary terms column in `intents/index.md`.
- `CONTRIBUTING.md`, `SECURITY.md`, and `CHANGELOG.md`.
- GitHub Actions CI (build + test + `npm pack --dry-run`).
- `examples/knacksters/` — representative end-to-end output.
- Docs: `programmatic-usage.md`, `release-checklist.md`, `demo-script.md`.

### Changed

- All packages bumped to `0.2.0`.
- README: added "Why AgentRanks?" overview and status badges; Node >= 20; corrected `.agentranks/` paths, the `agentrank` alias note, and LLM defaults.
- Crawler user-agent updated to `AgentRanksBot/0.2`.

### Install

```bash
npm install -g agentranks
agentranks quickstart https://yourcompany.com --publishing-mode public_indexable
```

### Pipeline

scan → extract → validate → score → review → generate → intents → deploy → submit

**Full changelog:** see [`CHANGELOG.md`](./CHANGELOG.md).
