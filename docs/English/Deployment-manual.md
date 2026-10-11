# Limet Otus Studio V3.0.0 Deployment Manual

AI assistance was used in the development of this software.

This manual is for the people who install and maintain the software. It covers two ways of running it:

- **Desktop**: installed on one Windows computer; data stays on that machine.
- **Server**: deployed on a Linux server with Docker Compose; team members use a browser.

The steps describe a recommended approach. The software is provided as is, with no guarantee of data confidentiality, integrity, availability or recoverability, nor of accurate monetary calculations. Operators must assess their own risks and remain responsible for operations. Read [NOTICE-AS-IS.md](../../NOTICE-AS-IS.md) first.

> **The most common problem: the server must be reached over HTTPS.**
> In server mode the session cookie carries the `Secure` flag, and browsers only store it on HTTPS connections. If you open the server's IP or domain over `http://`, the login request appears to succeed but the browser discards the session and keeps returning to the sign-in page. Configure a domain and certificate as described in section 3; do not disable this mechanism to "get it working first". Browsers accept the cookie over plain HTTP only for `http://localhost` on the server itself.

## 1. Requirements

These figures are derived from each component's resource settings and **have not been load-tested**. With many users, a large order volume or speech features, test with realistic data before going live.

### 1.1 Desktop (Windows)

| Item | Minimum | Recommended |
| --- | --- | --- |
| OS | Windows 10 1803 or later, 64-bit | Windows 11, 64-bit |
| CPU | 4 threads | 6 cores / 12 threads or more |
| Memory | 8 GB (without speech synthesis) | 16 GB (baseline when using speech synthesis) |
| Disk | 2 GB free (about 0.9 GB for the app plus data) | SSD with 10 GB+ free (speech-synthesis runtime and model take about 5–6 GB) |
| GPU | Not needed | Optional: NVIDIA GPU with 4 GB+ VRAM and driver 531 or later to accelerate speech synthesis |
| Network | Needed for AI, weather and first-time speech installation | Stable broadband |

Notes:

- Without speech features the app needs little CPU or memory, and no GPU at all.
- Speech recognition (SenseVoiceSmall INT8) uses 2 CPU threads; the model is about 230 MB.
- Speech synthesis (CosyVoice-300M-SFT) uses 4 CPU threads and its process takes about 5 GB of memory. CUDA is used automatically when a qualifying NVIDIA GPU is present; otherwise the CPU is used, noticeably more slowly.
- Recognition and synthesis share one inference slot; only one runs at a time, and it is released after 90 seconds idle.

### 1.2 Server (Linux)

Estimated for everyday use by an individual or a very small studio; multi-user load has not been benchmarked.

| Item | Minimum | Recommended |
| --- | --- | --- |
| OS | A supported Ubuntu LTS release, 64-bit (x86_64) | Ubuntu 24.04 LTS |
| CPU | 2 vCPU | 4 vCPU or more |
| Memory | 4 GB | 8 GB or more (add 1 GB if server speech recognition is enabled) |
| Disk | 20 GB SSD | 50 GB+ SSD plus separate backup storage |
| GPU | Not needed | Not needed (the server edition has no speech synthesis) |
| Network | Public IP or fixed internal address with ports 80/443 open | Same, plus monitoring and alerts |
| Other | A domain (or internal DNS name) and a valid certificate | Same |

- The server runs four containers: PostgreSQL, the Next pages, the separate API and the Caddy reverse proxy.
- **The server edition does not provide speech synthesis.** Speech recognition needs its model added as described in section 6.
- The desktop orb, tray and local device access exist only in the desktop app.

## 2. Desktop installation

1. Choose the installer `LimetOtusStudio-Setup-3.0.0-x64.exe` or the portable `LimetOtusStudio-Portable-3.0.0-x64.exe` (no installation). The installer installs for the current user without administrator rights, by default to `%LOCALAPPDATA%\Programs\LimetOtusStudio` (changeable during setup), creates Start menu and desktop shortcuts and registers an entry under Settings › Apps for uninstalling. Administrators can install silently with `/S` and choose the folder with `/dir=path`. The files are not code-signed, so Windows may warn about an unknown publisher; check the file source and checksum before continuing.
2. On first launch, create the studio: account name, display name, password (at least 12 characters), interface language and studio currency. The first account is the super administrator.
3. For speech, select **Install speech recognition** and **Install speech** in the assistant panel. Each download comes from a pinned source and every file is verified.
4. Data lives in `%APPDATA%\Limet Otus Studio`; uninstalling does not remove it.
5. The master key for business data is kept in `vault-key.dpapi` in that folder, encrypted with the Windows Data Protection API (DPAPI). **It can only be unlocked on the same computer by the same Windows user.** Therefore:
   - Copying the data folder to another computer does not make the business data readable there. To move computers, export a business backup under **Business configuration → Data management → Backup and restore** and import it on the new machine.
   - Reinstalling Windows, recreating the Windows user, or an administrator forcing a password reset for that user can make the key impossible to unlock. Export business backups regularly and keep them elsewhere.

The desktop app's local server listens only on `127.0.0.1`; other devices on the network cannot reach it. Use the server edition for team access.

## 3. Server deployment

### 3.1 Preparation

1. A server meeting section 1.2, fully updated:

   ```bash
   sudo apt update && sudo apt full-upgrade -y
   sudo reboot
   ```

2. Install Docker Engine and the Compose plugin (follow Docker's official documentation). Check:

   ```bash
   docker --version
   docker compose version
   ```

3. Point the domain's A/AAAA records to the server. Caddy obtains the certificate automatically and needs ports 80 and 443 reachable from the internet. For internal-only deployments see section 3.6.

4. Open only the required ports. With Ubuntu's ufw:

   ```bash
   sudo ufw default deny incoming
   sudo ufw default allow outgoing
   sudo ufw allow OpenSSH
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw enable
   ```

   Ports published by Docker can bypass ufw rules. The template publishes only 80/443; never add `ports` for the database, pages or API in `compose.yml`.

5. Use key-based SSH and disable password login; give the operator account sudo rather than working as root.

### 3.2 Get the source

Clone the repository and check out the release tag (for example `v3.0.0`), or download the source archive attached to the release, and place it in a dedicated directory such as `/opt/limet-otus-studio`:

```bash
sudo mkdir -p /opt/limet-otus-studio
sudo chown "$USER" /opt/limet-otus-studio
cd /opt/limet-otus-studio
# extract or check out the source here
```

### 3.3 Generate secrets and configure

```bash
cp cloud/.env.example cloud/.env
chmod 600 cloud/.env
openssl rand -base64 32   # STUDIO_MASTER_KEY
openssl rand -hex 24      # STUDIO_DB_PASSWORD
openssl rand -hex 24      # STUDIO_SETUP_TOKEN
```

Edit `cloud/.env` and fill in the three random values and your domain:

| Variable | Description | Format |
| --- | --- | --- |
| `STUDIO_DOMAIN` | Public domain | `studio.example.com` |
| `STUDIO_ORIGIN` | HTTPS address matching the domain, no path or trailing slash | `https://studio.example.com` |
| `STUDIO_DB_PASSWORD` | Database password; hexadecimal avoids characters that break the connection string | 48 hex characters |
| `STUDIO_MASTER_KEY` | Master key, Base64 of 32 random bytes | 44 characters |
| `STUDIO_SETUP_TOKEN` | One-time token for creating the first studio | 48 hex characters |
| `STUDIO_AI_ALLOWED_HOSTS` (optional) | Self-hosted AI host names allowed on private networks or HTTP, comma-separated | `llm.lan` |
| `STUDIO_WEATHER_ALLOWED_HOSTS` (optional) | Self-hosted weather host names allowed on private networks or HTTP, comma-separated | `weather.lan` |

Key points:

- **The master key decides whether data can be read.** Keep a copy of `STUDIO_MASTER_KEY` apart from both the server and the backups, for example in an offline password manager. If it is lost, existing data cannot be decrypted; if it leaks, treat the data as possibly exposed.
- `STUDIO_ORIGIN` must match the browser address exactly (scheme, host and port), otherwise requests fail the origin check.
- Use fresh random values for every instance; never reuse examples or values from another environment.
- Never commit `cloud/.env` to a repository or paste it into chats or screenshots.

### 3.4 Start

```bash
docker compose --env-file cloud/.env -f cloud/compose.yml config --quiet
docker compose --env-file cloud/.env -f cloud/compose.yml up -d --build
docker compose --env-file cloud/.env -f cloud/compose.yml ps
```

The first command only validates the configuration; no output means success. The first build takes a few minutes. `ps` should show all four services `running` and the database `healthy`.

Network layout:

| Service | Port | Exposed |
| --- | --- | --- |
| proxy (Caddy) | 80, 443 | Yes, the only entry point |
| web (Next pages) | 3000 | No, internal network only |
| api (separate API) | 38322 | No, internal network only |
| db (PostgreSQL 17) | 5432 | No, internal network only |

Caddy forwards `/api/v1/*` to the API and everything else to the pages, and adds `Strict-Transport-Security` (one year, including subdomains), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` and `Referrer-Policy: no-referrer`.

### 3.5 First setup

1. Open `https://studio.example.com` (your domain) and confirm the browser shows a valid certificate.
2. Choose **Create studio** and enter `STUDIO_SETUP_TOKEN` with the super administrator's details.
3. After setup the token cannot be reused. You can clear its value in `cloud/.env` (keep `STUDIO_SETUP_TOKEN=`) and restart the API; with an empty token, first setup can no longer be performed from the web:

   ```bash
   docker compose --env-file cloud/.env -f cloud/compose.yml up -d api
   ```

4. Create invitation codes under **Studio preferences → Account and permissions** and give members the least privileged role they need. There are no preset accounts or default passwords.

Verify:

```bash
curl -fsS https://studio.example.com/api/v1/health
docker compose --env-file cloud/.env -f cloud/compose.yml logs --since 10m api web proxy
```

The health endpoint only shows that the service responds. Also complete a sample flow: sign in, create an order, production and editing tasks, confirm delivery, sign out.

### 3.6 Internal network (no public domain)

HTTPS is still required. Options:

- Use an internal DNS name and a certificate from your organisation's certificate authority; point Caddy to it with `tls <certificate> <key>` in the `Caddyfile`.
- Use Caddy's internal certificates (`tls internal`) and install Caddy's root certificate as a trusted root on every client device.

Do not switch to HTTP. Besides breaking sign-in, it sends sessions and business data across the network unencrypted.

## 4. Built-in protections

The table lists the mechanisms built into the software and what the deployment must provide. They reduce common risks but cannot guarantee the absence of vulnerabilities.

| Area | What the software does | What the operator must do |
| --- | --- | --- |
| Transport | Server-mode session cookies are `Secure`, `HttpOnly` and `SameSite=Strict` | Use HTTPS; keep Caddy's HSTS header |
| Origin checks | Only origins in `STUDIO_ORIGINS` are accepted; mutating requests also need a CSRF token | Set `STUDIO_ORIGIN` exactly |
| Accounts | Passwords of at least 12 characters, stored with scrypt; sessions last 12 hours and are revoked on sign-out; changing a role ends that member's sessions | Disable accounts promptly when members leave |
| Setup | First server setup needs a one-time token; afterwards only invitation codes (48 hours, single use) can register accounts | Clear the token after setup |
| Permissions | Five roles and fifteen scopes; the assistant is capped at photographer level and cannot manage accounts, keys or payments | Assign the least privileged role |
| Rate limits | At most 10 sign-in attempts per account per 15 minutes; setup, registration, AI, speech and CLI are limited separately | Keep the reverse proxy from merging or caching requests |
| Encryption at rest | Business data, AI credentials and conversations are encrypted with AES-256-GCM, bound to their purpose | Keep the master key apart from backups |
| API keys | One key per service with limited scopes and expiry, revocable at any time; copying requires the password | Give each integration its own key and rotate keys |
| Outbound requests | AI service and weather endpoint addresses may not resolve to reserved private ranges (allow self-hosted hosts with `STUDIO_AI_ALLOWED_HOSTS` and `STUDIO_WEATHER_ALLOWED_HOSTS`); errors never echo keys | Allow only hosts you actually need |
| AI and privacy | Tool parameters sent to the model omit notes, gender, adult status and similar fields; web search never sends client details; writes need human confirmation | Choose a model provider you trust and review its data policy |
| Audit | Significant actions are recorded; the super administrator can review the latest 200 entries | Review unusual activity regularly |
| Retention | Retention is counted from delivery with reminders and extension approvals; cleanup deletes client details and payment proof images and keeps only anonymised amounts | Set retention to suit your business and legal obligations; clean external copies separately |
| Response headers | API responses carry `Cache-Control: no-store`, `nosniff`, `X-Frame-Options: DENY` and `Referrer-Policy: no-referrer` | — |
| Desktop | The local server listens on 127.0.0.1 only; pages run sandboxed without direct system access; microphone access is granted to the main window only | Keep the OS updated and enable disk encryption |

## 5. Server operations requirements

These are the baseline requirements for running the server edition in a stable, controlled way. Current limitations of the software are listed in section 10.

### 5.1 Network boundary

- Default-deny inbound traffic and allow only 80/443. Restrict SSH and other management ports to fixed operator addresses, or reach them through a VPN or the cloud provider's bastion host.
- Restrict outbound traffic: the service only needs certificate issuance, software updates, the chosen AI service and the weather service (Open-Meteo by default; switch to a commercial key or a self-hosted service in the Weather module of the command panel).
- Weather licensing: the free Open-Meteo API is for non-commercial use only. For commercial operation, check its terms and, if required, buy the commercial API or deploy a self-hosted Open-Meteo.
- Put a web application firewall (WAF) or the cloud provider's protection service in front of the public endpoint to filter scans and common attack traffic.

### 5.2 Hosts and containers

- Enable automatic OS updates (`unattended-upgrades`), review patches at least monthly and reboot as needed.
- Keep Docker, Compose and base images updated; rebuild with `--build` on upgrades to pick up image fixes.
- Install host intrusion detection and anti-malware, or enable the cloud provider's host protection.
- Run a vulnerability scan every quarter; record findings and track them until fixed.
- Allow key-only SSH, optionally with fail2ban; operators use sudo rather than working as root.
- Encrypt server disks (cloud disk encryption or LUKS).

### 5.3 Logs and monitoring

- Keep OS, container, PostgreSQL, Caddy and software audit logs **for at least six months**, stored centrally away from the application server, with restricted write access.
- Probe `https://<your-domain>/api/v1/health` externally; alert on disk space, memory and certificate expiry.
- Logs may contain order numbers and account names; review and redact before sharing.

### 5.4 People and on-call

- Name a **responsible person** for operations and decide who acts as system administrator and auditor. The auditor should not be a day-to-day user of the software and reviews software audit records and server logs regularly.
- Arrange **on-call coverage**: during working hours at least one reachable person can handle alerts; outside working hours alerts are answered within an agreed time. Write down contacts, channels and response times.
- New staff sign confidentiality agreements and get least-privilege roles. On departure or transfer, disable their software account, revoke their API keys and remove server access on the same day.
- Run training at least once a year covering passwords, phishing, data-handling rules and incident reporting.

### 5.5 Incident response

1. When something unusual happens (an alert, a suspicious sign-in, unexpected data), the person on duty records the time and symptoms and informs the responsible person.
2. Contain if necessary: stop public access (`docker compose ... stop proxy`) and preserve logs and evidence.
3. Assess the scope: which accounts, orders and personal data are involved.
4. Remediate: reset affected passwords and revoke API keys; if the master key may have leaked, migrate to a new instance using the backup and recovery procedure.
5. Notify: for personal-data breaches, inform the relevant authorities and affected individuals promptly, as local law requires.
6. Review: record causes and improvements, and update procedures.

### 5.6 Facilities

Keep the server in a facility with access control, CCTV, fire and water protection, climate control and backup power, or use a suitably accredited cloud provider. Do not leave a server unattended in an office.

### 5.7 Backups and keys

- Encrypt backup files before sending them off-site, for example with `age` or `gpg`.
- Store the master key offline, known to as few people as possible, and separate from the backups.

### 5.8 AI service

To keep all data in-house, connect a self-hosted model and allow its hostname in `STUDIO_AI_ALLOWED_HOSTS`, or leave AI features disabled.

## 6. Server speech recognition (optional)

The container includes the recognition runtime but not the model. To add it:

```bash
# Download and verify the model on the server (see archiveSha256 in speech/MODEL.json)
cd /tmp
curl -fLO https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2024-07-17.tar.bz2
sha256sum sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2024-07-17.tar.bz2
```

When the output matches `archiveSha256` in `speech/MODEL.json` (case does not matter), extract the two files into the API data volume and add `STUDIO_SPEECH_MODELS: /var/lib/studio/data/speech-models` under `api.environment` in `compose.yml`:

```bash
mkdir -p speech-models
tar -xjf sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2024-07-17.tar.bz2 --strip-components=1 -C speech-models \
  sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2024-07-17/model.int8.onnx \
  sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2024-07-17/tokens.txt
docker compose --env-file cloud/.env -f cloud/compose.yml cp speech-models api:/var/lib/studio/data/
docker compose --env-file cloud/.env -f cloud/compose.yml up -d api
```

Verify the native recognition library on the server's CPU architecture.

## 7. Backup and recovery

What to back up:

| Content | Location |
| --- | --- |
| Database | Volume `db-data` (export with `pg_dump`) |
| API data directory | Volume `api-data` (retention journals, recovery records) |
| Caddy certificates and state | Volumes `caddy-data`, `caddy-config` |
| Configuration | `cloud/.env` (contains the master key; keep it encrypted separately) |

Database export example:

```bash
docker compose --env-file cloud/.env -f cloud/compose.yml exec -T db \
  pg_dump -U studio -d studio -Fc > studio-$(date +%Y%m%d).dump
```

- Choose the backup frequency and retention to suit your business and keep them consistent with the retention settings in section 4: records cleared under retention rules should not live on indefinitely in old backups.
- At least quarterly, perform a real restore in a separate environment, check orders, members, historical snapshots and the master key, and record the time taken.
- Restores must use the same master key.

## 8. Upgrades

1. Complete the backup in section 7.
2. Read the [changelog](Changelog.md) for incompatible changes.
3. Fetch the new source into a separate directory and copy the existing `cloud/.env`.
4. Stop writes (tell members), then:

   ```bash
   docker compose --env-file cloud/.env -f cloud/compose.yml up -d --build
   ```

5. Repeat the verification flow from section 3.5.
6. To roll back, stop the services, restore the database from the pre-upgrade backup and start the previous version. Do not assume the schema can be downgraded automatically.

## 9. Troubleshooting

| Symptom | Action |
| --- | --- |
| Signing in returns to the sign-in page | Almost always HTTPS is not used, or `STUDIO_ORIGIN` differs from the address bar |
| Page does not load | Check DNS, ports 80/443, `docker compose ps` and the Caddy logs |
| Certificate issuance fails | Ensure ports 80/443 are reachable from the internet and the domain points to the server |
| API reports an untrusted origin | Correct `STUDIO_ORIGIN`, then restart the API |
| First setup fails | Check the token; an instance that is already set up cannot be set up again |
| Data cannot be read | Confirm the master key and database belong to the same instance |
| Too many sign-in attempts | Wait 15 minutes and check whether someone is guessing passwords |
| Speech unavailable | Desktop: install from the assistant panel; server: see section 6 |

## 10. Known limitations

These are the software's current limitations. Operators can compensate with procedures or external measures; they are also directions for future versions:

| Limitation | Compensating measure |
| --- | --- |
| Passwords are checked for length only (12+ characters), not complexity | Publish a password policy and spot-check |
| No idle-timeout sign-out (sessions expire after 12 hours) | Require members to sign out or lock screens; do not stay signed in on shared computers |
| No two-factor authentication | Provide it through the reverse proxy or a single sign-on system when needed |
| No separate auditor role; super administrators and administrators can both read audit records | Have someone outside daily operations act as auditor and review audit records exported from the database |
| The audit view shows only the latest 200 entries, without export | Operators export the `audit` table periodically and archive it |
| No intrusion detection, anti-malware or central logging | Use cloud-platform or host-level products |
| Installers are not code-signed | Obtain them from a trusted source and verify checksums |
| After an order is deleted, historical versions in the database and existing backups keep copies until retention cleanup or backup expiry | When a client asks for deletion, clean the related backups too; shorten backup retention if needed |

Neither the software nor this manual guarantees data confidentiality, integrity or availability. See [NOTICE-AS-IS.md](../../NOTICE-AS-IS.md).
