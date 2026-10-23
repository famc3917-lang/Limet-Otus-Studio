# Limet Otus Studio Changelog

AI assistance was used in the development of this software.

This file records user-facing changes. The first version lists every feature; later versions list additions, improvements, fixes and removals.

## V3.1.1

### New

- Lighting lab (experimental): estimates the incident reading at the face from the lights and positions in the equipment register, with a 3D preview of the set-up.
  - Modifiers include standard reflectors, softboxes, octaboxes, strip boxes, umbrellas, beauty dishes, snoots, grids and deep parabolics; diffused modifiers are computed from the shape of their front.
  - Common lighting set-ups, with each light's output solved for the camera aperture.
  - Photo, false-colour, zebra and clipping views; the camera view adds luminance and RGB histograms and depth of field from focal length, aperture and focus distance.
  - Lights, props and the camera position can be dragged, or moved with G and turned with R, with X / Y / Z axis locks and typed values; an axis indicator sits in the top-right corner.
  - Import your own GLB / glTF / FBX subject; detailed models are optimised automatically so the view stays responsive.
  - Export a lighting sheet listing each light's position, height, angle, modifier, output and reading.
- Lights in the equipment register take a guide number, energy, illuminance at 1 m, colour temperature, beam angle and CRI, and a body style.
- New Lighting lab algorithm notes (Chinese: docs/CN/灯光测试算法说明.md).
- Accounts can have both a standard password and a text password; either signs in.
- The desktop app is unlocked at start with an owner's account and password; the master key is stored encrypted under owners' passwords only.

### Improved

- Stronger password hashing; older hashes are upgraded at the next sign-in.
- Account records are signed, so accounts altered directly in the database cannot sign in.
- The desktop data folder is restricted to the current Windows user.
- Fewer dependencies in the speech synthesis runtime.
- Refund rules are one table: each tier shows the range of days it covers and the table re-sorts after an edit; duplicate days, a missing 0-day tier or a blank field are flagged at once.
- List menus stand apart from the page behind them, with a solid highlight on the chosen item.
- Equipment and memory-card tiles on a shoot task have a check box and a clear selected state.

### Fixed

- Notices and print templates did not follow changes to the instalment plan or refund rules; fixed percentages in templates saved earlier are now replaced by tables built from the settings.
- A deleted built-in add-on came back after about two seconds and stayed in the print template.

## V3.0.0

The first public release of Limet Otus Studio, with a Windows desktop app and a server deployment template.

### Workspace and orders

- The workspace summarises orders, open production and editing tasks, payment progress and refunds.
- Orders record the client nickname, client type, gender, adult status and guardian consent, shoot time and location, photographer, package, extras, delivery plan and notes.
- Order numbers are generated from the client-type prefix, date, gender code and monthly sequence; production and editing task numbers add their own suffixes.
- Packages fill in price, delivery count and turnaround; extras support fixed prices, per-unit pricing, discounts and expedited delivery.
- A busy-day warning appears when many shoots fall on the same date.
- Orders move through preparation, shooting, post-production, delivery and completion; confirming delivery records the actual delivery time.
- Order attribution is bound to a member account and keeps the member's name at the time.

### Production and post-production

- Production tasks record the shoot plan, character, styles, equipment, multiple memory cards and expected costs.
- Editing tasks record shot count, retouch count, delivery count and date, and the software used, moving from pending to in progress to completed.
- Equipment is managed by category, and tasks keep a snapshot of the equipment IDs used.

### Calendar and weather

- A monthly calendar shows daily shoots; open a date to see its orders.
- City search, daily forecast, wind, precipitation, UV and visibility, with location shoot advice. Weather data is provided by Open-Meteo.

### Payments, refunds and business overview

- Instalment payments: the number of instalments (1–12), each share and the refund tiers (days before the shoot and refund share) are set in Settings › Orders and payments, and each order keeps the plan in effect when it was created. Payment methods, order channels, client tags and work signatures can be added or removed. Payment and refund proof can be uploaded.
- The studio time zone follows the device by default and can be changed in Preferences; shoot times, timestamps and printed forms use it.
- The business overview records actual receipts, refunds, order expenses and shared team expenses.
- Member shares support fixed amounts, percentages or both, with proportional scaling above 100%. Share snapshots keep the rules in force at the time; later entries adjust by difference.
- Members see their own overview; managers see the team summary. All amounts are internal estimates and are not accounting or tax records.

### Printing and statements

- Booking forms, order confirmations and payment summaries can be printed, downloaded as images or copied.
- Statement boxes, rich text, tables and multiple templates with live preview; Chinese and English templates are saved separately.

### Members and permissions

- The first account is the super administrator; other members register with single-use invitation codes.
- Five roles and fifteen scopes; API keys have limited scopes and expiry and can be revoked at any time.
- Significant actions are written to an audit log.

### AI assistant and speech

- Connects to models through OpenAI-compatible or Anthropic APIs, with model discovery, connection tests and web search.
- The assistant uses business tools according to enabled capabilities; write actions need user confirmation; the assistant is capped at photographer permissions and cannot read private client fields.
- Two personas: Limenotus (male voice) and Limenotessa (female voice).
- Speech recognition (SenseVoiceSmall) and speech synthesis (CosyVoice) install from within the app; replies can be read aloud automatically.

### Super administrator command panel

- Opens in the main window with Ctrl + backtick, with fixed Chinese and English grammar, completion and help.
- Covers settings, shares, orders, tasks, catalogue, operations and system; write commands preview first and run in a single transaction after an uppercase Y.

### Data retention

- Retention is counted from delivery, with expiry notices, reminders, extension requests and approvals.
- Cleanup deletes client details and payment proof images and keeps only anonymised amount records.

### Interface and desktop

- Chinese and English interfaces; interface language and studio currency are managed separately.
- Dark and light themes and reduced motion; the window background follows the theme.
- Desktop tray, background mode, global shortcut and desktop orb.
- Business backup export and import, plus backups to your own Git repository.
- Windows installer: bilingual, International Typographic Style, installs for the current user without administrator rights, with a matching uninstaller. A portable build needs no installation.
- Every error and refusal message follows the interface language, and the Error and message reference explains each one with its resolution.

### Deployment and development

- Server deployment template: Docker Compose, PostgreSQL, separate API and Caddy.
- Read-only family order-reference API (protocol 1).
- Weather service configurable in the Weather module of the command panel: the free Open-Meteo API by default, a commercial key or a compatible self-hosted service. Weather requests go through the server and keys never reach browsers.
- Source code is licensed under GPL-3.0-only; see [LICENSE](../../LICENSE).
