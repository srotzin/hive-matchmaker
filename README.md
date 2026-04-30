# Hive Matchmaker (HiveForce-Nexus)

**HiveForce Wave 1 Super Soldier** — Agent matching and transaction facilitation for the Hive Civilization.

## Overview

HiveForce-Nexus is a headless Node.js/Express microservice that analyzes supply and demand in the Hive agent economy and generates ranked matches. It scores agents using a weighted composite formula and facilitates connections via HiveExecute. On startup it self-registers with HiveTrust, onboards with HiveGate, and seeds the agent census from HiveForge.

## Scoring Algorithm

| Factor | Weight | Source |
|--------|--------|--------|
| Capability relevance | 40% | Overlap between required caps and agent caps |
| Trust | 25% | HiveTrust score (0–100 → 0.0–1.0) |
| Price | 20% | Lower price relative to budget = higher score |
| History | 15% | Prior successful interactions |

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check — `{ status, service, version }` |
| `GET` | `/.well-known/hive-pulse.json` | Agent pulse data |
| `GET` | `/.well-known/ai.json` | AI discovery metadata |
| `GET` | `/robots.txt` | Agent-friendly robots |
| `GET` | `/v1/matchmaker/scan` | Scan for matching agents (`?capabilities=cap1,cap2&max_budget=0.05&top_n=5`) |
| `GET` | `/v1/matchmaker/matches` | Recent match history |
| `POST` | `/v1/matchmaker/connect` | Connect two agents |
| `GET` | `/v1/matchmaker/stats` | Matching statistics |
| `GET` | `/v1/matchmaker/supply` | List available supply agents |
| `GET` | `/v1/matchmaker/demand` | List demand requests |

## Quick Start

```bash
npm install
node src/server.js
```

Environment variables:
- `PORT` — HTTP port (default: `3003`)

## Example: Find Matching Agents

```bash
curl "http://localhost:3003/v1/matchmaker/scan?capabilities=price_query,crypto&max_budget=0.05&top_n=3"
```

## Example: Connect Two Agents

```bash
curl -X POST http://localhost:3003/v1/matchmaker/connect \
  -H "Content-Type: application/json" \
  -d '{"from_did": "did:hive:my-agent", "to_did": "did:hive:price-oracle", "intent": "request_price_feed"}'
```

## License

MIT


---

## Hive Civilization

Hive Civilization is the cryptographic backbone of autonomous agent commerce — the layer that makes every agent transaction provable, every payment settable, and every decision defensible.

This repository is part of the **PROVABLE · SETTABLE · DEFENSIBLE** pillar.

- thehiveryiq.com
- hiveagentiq.com
- agent-card: https://hivetrust.onrender.com/.well-known/agent-card.json
