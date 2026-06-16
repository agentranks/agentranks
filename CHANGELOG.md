# Changelog

All notable changes to AgentRanks Core are documented in this file.

## [0.2.0] - 2026-06-16

### Added

- Deterministic **retrieval vocabulary** on every AI Intent Brief (`RetrievalTerm`, `RetrievalVocabulary`, `ImportedRetrievalTerm` in `@agentranks/core`)
- Visible `## Related terms and user language` section in intent brief Markdown
- Primary terms column in `intents/index.md`
- `docs/programmatic-usage.md`, `docs/release-checklist.md`, `docs/demo-script.md`
- `CONTRIBUTING.md` and GitHub Actions CI workflow
- `examples/knacksters/` curated sample output

### Changed

- Bumped all packages to `0.2.0`
- README updated for Node >= 20 and retrieval vocabulary
- Crawler user-agent string updated to `AgentRanksBot/0.2`

## [0.1.1] - 2026-06-07

### Fixed

- Maintenance and packaging fixes following the initial `0.1.0` release

## [0.1.0] - 2026-06-07

### Added

- Initial open-source CLI: init, scan, extract, validate, review, score, generate, intents, deploy, submit, quickstart
- Structured business facts with source URLs and confidence
- AI Intent Pages, static deploy, and IndexNow submit support
- `llms.txt`, `agentranks.json`, schema.org JSON-LD, and Markdown profile outputs

[0.2.0]: https://github.com/agentranks/agentranks/releases/tag/v0.2.0
[0.1.1]: https://github.com/agentranks/agentranks/releases/tag/v0.1.1
[0.1.0]: https://github.com/agentranks/agentranks/releases/tag/v0.1.0
