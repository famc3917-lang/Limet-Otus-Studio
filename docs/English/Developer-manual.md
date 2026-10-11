# Limet Otus Studio V3.0.0 Developer Manual

AI assistance was used in the development of this software.

This manual is for third-party developers familiar with Node.js, TypeScript and React. It describes the source layout, data and permission model, desktop shell, speech components, tests and build process. See the [user manual](User-manual.md) for operation, the [deployment manual](Deployment-manual.md) for servers and the [API reference](API-reference.md) for endpoints.

The software is provided as is, with no guarantee of data integrity, continuous availability or accurate monetary calculations. See [NOTICE-AS-IS.md](../../NOTICE-AS-IS.md).

## 1. Environment

| Item | Requirement |
| --- | --- |
| Node.js | 24 (uses the built-in `node:sqlite`) |
| Package manager | npm, installing from `package-lock.json` |
| Desktop build | Windows x64, Electron 44, electron-builder 26 (portable); the installer is built from `installer/` (WPF, .NET Framework 4.8, using the compiler included in Windows) |
| Optional database | PostgreSQL; SQLite is used when `DATABASE_URL` is empty |

```sh
npm ci
cp .env.example .env    # fill in as needed, see section 4
npm run dev             # Next development server, http://localhost:3000 by default
```

Before the first desktop build, run `node node_modules/electron/install.js` to download the Electron runtime (the release script does this automatically when it is missing). If npm reports that some dependency install scripts are not allowed, the defaults are fine for building.

The project uses Next.js 16 and builds with `next build --webpack`. Some conventions differ from earlier releases; consult `node_modules/next/dist/docs/` before changing routes or configuration.

## 2. Source layout

| Path | Contents |
| --- | --- |
| `src/app/` | Pages (App Router). Routes such as `api/v1/[...path]/route.ts` forward to the shared `handleAPI` |
| `src/components/biz/` | Business components: workspace, forms, dialogs, assistant, settings, print editor |
| `src/lib/` | Shared logic: types, business commands, permissions, CLI grammar, translation table, money and date helpers |
| `src/server/` | Server: HTTP routing, database, encryption, authentication and sessions, AI, speech, retention, team finance, family API |
| `electron/` | Desktop main process and feature hosts (window, assistant orb, speech synthesis, speech recognition, drafts, hardware, media permissions) |
| `speech/` | Speech-recognition worker, npm runtime manifest and model manifest `MODEL.json` |
| `tts/` | Speech-synthesis Python worker, locked dependencies, model and runtime manifests |
| `scripts/` | Build, inventory generation, release, source export and audit |
| `tests/` | Automated tests |
| `cloud/` | Docker Compose, Caddy and environment templates |
| `packages/image-optimizer-disabled/` | Local empty package replacing `sharp`, so Next does not bundle native image libraries |
| `third-party/` | Third-party licences and notices shipped with the installer |

## 3. Architecture

### 3.1 Runtime modes

- **Same-origin mode**: the Next server serves both pages and `/api/v1/*`. The desktop app and local development use this mode.
- **Separate API mode**: `npm run build:api` bundles `src/server/main.ts` with esbuild into `dist-api/server.cjs`, which listens on `STUDIO_API_HOST:STUDIO_API_PORT` (default `127.0.0.1:38322`). Set `NEXT_PUBLIC_API_BASE_URL` at frontend build time to point to it. The container template uses this mode.

Both modes share `handleAPI` in `src/server/http.ts`.

### 3.2 Desktop shell

`electron/main.cjs` starts the local Next standalone server and passes data and speech resource directories through environment variables. The window is frameless; the red, yellow and green buttons in the interface control it through IPC in `window-host.cjs`. Each host accepts calls only from the main window and from the local server's origin.

| File | Responsibility |
| --- | --- |
| `window-host.cjs` | Minimise, maximise, close; window background follows the theme and is stored in `userData/window-theme.json` |
| `assistant-host.cjs` | Desktop orb, tray, background mode, global shortcut Ctrl+Alt+Space, interface-language preference |
| `tts-host.cjs` | In-app installation of the speech-synthesis runtime and model |
| `speech-host.cjs` | In-app installation of the speech-recognition model |
| `drafts-host.cjs` | Encrypted temporary storage for unsaved drafts |
| `hardware-host.cjs`, `media-host.cjs` | Removable-storage detection; microphone access is granted only to main-window audio |
| `security.cjs` | Session and permission checks for native calls |
| `preload.cjs` | The restricted `window.desktop` bridge exposed to pages |

### 3.3 Business data

Each workspace's business data (orders, production and editing tasks, client types, packages, equipment, settings) is stored as one encrypted document with a revision number:

- `GET /api/v1/state` reads the document; with a `revision` parameter, an unchanged document returns `unchanged`.
- `PUT /api/v1/state` submits the whole document with the revision it was read at. On a revision mismatch, the server attempts a field-level merge; otherwise it returns 409.
- `POST /api/v1/commands` runs structured business commands (such as `orders.create`) for the assistant, CLI and integrations.

The frontend store `src/lib/store.tsx` synchronises every 1.5 seconds and immediately after a CLI confirmation. Separate modules such as team finance and retention policy live in the `studio_modules` table, each with its own revision.

### 3.4 Database and encryption

- Without `DATABASE_URL`, the SQLite file lives in `STUDIO_DATA_DIR`; with it, PostgreSQL is used. Both modes need a persistent `STUDIO_DATA_DIR` for retention journals and recovery records.
- Main tables: `workspaces`, `users`, `sessions`, `invitations`, `api_keys`, `business_state`, `state_history`, `studio_modules`, `providers`, `conversations`, `audit`, `rate_limits`, `idempotency`, `leases`, `privacy_files`, `privacy_deletions`, `software_elevations`, `elevations`, `hardware_cards`, `hardware_challenges`, `ai_prefix_usage`, `schema_versions`.
- Business documents, AI credentials and conversations are encrypted with AES-256-GCM using keys derived from `STUDIO_MASTER_KEY`, each bound to a purpose context. Passwords are stored with a slow hash.
- Encrypted data cannot be read without the original `STUDIO_MASTER_KEY`.

## 4. Environment variables

| Variable | Description |
| --- | --- |
| `STUDIO_MASTER_KEY` | Base64 encoding of 32 random bytes |
| `STUDIO_ORIGINS` | Allowed origins, comma separated, for example `http://localhost:3000` |
| `STUDIO_SETUP_TOKEN` | One-time token for creating the first studio on a server |
| `DATABASE_URL`, `STUDIO_DB_TLS` | PostgreSQL connection string and TLS switch |
| `STUDIO_DATA_DIR` | Data directory |
| `STUDIO_API_HOST`, `STUDIO_API_PORT`, `STUDIO_API_ORIGIN` | Separate API listen address and public origin |
| `NEXT_PUBLIC_API_BASE_URL` | Separate API address used at frontend build time; empty means same origin |
| `STUDIO_AI_ALLOWED_HOSTS` | Self-hosted model hosts permitted to resolve to private addresses, comma separated |
| `STUDIO_SPEECH_RUNTIME` | Speech-recognition runtime directory (`worker.cjs` and `node_modules`) |
| `STUDIO_SPEECH_MODELS` | Model directory installed from the app; used when the runtime directory has no `models/` |
| `STUDIO_TTS_RESOURCES`, `STUDIO_TTS_HOME` | Speech-synthesis resource and installation directories |

Example values are in `.env.example` at the root and in `cloud/`. Never commit real environment files.

## 5. Accounts, roles and permissions

The first account (UID 0) is the super administrator. Later members register with invitation codes, which fix their role.

| Role | Scope |
| --- | --- |
| `owner` Super Administrator · Owner | Everything, including member management and retention approval |
| `admin` Administrator | Everything except member management and retention approval |
| `photographer` Restricted Administrator · Photographer | Read business data and contact details, edit orders and tasks, view finances, use AI |
| `assistant` Restricted Administrator · Assistant | Same as photographer |
| `viewer` Standard User · Read-only | Read business data |

Scopes are defined in `src/lib/permissions.ts`: `business:read`, `contacts:read`, `orders:write`, `orders:delete`, `workflow:write`, `finance:read`, `finance:write`, `settings:write`, `members:manage`, `keys:manage`, `ai:use`, `ai:configure`, `audit:read`, `extensions:execute`, `retention:approve`.

- Browser sessions use HttpOnly cookies. Mutating requests require the `X-Studio-CSRF` header and a checked Origin. Changing a member's role ends their existing sessions.
- API keys are created per service with selected scopes and a 1–365 day validity, and can be revoked at any time. Keys are stored encrypted and copying one requires the account password.

## 6. AI assistant

- Supports OpenAI Chat Completions–compatible APIs and the Anthropic Messages API; presets are in `src/lib/ai-presets.ts`.
- The server performs all model calls (`src/server/ai.ts`, `ai-connection.ts`). Private network addresses are refused unless listed in `STUDIO_AI_ALLOWED_HOSTS`.
- Available tools depend on enabled capabilities (`src/lib/ai-plugins.ts`): business lookup, business actions, studio overview, weather advice, system diagnostics and web search (Tavily). The assistant is capped at photographer permissions and cannot manage accounts, keys or payments.
- Write operations only produce proposals; they run after the user confirms. Disabling a capability revokes its pending proposals.
- Tool parameters sent to the model omit notes, gender, adult status and other private fields; web search never sends client details.
- Two personas: male voices map to Limenotus (隅鸮), female voices to Limenotessa (媱鸮) (`src/lib/assistant-identity.ts`).

## 7. Speech

Neither speech model has to be bundled at build time; both install from the app.

| Capability | Components | Installation |
| --- | --- | --- |
| Speech recognition | sherpa-onnx-node + SenseVoiceSmall INT8 | The npm runtime ships with the installer; the model downloads via **Install speech recognition** in the assistant panel and is verified into `userData/speech/models` |
| Speech synthesis | CosyVoice-300M-SFT, Python 3.11 | **Install speech** in the assistant panel uses the bundled `uv` to install Python, dependencies and the model |

- Sources, file names and SHA-256 values are pinned in `speech/MODEL.json`, `tts/MODEL.json` and `tts/RUNTIME.json`; installers accept only matching files.
- Bundled models take precedence. A partial set of bundled model files fails release verification.
- Recognition and synthesis share one inference slot; only one engine runs at a time.

To prepare speech recognition in development:

```powershell
powershell -NoProfile -File scripts/install-speech.ps1                 # runtime, plus download and verify the model
powershell -NoProfile -File scripts/install-speech.ps1 -OptionalModel  # runtime only
```

## 8. CLI command panel

The super administrator opens it in the main window with Ctrl + backtick. Grammar, modules and commands are defined in `src/lib/cli.ts`; execution is in `src/server/cli.ts`. Write commands first produce a preview and run in a single transaction after an uppercase `Y`; the business revision is checked first and a changed record requires a new preview. See the [CLI syntax manual](CLI-syntax-manual.md).

## 9. Data retention

`src/server/retention.ts` computes retention from delivery time and workspace policy, with extension requests, approvals and reminders. Cleanup first writes a deletion record and an anonymised amount snapshot, then removes client details, payment proof images and their backup copies. When a file is queued, its size, modification time, file ID and SHA-256 are recorded. Before deletion every value is compared; the file is moved aside atomically and checked again before it is removed, and any mismatch blocks deletion for manual review. Copies in Git backup history are handled manually by the super administrator and then acknowledged.

## 10. Interface language

- Write interface text in place with `t('中文','English')` from `useStudioText()`.
- Server messages and system constants display in English through the map in `src/lib/interface-text.ts`. The map is for fixed text only; user input, custom templates and historical records stay as entered.
- Interface language and studio currency are separate; switching language never changes the currency of an amount.

## 11. Version numbers

Update `package.json`, `package-lock.json` and `src/lib/version.ts` together when the version changes. Changes are recorded in the [changelog](Changelog.md).

## 12. Tests

| Command | Coverage |
| --- | --- |
| `npm run typecheck` | TypeScript |
| `npx eslint .` | Lint |
| `npm run check` | Typecheck plus authentication and permissions, AI, first run, desktop, speech, assistant, CLI |
| `npm run test:team` | Member attribution, ledger and shares |
| `npm run test:v3-workflow` | V3 post-production and delivery |
| `npm run test:retention` | Retention, extensions and cleanup |

Tests use temporary directories and synthetic data. Without an installed recognition model, `test:speech` skips real inference and says so.

## 13. Build and release

```sh
npm run build:api        # separate API
npm run build:desktop    # Next standalone frontend
```

`scripts/package-release.ps1` runs: speech runtime preparation (models optional) → required tests (`npm run check`, covering type checks, the error catalogue, permissions and encryption, AI, first setup, desktop, speech limits, assistant and CLI; plus `test:team`, `test:retention` and `test:v3-workflow`) → build → unpacked assembly → packaged runtime and UI tests → portable build, then `installer/build-installer.ps1` compresses the unpacked folder into a payload and compiles the installer. Source code is not packaged separately: each release points to its Git tag, and the code host attaches the source archive. Any failure stops before an installer is produced. `electron/after-pack.cjs` calls `scripts/verify-package.cjs` to verify the package and write a SHA-256 manifest.

## 14. Source export

`scripts/package-source.ps1` exports a public source snapshot. It checks the public documentation, copies an allow-list of files, excludes dependencies, build caches, runtime data, models and internal QA, then runs `scripts/audit-public-source.cjs` to scan for private keys, common API key formats and local user paths.

## 15. Contribution conventions

- Record the goal of a new or changed feature in the changelog before changing code.
- Keep the SPDX licence header and copyright line in original source files.
- Never put real client data, keys, host addresses or personal paths into code, tests or documentation.
