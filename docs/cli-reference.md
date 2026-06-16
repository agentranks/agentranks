# AgentRanks CLI Reference

## Installation

```bash
# Global install (recommended)
npm install -g agentranks

# Or from the monorepo root (development)
pnpm install
pnpm build

# Run directly (recommended for development)
node packages/cli/dist/index.js init
```

> **Note:** The root `package.json` has an `agentranks` script that points to `node packages/cli/dist/index.js`, but `pnpm run agentranks -- init` passes the `--` separator as a literal argument to the CLI. Always invoke the entry point directly:
>
> ```bash
> node packages/cli/dist/index.js <command>
> ```
>
> To use the bare `agentranks` command (or its `agentranks` alias), link the package globally instead:
>
> ```bash
> cd packages/cli && pnpm link --global
> # then: agentranks init
> ```
>
> Once published to npm:
>
> ```bash
> npx agentranks init
> ```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AGENTRANKS_LLM_API_KEY` | _(required for extract)_ | API key for OpenAI-compatible LLM |
| `AGENTRANKS_LLM_BASE_URL` | `https://api.deepseek.com/v1` | LLM API base URL |
| `AGENTRANKS_LLM_MODEL` | `deepseek-chat` | Model name |
| `AGENTRANKS_LLM_MAX_TOKENS` | _(unset)_ | Maximum output tokens. **Optional** — omit to let the model use its own maximum. Only set to cap cost or satisfy an API requirement. |
| `AGENTRANKS_MAX_PAGES` | `50` | Default max pages per crawl |
| `AGENTRANKS_CRAWL_DELAY` | `500` | Default delay between requests (ms) |

Copy `.env.example` to `.env` and fill in your values.

---

## Commands

### `agentranks init`

Interactively initialize a new AgentRanks project.

```bash
agentranks init
```

**Creates:** `agentranks/config.json`

**Prompts:**
- Website URL
- Business name
- Short description (optional)
- Max pages to crawl (default: 50)
- Delay between requests (default: 500ms)
- LLM API base URL
- LLM model name

---

### `agentranks scan [url]`

Crawl the target website and extract page content.

```bash
agentranks scan
agentranks scan https://example.com
agentranks scan --max-pages 20 --delay 1000
```

**Options:**
| Flag | Description |
|------|-------------|
| `[url]` | Override the base URL from config |
| `-m, --max-pages <n>` | Max pages to crawl |
| `-d, --delay <ms>` | Milliseconds between requests |

**Creates:** `agentranks/pages.json`

**Notes:**
- Respects `robots.txt` automatically
- Only crawls same-origin links
- Skips non-HTML content types
- Rate-limits by default (500ms between requests)

---

### `agentranks extract`

Use an LLM to extract structured business facts from crawled pages.

```bash
agentranks extract
agentranks extract --max-pages 10
agentranks extract --dry-run
```

**Options:**
| Flag | Description |
|------|-------------|
| `-m, --max-pages <n>` | Limit extraction to first N pages |
| `--dry-run` | Show what would happen without calling the LLM |

**Requires:** `agentranks/pages.json`, `AGENTRANKS_LLM_API_KEY`

**Creates:** `agentranks.facts.json`

**Notes:**
- Uses the LLM config from `agentranks/config.json` or environment variables
- Deduplicates facts across pages (higher-confidence version wins)
- Each fact includes `sourceUrl` and `confidence` (0.0–1.0)

---

### `agentranks validate`

Validate extracted facts against the AgentRanks schema.

```bash
agentranks validate
agentranks validate --strict
```

**Options:**
| Flag | Description |
|------|-------------|
| `--strict` | Exit with error code on warnings (default: only errors) |

**Requires:** `agentranks.facts.json`

**Checks:**
- Schema validity (via Zod)
- Confidence < 0.5 (warning)
- Very short claims (warning)

---

### `agentranks review`

Generate a human-friendly review of all extracted facts, and apply changes back to `agentranks.facts.json`.

This is the human-in-the-loop curation step — sits between `extract` and `generate`.

```bash
# Generate review files
agentranks review

# Apply edits from review.json back to agentranks.facts.json
agentranks review --apply

# Shortcuts
agentranks review --approve-low-risk      # promote extracted+low-risk+core/supporting → approved
agentranks review --reject-needs-review   # bulk-reject all needs_review facts
```

**Options:**
| Flag | Description |
|------|-------------|
| `--apply` | Read `agentranks/review.json` and write status changes to `agentranks.facts.json` |
| `--approve-low-risk` | Auto-approve extracted facts with `riskLevel: low` and `publishPriority: core` or `supporting` |
| `--reject-needs-review` | Set all `needs_review` facts to `rejected` |

**Requires:** `agentranks.facts.json`

**Creates (default mode):**
- `agentranks/review.json` — full facts array, edit `status` fields to approve/reject
- `agentranks/review.md` — grouped Markdown review (needs_review → extracted → approved → rejected)

**Review workflow:**
1. Run `agentranks review` to generate review files
2. Open `agentranks/review.md` to read the review and understand what the LLM extracted
3. Edit `agentranks/review.json` — change `status` to `approved`, `rejected`, or leave as-is
4. Run `agentranks review --apply` to write changes back to `agentranks.facts.json`
5. Run `agentranks generate`

**Shortcut workflow (no manual editing):**
```bash
agentranks review --approve-low-risk     # approve safe facts automatically
agentranks review --reject-needs-review  # reject risky claims you don't want published
agentranks generate
```

**Status model:**
| Status | Meaning | Published by default? |
|--------|---------|----------------------|
| `extracted` | LLM found it, not yet reviewed | Yes (low-risk only) |
| `approved` | Manually approved | Yes |
| `needs_review` | Risky/uncertain — requires human decision | No |
| `rejected` | Rejected by user | Never |

---

### `agentranks score`

Score your business's AI-readiness from extracted facts. Fully deterministic — no LLM required.

```bash
agentranks score
agentranks score --dry-run   # print report without writing files
```

**Options:**
| Flag | Description |
|------|-------------|
| `--dry-run` | Print the score report to terminal only, skip writing `agentranks/score.json` / `agentranks/score.md` |

**Requires:** `agentranks.facts.json`, `agentranks/config.json`

**Creates:**
- `agentranks/score.json` — full structured score report
- `agentranks/score.md` — human-friendly Markdown score report

**Score categories (each 0–10):**

| # | Category | What it measures |
|---|----------|-----------------|
| 1 | Company Profile | Publishable `company_profile` facts |
| 2 | Service/Product Clarity | Publishable `service` + `product` facts |
| 3 | Pricing Clarity | Publishable `pricing` facts |
| 4 | FAQ Coverage | Publishable `faq` facts (complete Q+A only) |
| 5 | Policy Clarity | Publishable `policy` + `limitation` facts |
| 6 | Use-Case Coverage | Publishable `use_case` facts |
| 7 | Differentiator Quality | Publishable `differentiator` facts (penalized for vague language) |
| 8 | Evidence Quality | % of facts with 30+ char `evidenceText` (penalized for numeric mismatches) |
| 9 | Risk/Review Burden | Ratio of `needs_review` + high-risk facts (lower = better) |
| 10 | AI Output Readiness | Publishable count + category spread (penalized for missing pricing/service or excess low-priority facts) |

**Overall score:** average of all 10 category scores × 10 (0–100), rounded to nearest integer.

**Publishable fact definition:**
- `status === "approved"` **OR**
- `status === "extracted"` AND `riskLevel === "low"` AND `publishPriority` is `core` or `supporting`

**Section health levels:**
| Status | Meaning |
|--------|---------|
| ✅ Healthy | Meets publishable count threshold |
| ⚠ Weak | Publishable facts exist but below threshold, low confidence, or >40% needs_review |
| 🔒 Not publishable | Facts exist but none are publishable |
| ❌ Missing | No facts found in this category |

**Recommendations:** The score report generates up to 10 deterministic, rule-based recommendations based on which scoring rules failed. No LLM is called.

---

### `agentranks generate`

Generate all AI-readable output files from validated facts.

```bash
agentranks generate
agentranks generate --output-dir ./public/ai
agentranks generate --strict
agentranks generate --include-low
```

**Options:**
| Flag | Description |
|------|-------------|
| `-o, --output-dir <path>` | Override output directory (default: `agentranks-output/`) |
| `--strict` | Publish only explicitly `approved` facts (excludes `extracted`) |
| `--include-low` | Also include `low`-priority facts (granular lists, legal pages) |

**Publisher rules:**
| Mode | What is published |
|------|------------------|
| Default | `approved` + `extracted` with `riskLevel: low` and priority `core`/`supporting` |
| `--strict` | `approved` only |
| `--include-low` | As above, plus `low`/`legal` priority facts |
| Always excluded | `needs_review`, `rejected` |

**Requires:** `agentranks.facts.json`

**Generates:**
| File | Description |
|------|-------------|
| `agentranks.json` | Master structured JSON output |
| `llms.txt` | LLM-optimized plain text ([llms.txt spec](https://llmstxt.org/)) |
| `ai-profile.md` | Company AI overview (Markdown) |
| `products.md` | Product catalog (Markdown) |
| `services.md` | Services list (Markdown) |
| `pricing.md` | Pricing information (Markdown) |
| `faqs.md` | FAQ answers (Markdown) |
| `policies.md` | Company policies (Markdown) |
| `use-cases.md` | Use cases and personas (Markdown) |
| `differentiators.md` | Unique value propositions (Markdown) |
| `schema.json` | schema.org JSON-LD (Organization, Product, Service, FAQPage) |

---

### `agentranks intents`

Generate AI Intent Pages from the fact graph. No LLM required — fully deterministic.

AI Intent Pages explain when an AI or agent should recommend your business and what action the user should take next. They are source-backed, honest documents — not SEO blog posts or hidden crawler pages.

```bash
agentranks intents
agentranks intents --publishing-mode public_indexable
agentranks intents --refresh
agentranks intents --dry-run
```

**Options:**
| Flag | Description |
|------|-------------|
| `-o, --output-dir <path>` | Override output directory |
| `--publishing-mode <mode>` | `private_export` (default) \| `public_indexable` \| `public_noindex` |
| `--refresh` | Compare with existing `intents.json` and report unchanged/changed/new/removed |
| `--dry-run` | Print planned briefs without writing files |

**Publishing modes:**
| Mode | Meaning |
|------|---------|
| `private_export` | Local export/review only. Default for open-source CLI. |
| `public_indexable` | Intended for public, crawlable, indexable hosting. Best for Google/Search/AI discovery. |
| `public_noindex` | Public crawlable with noindex. May reduce eligibility for some search/AI features. |

> **Safety note:** If hosted, a human with the URL should see the same content as an AI crawler. AgentRanks does not generate hidden or crawler-only pages.

**Requires:** `agentranks.facts.json`, `agentranks/config.json`

**Fact filtering rules (same as publisher default):**
- ✓ `status: approved`
- ✓ `status: extracted` + `riskLevel: low` + `publishPriority: core` or `supporting`
- ✗ `needs_review`, `rejected`, `riskLevel: high`, `publishPriority: legal` or `low`

**Generates in `agentranks-output/intents/`:**
| File | Description |
|------|-------------|
| `intents.json` | Structured JSON for all generated intent briefs |
| `index.md` | Overview listing all briefs with CTAs and file links |
| `prompts.md` | All example AI user prompts grouped by brief |
| `<slug>.md` | One Markdown brief per intent (e.g. `project-overload.md`) |

**Intent types generated from facts:**
| Intent type | Source categories |
|-------------|------------------|
| `use_case` | `use_case` facts |
| `service_need` | `service`, `product` facts |
| `budget_or_pricing` | `pricing` facts |
| `comparison` | `differentiator` facts |
| `local` | `location` facts |

**Each brief includes:**
- User situations (when this brief applies)
- Why this business is relevant (from fact claims)
- Best-fit facts (claim, source URL, evidence text)
- Buyer action (factual CTA with inferred action type)
- Example AI user prompts (deterministic templates)
- Publishing mode note

**CTA inference (no invented URLs):**
| Signal in facts | CTA action type |
|-----------------|----------------|
| "trial", "free", "no credit card" in claims | `start_trial` |
| Pricing-intent brief or "pricing"/"price" in claims | `view_pricing` |
| "consultation", "demo", "book", "schedule" in claims | `book_call` |
| Default | `visit_website` |

**CTA `audience` values:** `buyer` | `merchant` | `developer` | `agent`

**`intents.json` brief fields:**
```
id, slug, title, intentType, sourceFactIds, sourceCategories,
userSituations, whyRelevant, bestFitFacts, buyerAction, cta,
promptExamples, publishingMode, outputPath, lastGeneratedAt, contentHash,
sourceType, sourcePrompt?, matchScore?
```

`sourceType` is `"auto"` for fact-graph briefs, `"prompts_file"` for prompt-based briefs.

---

#### `agentranks intents --prompts-file`

Generate intent briefs from user-supplied prompts. No LLM required — matching is deterministic.

```bash
agentranks intents --prompts-file prompts.txt
agentranks intents --prompts-file prompts.txt --publishing-mode public_indexable
agentranks intents --prompts-file prompts.txt --dry-run
```

**Prompts file format (plain `.txt`, one prompt per line):**
```
# Comment lines are ignored
I need customer success help but I'm not ready to hire full-time.
What are alternatives to a full-time CSM?
How can I test a CSM before committing?
```

**Behavior:**
- Empty lines and lines starting with `#` are ignored.
- For each prompt, publishable facts are scored by token overlap + category boost.
- Prompts that score above the minimum threshold generate a `pf-*` intent brief.
- Prompts with no matching publishable facts are skipped and reported — they are never force-fit.
- Auto-generated and prompt-file briefs are merged into the same `intents.json` / `prompts.md` / `index.md`.
- Each prompt-file brief includes a `## User prompt this answers` section in its Markdown.

**Publishable fact rules** (same as auto intents):
- ✓ `status: approved`
- ✓ `status: extracted` + `riskLevel: low` + `publishPriority: core` or `supporting`
- ✗ `needs_review`, `rejected`, `riskLevel: high`, `publishPriority: legal` or `low`

**Category boosts applied when matching:**

| Prompt mentions | Boosts facts in |
|----------------|-----------------|
| price, cost, budget, trial, free, contract | `pricing`, `differentiator` |
| hire, full-time, staffing, employee | `differentiator`, `service` |
| customer success, CSM, onboarding, retention | `service`, `use_case` |
| engineering, devops, software, API, cloud | `service` |
| design, marketing, content, SEO | `service` |

---

### `agentranks deploy`

Build a static website-ready output folder from `agentranks-output/`.

```bash
agentranks deploy
agentranks deploy --base-url https://yourcompany.com
agentranks deploy --target public
agentranks deploy --dry-run
agentranks deploy --clean
agentranks deploy --force
agentranks deploy --include-noindex
```

**Options:**
| Flag | Description |
|------|-------------|
| `--target <dir>` | Override deploy target directory. Default: `agentranks-public` |
| `--base-url <url>` | Override the base URL from `agentranks/config.json` |
| `--include-noindex` | Add `noindex` meta tag for `public_noindex` intent pages |
| `--dry-run` | Print the planned output without writing any files |
| `--clean` | Remove previously AgentRanks-generated paths before writing (safe — does not touch unrelated files) |
| `--force` | Allow deploying intent briefs with `publishingMode: "private_export"` |

**Requires:** `agentranks-output/` (run `agentranks generate` and `agentranks intents` first)

**Reads from `agentranks-output/`:**
- `agentranks.json`, `llms.txt`, `schema.json` — direct copies
- `ai-profile.md`, `services.md`, `products.md`, `pricing.md`, `faqs.md`, `policies.md`, `use-cases.md`, `differentiators.md` — converted to HTML
- `intents/index.md`, `intents/prompts.md`, `intents/<slug>.md` — converted to HTML intent pages

**Writes to `agentranks-public/` (by default):**
| Output path | Source |
|-------------|--------|
| `llms.txt` | Direct copy |
| `agentranks.json` | Direct copy |
| `schema.json` | Direct copy |
| `ai-profile/index.html` | `ai-profile.md` → HTML |
| `services/index.html` | `services.md` → HTML |
| `products/index.html` | `products.md` → HTML |
| `pricing/index.html` | `pricing.md` → HTML |
| `faqs/index.html` | `faqs.md` → HTML |
| `policies/index.html` | `policies.md` → HTML |
| `use-cases/index.html` | `use-cases.md` → HTML |
| `differentiators/index.html` | `differentiators.md` → HTML |
| `ai/intents/index.html` | `intents/index.md` → HTML |
| `ai/intents/prompts/index.html` | `intents/prompts.md` → HTML |
| `ai/intents/<slug>/index.html` | `intents/<slug>.md` → HTML |
| `ai/sitemap.xml` | Auto-generated from all deployed URLs |

**Also writes to `agentranks/deploy/`:**
| File | Description |
|------|-------------|
| `submit-urls.txt` | One public URL per line — paste into indexing tools or `agentranks submit` |
| `robots-suggested.txt` | Suggested `robots.txt` block to merge into your site |
| `deploy-report.md` | Human-readable deploy summary with next steps |
| `deploy.json` | Machine-readable manifest (used by `agentranks submit`) |

**HTML page `<head>` includes:**
- `charset`, `viewport` meta
- `<title>` from first H1 in the Markdown
- Canonical URL matching the sitemap URL exactly
- `robots` meta: `index, follow` for `public_indexable`; `noindex, follow` for `public_noindex` when `--include-noindex` is used
- Generator meta with timestamp
- schema.org JSON-LD (`<script type="application/ld+json">`) inlined in: `ai-profile/`, `services/`, `pricing/`, `faqs/`
- Minimal inline CSS (no external dependencies)

**URL format:**
All deployed HTML pages use trailing-slash URLs:
- `https://yourcompany.com/ai-profile/`
- `https://yourcompany.com/ai/intents/skill-gaps/`
- etc.

**Safety rules:**
- Does **not** call an LLM
- Does **not** submit to Google automatically
- Does **not** modify your existing `robots.txt` or `sitemap.xml`
- `--clean` only removes AgentRanks-generated paths — never unrelated files in the target directory
- If intent briefs have `publishingMode: "private_export"`, deploy is blocked unless `--force` is passed
  - To fix: rerun `agentranks intents --publishing-mode public_indexable` or use `--force`
- Humans and crawlers see the same content (no cloaking)
- Indexing is not instant — Google typically crawls new pages within days to weeks

**Why Google Search Console submission is still manual:**
Automated sitemap submission requires OAuth authentication and project-specific credentials. `agentranks deploy` generates everything you need — you just paste the sitemap URL into Search Console once. Use `agentranks submit --indexnow` for IndexNow submission.

> **Note:** Google Search Console API automation and scheduled/recurring submission are **not** implemented in open-source v1. These are planned for a future Cloud version.

---

### `agentranks submit`

Submit deployed URLs to search engines. Only IndexNow is supported in v1.

```bash
agentranks submit --indexnow
agentranks submit --indexnow --key <your-key>
agentranks submit --indexnow --key-file /path/to/key.txt
agentranks submit --indexnow --dry-run
```

**Options:**
| Flag | Description |
|------|-------------|
| `--indexnow` | Submit URLs via IndexNow protocol |
| `--key <key>` | IndexNow API key (use this to avoid auto-generating) |
| `--key-file <path>` | Read IndexNow key from a file |
| `--host <host>` | Override hostname (default: derived from `config.baseUrl`) |
| `--dry-run` | Print the IndexNow payload without making network calls |
| `--endpoint <url>` | Override IndexNow endpoint (useful for testing) |

**Key handling:**
- If `--key` is provided, it is used directly.
- If `--key-file` is provided, the key is read from that file.
- If neither is provided, a key is auto-generated and written to `agentranks/submit/indexnow-key.txt`.
  A file named `agentranks/submit/<key>.txt` is also written — upload this to `https://<host>/<key>.txt` for IndexNow verification.

**URL source (in priority order):**
1. `agentranks/deploy/deploy.json` → `publicUrls`
2. `agentranks/deploy/submit-urls.txt`

**Writes to `agentranks/submit/`:**
| File | Description |
|------|-------------|
| `indexnow-key.txt` | The key used (written when key is auto-generated) |
| `<key>.txt` | Key file to upload to your site root for verification |
| `indexnow-report.json` | Machine-readable submission report |
| `indexnow-report.md` | Human-readable submission report |

**Not implemented in v1:**
- Google Search Console API submission
- Scheduled / recurring submission
- Dashboard

---

### `agentranks quickstart`

Chain the full pipeline in one command.

```bash
agentranks quickstart https://example.com
agentranks quickstart https://example.com --publishing-mode public_indexable
agentranks quickstart https://example.com --approve-low-risk --base-url https://example.com
agentranks quickstart --dry-run
```

**Default flow:**
1. init (create config if not exists)
2. scan
3. extract
4. validate
5. score
6. generate
7. intents
8. deploy

**Submit is not run automatically.** Use `agentranks submit --indexnow` when ready.

**Options:**
| Flag | Description |
|------|-------------|
| `[url]` | URL to scan (used to create config if none exists) |
| `-m, --max-pages <n>` | Max pages to crawl |
| `-d, --delay <ms>` | Crawl delay in ms |
| `--approve-low-risk` | Run `review --approve-low-risk` before generate |
| `--publishing-mode <mode>` | Publishing mode for intents (default: `private_export`) |
| `--base-url <url>` | Override base URL for deploy |
| `--target <dir>` | Override deploy target directory |
| `--skip-review` | Skip the review step entirely |
| `--skip-score` | Skip the score step |
| `--skip-intents` | Skip the intents step |
| `--skip-deploy` | Skip the deploy step |
| `--prompts-file <path>` | Pass a prompts file to the intents step |
| `--dry-run` | Print planned steps without running them |

---

## Recommended Workflows

### Quickstart (one command)

```bash
agentranks quickstart https://www.example.com \
  --publishing-mode public_indexable \
  --base-url https://www.example.com \
  --approve-low-risk
```

### Granular workflow

```bash
# 1. Set up environment
cp .env.example .env
# Edit .env and set AGENTRANKS_LLM_API_KEY

# 2. Initialize project
agentranks init
# → Enter: https://acme.com, "Acme Inc", etc.
# → .gitignore is automatically updated

# 3. Crawl the website
agentranks scan https://acme.com

# 4. Extract facts with LLM
agentranks extract
# → Creates agentranks.facts.json
# → Creates agentranks/content-gaps.json (unanswered FAQ questions)

# 5. Validate results
agentranks validate

# 6. Score AI-readiness (no LLM required)
agentranks score
# → See agentranks/score.md for category breakdown and recommendations

# 7. Review extracted facts (human curation step)
agentranks review
# → Opens agentranks/review.md for reading
# → Edit agentranks/review.json to approve/reject facts

agentranks review --apply
# → Writes review decisions back to agentranks.facts.json

# Shortcut: auto-approve safe facts, reject risky ones
# agentranks review --approve-low-risk

# 8. Generate AI-readable files
agentranks generate

# 9. Generate AI Intent Pages
agentranks intents --publishing-mode public_indexable
# → agentranks-output/intents/index.md
# → agentranks-output/intents/prompts.md
# → agentranks-output/intents/intents.json
# → agentranks-output/intents/<slug>.md (one per brief)

# Prompt-targeted intents (optional):
# agentranks intents --prompts-file prompts.txt --publishing-mode public_indexable

# 10. Deploy to a static website
agentranks deploy --base-url https://www.example.com
# → agentranks-public/  (copy this to your web server / CDN)
# → agentranks/deploy/deploy-report.md   (next steps)
# → agentranks/deploy/robots-suggested.txt  (merge into your robots.txt)
# → agentranks/deploy/submit-urls.txt    (URL list for indexing)

# 11. Submit to IndexNow (dry run first)
agentranks submit --indexnow --dry-run
agentranks submit --indexnow --key <your-key>
# → agentranks/submit/indexnow-report.md

# Note: Google Search Console submission is manual —
# paste the sitemap URL at https://search.google.com/search-console
```

## Debugging

Set `DEBUG=1` for full stack traces on errors:

```bash
DEBUG=1 agentranks extract
```
