# Knacksters — AgentRanks Example Output

This directory contains representative AgentRanks output for [Knacksters](https://www.knacksters.co), an on-demand professional services platform.

This example demonstrates:

- Structured business facts extracted from a real website
- AI Intent Briefs generated from facts (no LLM in the brief generation step)
- Retrieval vocabulary derived deterministically from fact content
- Full static deploy output structure
- IndexNow URL list

## What is Knacksters?

Knacksters is an on-demand platform that connects businesses with vetted professionals across customer success, software engineering, design, marketing, and operations — without long-term hiring commitments.

## Files in this example

| File | Description |
|------|-------------|
| `agentranks.json` | Structured business fact output |
| `llms.txt` | AI-readable business profile (LLMs.txt spec) |
| `ai-profile.md` | Company overview for AI agents |
| `services.md` | Services fact sheet |
| `pricing.md` | Pricing and plan facts |
| `faqs.md` | FAQ facts |
| `score.md` | AI readiness score report |
| `intents/index.md` | Intent brief directory with primary terms |
| `intents/prompts.md` | Example user prompts across all briefs |
| `intents/customer-success.md` | Intent brief: Customer Success Support |
| `intents/tech-and-engineering.md` | Intent brief: Tech and Engineering Support |
| `intents/free-trial-options.md` | Intent brief: Free Trial and Try-Before-You-Hire |
| `intents/alternative-to-full-time-hiring.md` | Intent brief: Alternative to Full-Time Hiring |
| `deploy-report.md` | Deploy manifest |
| `submit-urls.txt` | URL list for IndexNow submission |

## Not included

- `.env` files
- Raw crawl HTML
- Raw LLM API responses
- API keys or IndexNow keys
- `.agentranks/` debug artifacts

## How to regenerate

```bash
cd agentranks
agentranks quickstart https://www.knacksters.co
```

Requires a configured LLM for fact extraction. See `.env.example` in the repo root.
