# Security Policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| 0.2.x   | Yes       |
| < 0.2   | No        |

## Reporting a vulnerability

If you discover a security issue in AgentRanks Core, please report it responsibly.

**Do not** open a public GitHub issue for security vulnerabilities.

Instead, email **security@agentranks.io** with:

- A description of the issue
- Steps to reproduce
- Impact assessment (if known)
- Your contact information

We aim to acknowledge reports within 3 business days.

## Scope

This policy covers the open-source AgentRanks Core CLI and workspace packages in this repository. It does not cover AgentRanks Cloud or third-party services (LLM providers, hosting, IndexNow endpoints).

## Security practices for users

- Keep `.env` and API keys out of version control
- Do not commit `.agentranks/`, `agentranks-output/`, `agentranks-public/`, or IndexNow key files
- Review extracted facts before publishing (`agentranks review`)
- Host IndexNow key files only at the paths you intend to submit
