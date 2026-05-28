# HTTP API and SSE

Base URL: `http://{host}:{port}` (default `http://127.0.0.1:4317`)

All requests and responses use JSON content type.

## Health

```bash
curl http://127.0.0.1:4317/health
```

Response:

```json
{ "status": "ok" }
```

## Start a Run

```bash
curl -X POST http://127.0.0.1:4317/runs \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "opencode",
    "prompt": "Add a README to the project",
    "permissionMode": "normal"
  }'
```

Provider-specific convenience endpoints:

```bash
curl -X POST http://127.0.0.1:4317/runs/opencode \
  -H "Content-Type: application/json" \
  -d '{"prompt": "List all files"}'
```

## Per-Run SSE

```bash
curl -N http://127.0.0.1:4317/runs/:runId/events
```

Streams events for a single run. Replays buffered events on connect, then streams live events. Heartbeat every 15s.

## Global SSE

```bash
curl -N http://127.0.0.1:4317/events
```

Streams events for **all** runs. Same replay-then-live behavior as per-run SSE.

### SSE Frame Format

```
id: <eventId>
event: <daemonEventType>
data: <json>
```

## Provider Action

Execute a provider-scoped SDK action:

```bash
curl -X POST http://127.0.0.1:4317/providers/opencode/actions \
  -H "Content-Type: application/json" \
  -d '{"actionId": "config.providers", "input": {}}'
```

## Run Action

Execute a run-scoped SDK action:

```bash
curl -X POST http://127.0.0.1:4317/runs/:runId/actions \
  -H "Content-Type: application/json" \
  -d '{"actionId": "session.list", "input": {}}'
```

## Permission Resolution

```bash
curl -X POST http://127.0.0.1:4317/runs/:runId/permissions/:permissionId \
  -H "Content-Type: application/json" \
  -d '{
    "decision": "allow",
    "scope": "once"
  }'
```

Decisions: `allow`, `deny`. Scopes: `once`, `always`, `until_reply`.

## Cancel

```bash
curl -X POST http://127.0.0.1:4317/runs/:runId/cancel
```

## List All Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/providers` | List providers with auth status |
| GET | `/providers/:provider/actions` | List SDK actions for a provider |
| POST | `/providers/:provider/actions` | Execute a provider-level action |
| POST | `/runs` | Start a run |
| POST | `/runs/:provider` | Start a run (provider shorthand) |
| GET | `/runs` | List all runs |
| GET | `/runs/:runId` | Get run details |
| GET | `/runs/:runId/events` | Per-run SSE stream |
| GET | `/events` | Global SSE stream |
| POST | `/runs/:runId/cancel` | Cancel a run |
| POST | `/runs/:runId/permissions/:permissionId` | Resolve a permission request |
| POST | `/runs/:runId/resume` | Resume a run |
| POST | `/runs/:runId/actions` | Execute a run-scoped action |
