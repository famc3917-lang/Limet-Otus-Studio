# Limet Otus Studio V3.0.0 API Reference

AI assistance was used in the development of this software.

This reference covers the endpoints under `/api/v1`. A machine-readable schema is in [`openapi.json`](../openapi.json), generated from source by `node scripts/generate-openapi.cjs`. The read-only interface for family products is described in [Family integration](Family-integration.md).

## 1. Conventions

- **Base URL**: `https://<your-domain>/api/v1/<path>` for same-origin deployments. The desktop app calls its local server internally; it is not exposed to the network.
- **Authentication**:
  - Browser sessions: after login the server sets an HttpOnly cookie. Mutating requests (POST, PUT, PATCH, DELETE) also need an `X-Studio-CSRF` header carrying the `csrf` value from the login response, and the `Origin` must be listed in `STUDIO_ORIGINS`.
  - Integrations: create a key under **Studio preferences → API keys and integrations** and send `Authorization: Bearer <key>`. A key only has the scopes selected when it was created.
- **Format**: JSON requests and responses (`Content-Type: application/json`). The default request body limit is 256 KB; some endpoints use smaller or larger limits.
- **Errors**: `{"error": "message"}` with a status code.

| Status | Meaning |
| --- | --- |
| 400 | Invalid parameters |
| 401 | Not signed in or session expired |
| 403 | Missing scope, or the endpoint does not accept API keys |
| 404 | Endpoint or record not found |
| 405 | Method not supported |
| 409 | Record changed or conflicts; read again |
| 413 | Request too large |
| 426 | Incompatible family protocol version |
| 429 | Too many requests; see `Retry-After` |
| 503 | A dependency is unavailable (for example, no speech model installed) |

- **Idempotency**: `POST /commands` accepts an `Idempotency-Key` header (8–120 letters, digits, `_` or `-`); a repeated submission returns the first result.

## 2. Endpoints

### Authentication and accounts

| Method | Path | Scope | Description |
| --- | --- | --- | --- |
| GET | `health` | none | Service status and version |
| GET | `auth/status` | none | Whether a studio exists and how it is set up |
| POST | `auth/bootstrap` | setup token | Create the first studio and super administrator |
| POST | `auth/login` | none | Sign in; returns `csrf` |
| POST | `auth/register` | invitation code | Member registration |
| GET | `auth/me` | session | Current account |
| POST | `auth/logout` | session | Sign out and revoke the session |
| GET / PATCH | `members` | `members:manage` | List members; change role or disable |
| POST | `invitations` | `members:manage` | One-time invitation code (valid 48 hours) |
| GET / POST / PATCH / DELETE | `keys` | `keys:manage` | List, create, copy (password required) and revoke API keys |
| GET | `audit` | `audit:read` | Latest 200 audit entries |
| POST | `password` | session | Change own password |
| GET / PATCH | `team/profile` | session | Own display name and real name |
| GET | `team/members` | `business:read` | Member directory |

### Business data

| Method | Path | Scope | Description |
| --- | --- | --- | --- |
| GET | `state` | `business:read` | Read the business document; `?revision=n` returns `unchanged` when nothing changed |
| PUT | `state` | per change | Submit the whole document with its `revision` |
| GET | `commands` | `business:read` | Structured command catalogue and parameter schemas |
| POST | `commands` | per command | Run a structured command |
| GET / POST | `team/finance` | `finance:read` / manager | Ledger, share plans and calculation |
| GET / POST | `retention` | `business:read` / approver | Retention windows, extension requests, approvals and cleanup |
| GET | `retention/order-access` | session | Whether an order's records are still accessible (desktop use) |
| GET | `weather` | `business:read` | `?latitude=&longitude=&name=` forecast and shoot advice |
| GET | `family/capabilities`, `family/orders/<id>` | `business:read` | Read-only family interface |

The body of `POST /commands` is `{"type": "command", "payload": {…}, "revision": n}`.

- **Read commands** (`studio.preferences`, `studio.catalog`, `orders.list`) may omit `revision`.
- **Write commands** (all others) must include the latest `revision`. A missing or outdated value returns 409, "Write commands require the latest revision", so that someone else's edit is never overwritten.

Recommended flow:

1. Send a read command (for example `{"type":"studio.catalog","payload":{}}`) and take the current `revision` from the response; keys with `contacts:read` may also use `GET /state`.
2. Send the write command with that `revision`. A successful response includes the new `revision` for the next write.
3. On 409, read the data again, check what changed, then decide whether to resubmit. Do not retry automatically without checking.

```bash
curl -s https://studio.example.com/api/v1/commands -H "Authorization: Bearer $KEY" \
  -H 'Content-Type: application/json' \
  -d '{"type":"studio.catalog","payload":{}}'   # read revision
curl -s https://studio.example.com/api/v1/commands -H "Authorization: Bearer $KEY" \
  -H 'Content-Type: application/json' \
  -d '{"type":"orders.update","revision":42,"payload":{"id":"…","location":"City park"}}'
```

Structured commands: `studio.preferences`, `studio.configure`, `studio.catalog`, `orders.list`, `orders.create`, `orders.update`, `orders.deliver`, `pre.status`, `post.status`. Parameter schemas are returned by `GET /commands`.

### AI, speech and system

| Method | Path | Scope | Description |
| --- | --- | --- | --- |
| GET / PUT | `ai/provider` | `ai:configure` | AI service configuration; keys are write-only |
| GET | `ai/status`, `ai/plugins`, `ai/models` | `ai:use` / `ai:configure` | Connection status, available capabilities, model list |
| POST | `ai/test` | `ai:configure` | Connection test; no business data is sent |
| POST | `assistant` | `ai:use` | Assistant conversation; streams as SSE with `Accept: text/event-stream` |
| POST | `assistant/control` | `ai:use` | Stop or adjust your own in-progress reply |
| GET / POST | `speech` | `ai:use` | Recognition status; submit 16 kHz PCM16 (Base64, 0.1–30 s) for transcription |
| GET | `tts/status` | `ai:use` | Synthesis status and voice catalogue |
| PUT | `tts/voices` | `ai:configure` | Import a custom voice list |
| POST | `tts/synthesize` | `ai:use` | Synthesise speech |
| GET / POST / DELETE | `software/elevation` | super administrator | Temporary approval grants |
| GET | `cli/manual` | super administrator session | CLI manual, `?language=en`, `?download=1` |
| POST | `cli` | super administrator session | Run or confirm CLI commands |
| any | `hardware/*` | session | Desktop hardware connection |

## 3. Examples

Replace `studio.example.com` and `<key>` with your own values.

```sh
# List orders
curl -fsS https://studio.example.com/api/v1/commands \
  -H "Authorization: Bearer <key>" \
  -H "Content-Type: application/json" \
  -d '{"type":"orders.list","payload":{"query":""}}'

# Read a family order reference
curl -fsS https://studio.example.com/api/v1/family/orders/<order-id> \
  -H "Authorization: Bearer <key>" \
  -H "X-Limet-Family-Protocol: 1"
```

## 4. Notes

- API keys cannot use the CLI, the desktop retention endpoint or the AI service configuration.
- Amounts are in the studio currency and never change with the interface language.
- Endpoints may change between versions; check the version with `GET /health` before integrating.
