<div align="center">

# orbit-agent-daemon

**Multi-provider AI agent orchestration over HTTP & SSE**

[![Node version](https://img.shields.io/badge/Node.js->=20-3c873a?style=flat-square)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-blue?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

[Overview](#overview) • [Features](#features) • [Installation](#installation) • [Usage](#usage) • [API](#api) • [Architecture](#architecture) • [Development](#development)

</div>

A standalone daemon that exposes **OpenCode**, **Claude Code**, and **Codex** AI agents over HTTP with real-time Server-Sent Events (SSE) streaming. It normalizes each provider's proprietary events into a unified model, handles interactive permissions, and exposes the full SDK surface of each provider through a strict action registry.

## Features

- **Multi-provider orchestration** — Unified HTTP interface for OpenCode, Claude Code, and Codex
- **Real-time SSE streaming** — Per-run and global event streams with replay buffer and heartbeat
- **Normalized event model** — 30+ event types mapped from all providers (messages, tools, files, permissions, usage, etc.)
- **Permission handling** — Interactive permission protocol (`normal` mode) or auto-accept (`yolo` mode)
- **72+ SDK actions** — Full enumerated action registry across all three providers, dispatchable via HTTP
- **CLI-first auth** — Auto-detects provider CLI installations; falls back to API keys when needed
- **Hexagonal architecture** — Clean domain/application/adapters separation with pure port interfaces

## Installation

```bash
npm install
```

## Usage

### Start the daemon

```bash
npm run dev
```

By default the daemon listens on `http://127.0.0.1:4317`. Configuration is done via environment variables (see [Configuration](#configuration)).

### Start an agent run

```bash
curl -X POST http://127.0.0.1:4317/runs \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "opencode",
    "prompt": "Explain this codebase",
    "mode": "yolo"
  }'
```

### Stream run events

```bash
curl -N http://127.0.0.1:4317/runs/<runId>/events
```

### List available providers

```bash
curl http://127.0.0.1:4317/providers
```

### Execute a provider action

```bash
curl -X POST http://127.0.0.1:4317/providers/opencode/actions \
  -H "Content-Type: application/json" \
  -d '{"action": "global.health"}'
```

## API

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/providers` | List providers with auth status |
| `GET` | `/providers/:provider/actions` | List SDK actions for a provider |
| `POST` | `/providers/:provider/actions` | Execute a provider-level action |
| `POST` | `/runs` | Start a run |
| `GET` | `/runs` | List all runs |
| `GET` | `/runs/:runId` | Get run details |
| `GET` | `/runs/:runId/events` | Per-run SSE stream |
| `GET` | `/events` | Global SSE stream |
| `POST` | `/runs/:runId/cancel` | Cancel a run |
| `POST` | `/runs/:runId/resume` | Resume a run |
| `POST` | `/runs/:runId/permissions/:permissionId` | Resolve a permission |
| `POST` | `/runs/:runId/actions` | Execute a run-scoped action |

Full documentation: [docs/daemon/http-and-sse.md](./docs/daemon/http-and-sse.md)

## Architecture

```
[HTTP Clients] <--> [Fastify Server] <--> [Application Services] <--> [Provider Adapters]
                                                                              |
                                                              [OpenCode SDK | Codex SDK | Claude SDK]
```

The daemon follows a strict **hexagonal architecture**:

- **`domain/`** — Pure types (events, runs, permissions, auth) with zero external imports
- **`ports/`** — Interface definitions (`AgentProvider`, `EventLogger`)
- **`application/`** — Orchestration services (event bus, execution, permissions, run registry)
- **`adapters/`** — Framework bindings (HTTP server, provider SDKs, logging)

SDK packages are imported only within `adapters/providers/`. The domain layer has no dependencies on any framework or SDK.

See [docs/daemon/2026-05-28-daemon-sdk-architecture.md](./docs/daemon/2026-05-28-daemon-sdk-architecture.md) for the full architecture document.

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `DAEMON_HOST` | `127.0.0.1` | HTTP bind address |
| `DAEMON_PORT` | `4317` | HTTP port |
| `DAEMON_LOG_LEVEL` | `info` | Logging verbosity |
| `DAEMON_EVENT_BUFFER_SIZE` | `1000` | In-memory event buffer |
| `ANTHROPIC_API_KEY` | — | Claude SDK auth (optional) |
| `OPENAI_API_KEY` | — | Codex SDK auth (optional) |

All provider keys are optional. CLI-based authentication is preferred when available.

## Development

```bash
npm run dev        # Start with hot-reload (tsx watch)
npm test           # Run unit + integration tests
npm run coverage   # Run with coverage
npm run build      # Compile to dist/
npm start          # Run compiled output
npm run verify     # Build + test + generate docs
```

### Project structure

```
src/
  domain/           # Pure domain types
  ports/            # Port interfaces
  application/      # Application services
  adapters/         # HTTP server, provider SDKs, logging
  infrastructure/   # Config, CLI, utilities
tests/
  unit/             # Unit tests (13 files)
  integration/      # Integration tests (2 files)
  smoke/            # Real SDK smoke tests (opt-in)
```

### Provider SDK coverage

| Provider | Actions |
|----------|---------|
| OpenCode | 42 (9 provider-level + 33 run-level) |
| Claude   | 25 (7 provider-level + 18 run-level) |
| Codex    | 5 (1 provider-level + 4 run-level) |

See [docs/daemon/sdk-coverage.md](./docs/daemon/sdk-coverage.md) for the full matrix.

## SDK action coverage

> [!TIP]
> Run `npm run docs:sdk-coverage` to regenerate the coverage matrix after adding new actions.
>
> Set `RUN_REAL_SDK_TESTS=1` with the required API keys to run smoke tests against real provider SDKs.
