# Running the Daemon

## Prerequisites

- **Node.js >= 20.0.0**
- `npm` (ships with Node.js)

## Setup

```bash
npm install
```

Copy `.env.example` to `.env` and configure as needed:

```bash
cp .env.example .env
```

All environment variables are optional. The daemon starts without API keys.

## Development

```bash
npm run dev
```

Starts with `tsx watch` — automatically restarts on file changes.

Default host:port: `127.0.0.1:4317` (configurable via `DAEMON_HOST` and `DAEMON_PORT`).

## Production

```bash
npm run build
npm start
```

`build` compiles TypeScript to `dist/`. `start` runs `dist/main.js`.

## Tests

```bash
npm test
```

Runs all unit and integration tests via Vitest. No provider credentials required.

### Opt-in Smoke Tests

Real SDK smoke tests are skipped by default. Enable them:

```bash
RUN_REAL_SDK_TESTS=1 ANTHROPIC_API_KEY=... npm test
```

Required env vars per provider:

| Provider | Env var |
|----------|---------|
| Claude   | `ANTHROPIC_API_KEY` |
| Codex    | `OPENAI_API_KEY` or `CODEX_API_KEY` |
| OpenCode | `OPENCODE_DAEMON_REAL_TEST=1` |

## Authentication

The daemon is **CLI-auth-first**. Authenticate each provider through its own CLI before using the daemon:

```bash
claude                      # login/configure Claude Code
codex --login               # login/configure Codex CLI
opencode /connect           # connect OpenCode to providers
```

API keys are **optional fallback credentials**. They go in `.env` only when CLI auth is unavailable or when `authMode: "sdk"` is used.

See [providers.md](./providers.md) for auth mode behavior.
