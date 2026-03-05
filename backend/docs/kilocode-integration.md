# Kilocode Extension Integration

## Kilo Provider UI Setup (OpenAI Compatible)

Use this when configuring the Kilo Code extension Providers screen:

1. `API Provider` → `OpenAI Compatible`
2. `Base URL` → `http://localhost:5000/api/v1/openai-compatible/v1`
3. `API Key` → same value as backend `KILOCODE_API_KEY`
4. `Model` → `aidlc-pm-agent`

Optional project routing:
- Set backend env `KILOCODE_DEFAULT_PROJECT_ID=<your-mongodb-project-id>` for default project mapping.
- Or use model format `aidlc-pm-agent:<projectId>` to route to a specific project.

The OpenAI-compatible adapter endpoints are:
- `GET /models`
- `POST /chat/completions`

## Base
- Base URL: `/api/v1/kilocode`
- Auth header: `x-kilocode-key: <KILOCODE_API_KEY>`
  - Alternative: `Authorization: Bearer <KILOCODE_API_KEY>`

For Kilo OpenAI Compatible provider, auth uses `Authorization: Bearer <KILOCODE_API_KEY>`.

## 1) Health
`GET /health`

Response:
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "service": "kilocode-agent-bridge",
    "contractVersion": "2026-03-02"
  }
}
```

## 2) Capabilities
`GET /capabilities`

Response:
```json
{
  "success": true,
  "data": {
    "contractVersion": "2026-03-02",
    "endpoints": {
      "health": "/api/v1/kilocode/health",
      "capabilities": "/api/v1/kilocode/capabilities",
      "chat": "/api/v1/kilocode/agent/chat",
      "chatStream": "/api/v1/kilocode/agent/chat/stream"
    },
    "auth": {
      "type": "api-key",
      "headers": [
        "x-kilocode-key",
        "authorization: Bearer <key>"
      ]
    },
    "features": {
      "streaming": true,
      "streamingMode": "sse-chunked",
      "chatHistoryIncluded": true
    }
  }
}
```

## 3) Agent Chat
`POST /agent/chat`

Request body:
```json
{
  "projectId": "67c3718f46816fd2286f3f14",
  "message": "Create sprint plan for onboarding module",
  "sessionId": "67c3718f46816fd2286f3f15",
  "requestId": "req-123",
  "meta": {
    "client": "kilocode-vscode",
    "workspace": "aidlc-gh"
  }
}
```

Response body:
```json
{
  "success": true,
  "message": "Kilocode agent response generated",
  "data": {
    "contractVersion": "2026-03-02",
    "channel": "kilocode",
    "requestId": "req-123",
    "projectId": "67c3718f46816fd2286f3f14",
    "sessionId": "67c3718f46816fd2286f3f15",
    "reply": "# Sprint Plan...",
    "chats": [],
    "meta": {
      "source": "kilocode-extension",
      "timestamp": "2026-03-02T00:00:00.000Z",
      "client": "kilocode-vscode",
      "workspace": "aidlc-gh"
    }
  }
}
```

Validation errors return HTTP `400` with an `errors` array.

## 4) Agent Chat Stream (SSE)
`POST /agent/chat/stream`

Headers:
- `Accept: text/event-stream`
- `x-kilocode-key: <KILOCODE_API_KEY>`

Request body is the same as `POST /agent/chat`.

SSE events:
- `started` → handshake metadata
- `session` → resolved or created `sessionId`
- `token` → `{ chunk, index }` incremental text chunks
- `progress` → stream progress metadata
- `done` → final normalized payload (same shape as `/agent/chat` `data`)
- `error` → stream error payload

Example terminal test:
```bash
curl -N -X POST http://localhost:5000/api/v1/kilocode/agent/chat/stream \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -H "x-kilocode-key: your-strong-shared-secret" \
  -d '{
    "projectId": "67c3718f46816fd2286f3f14",
    "message": "Draft release checklist",
    "requestId": "req-stream-1"
  }'
```

