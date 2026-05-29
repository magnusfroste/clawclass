# ClawClass

> **Open-source Docker stack for multi-tenant OpenClaw hosting.** We're building the definitive infrastructure layer for running OpenClaw agents at scale — and we need your help to make it great.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Issues](https://img.shields.io/github/issues/magnusfroste/clawstack)](https://github.com/magnusfroste/clawstack/issues)
[![Discussions](https://img.shields.io/badge/Discussions-welcome-blue)](https://github.com/magnusfroste/clawstack/discussions)
[![Contributions welcome](https://img.shields.io/badge/contributions-welcome-brightgreen)](#contributing)

<p align="center">
  <img src="docs/clawstack-architecture.png" alt="ClawClass Architecture" width="100%" />
</p>

The internet was the first acceleration. Generative AI was the second. Agentic autonomy is the third.

[OpenClaw](https://openclaw.dev) puts a persistent, tool-using AI agent in the hands of anyone — browsing the web, writing code, managing files, and acting on your behalf around the clock. ClawClass is the missing infrastructure layer above it.

**Today**, ClawClass hosts a swarm of OpenClaw instances on your own hardware — each with its own domain, HTTPS, and full isolation, plus role presets and A2A peering so a swarm is as easy to launch as a single agent. One server, unlimited agents.

**Vision**: ClawClass becomes the **agent simulation and testing platform**. Spawn populations of OpenClaw personas — a visitor, an accountant, a salesperson, a support lead — point them at a SaaS, let them act for hours or days, and let a senior operator-agent observe what emerges. The deliverable is an *Emergent Findings Report*: cross-module risks, UX gaps, broken chains that no human tester would have produced, surfaced by agents observing agents. OpenClaw's persona depth (SOUL + HEARTBEAT + memory) makes it the only framework today that does this convincingly. ClawClass is the substrate that makes it shippable.

The hosting product and the simulation product share the same multi-OpenClaw substrate. Different UIs and contracts on top.

---

**This project is open source and community-driven.** If you run OpenClaw on a VPS, in production, or at scale — your experience matters. We want ClawClass to become *the* Docker stack that the OpenClaw community relies on. That means we need your feedback, bug reports, feature ideas, and code contributions. See [Contributing](#contributing) below.

## The problem

Getting an OpenClaw agent running is the easy part. Getting one that actually does something useful is hard.

OpenClaw ships as a blank slate. After the container starts, you face a collection of markdown files — `SOUL.md`, `IDENTITY.md`, `TOOLS.md`, `BOOTSTRAP.md` — with no clear starting point and no explanation of how they relate to each other. The technical setup (API keys, providers, gateway tokens) is undocumented. The persona setup (who the agent is, what it does) is buried in a conversational onboarding flow that assumes the technical setup is already done. Most people give up before the agent does anything meaningful.

Beyond the single-agent problem: running multiple agents that collaborate requires manually configuring A2A tokens, peer lists, and Agent Cards for each instance. There is no tooling for it.

## What ClawClass does

ClawClass removes both barriers.

**The infrastructure barrier** — domains, HTTPS, container lifecycle, API key management — is handled automatically. Fill in a form, click Create, done. Each agent gets its own domain with automatic TLS, isolated from every other instance on the same server.

**The configuration barrier** — role presets. Pick a role (QA agent, SEO agent, dev agent, support agent, research agent, FlowWink operator) and the instance boots with the right system prompt, tools, and A2A skills already in place. No markdown archaeology required.

**The swarm barrier** — A2A is built into the proxy layer. Every A2A-enabled instance is immediately reachable and discoverable over HTTPS. Swarm templates will wire multiple agents together with pre-configured peering, so a team of collaborating agents is as easy to spin up as a single one.

Under the hood, ClawClass runs a smart reverse proxy (Caddy) that makes custom domains trivially easy. Each agent gets its own domain or subdomain — `ai.yourclient.com`, `jarvis.yourcompany.com`, whatever you like. Just point a CNAME at your ClawClass server and the proxy handles the rest: TLS certificates are issued automatically on first request, no configuration needed. No wildcard certs, no manual cert management, no nginx reloads.

And because ClawClass pulls directly from the official OpenClaw image, you're always running the latest release — not a snapshot baked into a platform template two months ago. EasyPanel, Fly.io, Railway and friends are great, but their OpenClaw integrations lag behind. ClawClass is effectively a local installation with multi-container tenancy: full control, zero platform lag.

## Prerequisites

On a fresh VPS:

**1. Install Docker**
```bash
curl -fsSL https://get.docker.com | sh
```

**2. Point DNS to your VPS**
```
clawstack.yourdomain.com   A  →  your-vps-ip
*.yourdomain.com           A  →  your-vps-ip   (optional, for subdomains)
```
Customers point their own domains via CNAME:
```
ai.customer.com  CNAME  clawstack.yourdomain.com
```

**3. Open ports 80 and 443**

## Setup

```bash
git clone https://github.com/magnusfroste/clawstack.git
cd clawstack
cp .env.example .env
# Edit .env — set BASE_DOMAIN, CADDY_EMAIL, ADMIN_PASS
docker compose up -d
```

Open `https://clawstack.yourdomain.com` and log in.

> **Note:** Instance data is stored in `./instances/` on the system disk by default. For larger deployments or to use a separate volume, see [docs/STORAGE.md](docs/STORAGE.md).

## Adding an OpenClaw instance

1. Enter a name and the customer's domain
2. Click **Create**
3. Customer adds DNS: `ai.customer.com CNAME clawstack.yourdomain.com`
4. ClawClass starts the container, HTTPS provisions automatically on first visit

## How it works

```
Customer visits https://ai.customer.com
        ↓
Caddy (on-demand TLS — cert issued on first request)
        ↓
ClawClass portal (routes by hostname → container)
        ↓
OpenClaw container (internal Docker network)
```

## Agent roles

OpenClaw is a powerful but horizontal tool — it does not arrive with a purpose. ClawClass ships opinionated **role presets** that configure each instance for a specific job from the start. Pick a role at creation time and the instance boots ready to work.

| Role | What it does | Heartbeat |
|------|-------------|-----------|
| `generalist` | Blank slate — full control | — |
| `qa` | Audits URLs, forms, and accessibility | 12h |
| `seo` | SEO audits, keyword analysis, content gaps | 24h |
| `dev` | Code review, documentation, security scanning | — |
| `support` | Customer-facing help and escalation | 2h |
| `research` | Web research, analysis, synthesis | — |
| `flowwink` | Autonomous FlowWink SaaS operator | 4h |

### Autonomous operators

The `flowwink` role goes beyond reactive assistance — it runs a SaaS instance on autopilot. Connect it to a FlowWink installation via MCP, set the API key, and it wakes up every 4 hours to audit the pipeline, catch stuck orders, flag compliance issues, and report findings. No human in the loop unless something critical surfaces.

See [docs/AUTONOMOUS-OPERATORS.md](docs/AUTONOMOUS-OPERATORS.md) for the full architecture, heartbeat mechanics, and how to build an operator for any MCP-capable SaaS.

## A2A — Agent-to-Agent communication (ClawSwarm)

Each instance can optionally run the [OpenClaw A2A gateway plugin](https://github.com/win4r/openclaw-a2a-gateway). Enable it via the **Enable A2A** checkbox when creating an instance.

When A2A is enabled, ClawClass automatically:
- Starts the A2A gateway on internal port **18800**
- Routes `/a2a/*` and `/.well-known/agent.json` to that port (other traffic stays on 18789)
- Publishes an **Agent Card** at `https://your-instance-domain/.well-known/agent.json` so peers can discover the agent's capabilities

This means every A2A-enabled Claw in your swarm is immediately reachable and discoverable over HTTPS — no extra proxy config needed.

### Communication model

ClawClass follows a **caller-defines-the-contract** model, inspired by how tools like Claude Code, Kilo, Roo, and Cline request strict structured output from LLMs:

> The sender specifies what it wants and in what format. The receiver either delivers — or declines.

In practice this looks like an RFQ (Request for Quote):
- *"Can you deliver 1000 branded flashlights in 2 weeks? If yes, respond with `{ price, currency, lead_days }`."*
- The peer replies in the requested format, or responds that it cannot fulfill the request.

This maps directly to A2A's design: the caller's message carries the intent and an optional `responseSchema`. The receiving agent tries to comply within its capabilities. No prior contract negotiation required — just discovery via Agent Card and a well-formed request.

For a full discussion of the communication model, the Postel's Law principle, and the open debate around structured contracts in multi-agent systems, see [docs/A2A-COMMUNICATION-MODEL.md](docs/A2A-COMMUNICATION-MODEL.md).

In practice, two channels are available — OpenResponses (`POST /v1/responses`) for top-down task delegation and A2A for peer-to-peer collaboration. See [docs/DUAL-CHANNEL.md](docs/DUAL-CHANNEL.md) for the decision guide.

For details on the OpenClaw A2A gateway plugin — what it supports, how it routes, and its current limitations — see [docs/A2A-PLUGIN.md](docs/A2A-PLUGIN.md).

### Reference implementation

[FlowWink / FlowPilot](https://github.com/magnusfroste/flowwink) is the reference A2A peer used during development of ClawClass's A2A infrastructure. It implements the full dual-mode model (structured skill execution + conversational chat) and serves as a benchmark for what a well-behaved A2A peer looks like.

## Tech stack

- **Caddy** — reverse proxy, automatic HTTPS via Let's Encrypt
- **ClawClass portal** — Node.js, SQLite, Dockerode
- **OpenClaw** — official image from ghcr.io/openclaw/openclaw
- **OpenClaw A2A gateway** — optional plugin for agent-to-agent communication

## Contributing

ClawClass is open source and we want it to become **the definitive Docker stack for OpenClaw** — the one that the community builds, maintains, and trusts. Whether you run a single agent on a $5 VPS or manage a fleet of dozens, your experience is valuable.

### Ways to contribute

- **Report bugs** — Found something broken? [Open an issue](https://github.com/magnusfroste/clawstack/issues) with details about your setup and what happened.
- **Request features** — Have an idea for a role preset, swarm template, or portal improvement? [Start a discussion](https://github.com/magnusfroste/clawstack/discussions) or open an issue.
- **Improve docs** — Documentation is never done. Typos, missing steps, unclear explanations — all welcome fixes.
- **Add role presets** — Built a useful agent configuration? Contribute it as a preset so others can use it.
- **Share swarm templates** — Composed a working multi-agent setup? We'd love to include it.
- **Test on different environments** — Different VPS providers, OS versions, Docker configurations — the more testing, the more robust ClawClass becomes.

### How to contribute

1. **Fork** the repository
2. **Create a branch** for your change
3. **Make your changes** — code, docs, or config
4. **Test** locally with `docker compose up -d`
5. **Open a pull request** — describe what you changed and why

No contribution is too small. A typo fix in docs is as valuable as a new feature.

### Good first issues

Look for the [`good first issue`](https://github.com/magnusfroste/clawstack/labels/good%20first%20issue) label for beginner-friendly tasks to get started with.

### License

By contributing to ClawClass, you agree that your contributions will be licensed under the MIT License.

## License

MIT
