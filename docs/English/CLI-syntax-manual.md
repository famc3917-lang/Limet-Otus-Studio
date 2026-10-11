# Limet Otus Studio — CLI syntax manual

Version: V3.0.0.

AI assistance was used in the development of this software.

## Open the panel

Sign in as a Super Administrator and press **Ctrl + Backquote** (the ` key, usually above Tab). The panel opens inside the main window. It uses the same account as the graphical interface. It is not PowerShell or CMD. English commands follow the fixed grammar below; familiar PowerShell command names are not aliases.

Select English in Settings to use English completions, help and prompts. Chinese commands remain accepted for existing scripts. Command names and reserved values are case-sensitive. Names, order identifiers and script content are not translated.

## First operation

Submit this command group:

```text
Import Settings
View
Set Mode Team
```

The proposed change appears without being applied. Check the proposal, then submit **Confirm Y** separately. The Y must be uppercase. Submit **Cancel** to discard it. A proposal expires after five minutes; changed business rules require a new preview. AI produces a draft and cannot confirm it for you.

## Editing and punctuation

Enter or Tab accepts the highlighted completion; the next Enter submits. Shift + Enter inserts a newline. Up and Down select a completion; Escape dismisses it. Enter during input-method composition does not submit.

| Syntax | Meaning |
| --- | --- |
| Spaces | Separate positional arguments. Repeated spaces are allowed. |
| Newline | Separates commands in a group, up to 50 commands. |
| `"value with spaces"` or `'value with spaces'` | One literal argument. Quotes must be paired; there is no backslash escape expansion. |
| `.` | Decimal separator for command amounts and percentages, at most two decimal places. |
| `-`, `_`, `:`, `\`, `/`, `,` | Literal characters within an identifier or argument. |
| `%` | Not accepted in a percentage argument: enter `50`, not `50%`. |
| `--` and `=` | Not used to introduce business arguments. Enter values in the documented order. |
| `;`, `|`, `>`, `>>`, `<`, `&`, `&&`, `||` | No command chaining, pipelines or redirection in the business command input. |
| `$name`, `$(...)`, backquotes | No variable or command expansion. |
| `()`, `[]`, `{}` | Not evaluated in the command input. Business scripts use their own expression grammar. |
| `#`, `//` | Not comments in the command input. They cannot be appended to commands. |
| Four leading spaces | Reserved native-maintenance block. No native handler is currently registered; the block is rejected. |

This panel does not provide arbitrary OS commands, filesystem operations, Python execution or a full PowerShell interpreter.

## General commands

| Command | Effect |
| --- | --- |
| `Help` | Help for the current module. |
| `Help Settings` | Help for a named module. |
| `Import Settings` | Enter a module. Available names: Settings, Shares, Orders, System. |
| `Exit` | Return to General. |
| `Modules` | List modules. |
| `Clear` | Clear the displayed transcript. |
| `AI request text` | Ask the model configured in Studio to draft commands. |
| `Confirm Y` or `Y` | Execute the current pending proposal, as a separate submission. |
| `Cancel` | Discard the pending proposal. |

## Settings

Enter `Import Settings`. `View` takes no arguments; every `Set` command takes exactly two arguments, a field and a value.

| Command | Allowed values |
| --- | --- |
| `Set Mode Personal` | Personal / Team |
| `Set IndependentReview Off` | On / Off; retained policy field for family integration, not a Studio photo-review screen |
| `Set RetentionMonths 3` | Integer, 1–120 |
| `Set GraceMonths 1` | Integer, 1–24 |
| `Set AutoDelete On` | On / Off |
| `Set StartAt Delivery` | Delivery / Shoot / Created |
| `Set ElevationMinutes 15` | Integer, 1–120 |
| `Set ElevationApproval On` | On / Off |

Check existing orders before reducing a retention period or changing its starting event. Changes may make existing records immediately eligible for cleanup. Disabling automatic cleanup stops new automatic tasks; already confirmed cleanup tasks continue. Personal mode requires no second member. Studio manages delivery workflow; photo selection and review belong to Limetkura.

## Shares

Enter `Import Shares`. Replace `ORDER-ID` and `ACCOUNT-ID` with actual identifiers. Command amounts use **major units of the workspace currency**; percentages use 0–100 with at most two decimal places. Changing interface language does not convert the workspace currency.

| Command | Effect |
| --- | --- |
| `View ORDER-ID` | Current rule and existing snapshots. |
| `Reserve ORDER-ID 100 20` | Set a fixed studio reserve of 100 and a reserve percentage of 20. |
| `Member ORDER-ID ACCOUNT-ID 50 40` | Set a member's fixed amount of 50 and percentage of 40. |
| `RemoveMember ORDER-ID ACCOUNT-ID` | Remove the member from the pending rule. |
| `Normalize ORDER-ID On` | Enable proportional normalization of percentage shares. |
| `Calculate ORDER-ID` | Generate a share snapshot. Submit alone and confirm separately. |
| `ImportRule ORDER-ID` | Preview the business rule from the panel's script editor. |

Historical snapshots retain their original rule. A rule for an order with an existing snapshot cannot be overwritten by these commands. Values are operational estimates and may be inaccurate; they are not accounting records or tax calculations. Verify actual payments and costs independently.

## Orders and System

```text
Import Orders
View
View "Team portrait"
Import System
Status
Accounts
```

Orders `View` accepts zero or one keyword, matching the order number or customer name, and returns at most 50 records. System `Status` and `Accounts` take no arguments. They do not invoke OS utilities.

## Business script contract

The script editor accepts one synchronous JavaScript/TypeScript function with one input parameter. Function and parameter identifiers may be Chinese or English; they are literal script content and are never translated.

```javascript
function rule(input) {
  return { reservePoints: 2000 };
}
```

This sets the calculated studio reserve percentage to 20%. Script amounts use **minor currency units** and ratios use **basis points**, unlike command-line amounts and percentages.

Inputs: `receiptsCents`, `refundsCents`, `expensesCents`, `availableCents`, `reserveCents`, `reservePoints`, and each configured member's `member0FixedCents`, `member0Points`, etc. Allowed outputs: `reserveCents`, `reservePoints`, and configured member fields. Every output must be a nonnegative safe integer; percentage bounds and the ordinary share-rule validation also apply.

Supported expressions include numbers, parameter properties, declared numeric variables, arithmetic, comparisons, boolean expressions and conditional expressions. Arbitrary library calls, asynchronous work, loops, external imports and host APIs are not supported. Submitted rules cannot change account checks, activity records or customer-data restrictions. Script length is limited to 20,000 characters and evaluation to 3,000 steps.

## Interface protocol

All calls use `POST /api/v1/cli`. The normal signed-in Super Administrator session is required. API tokens do not open the CLI. A command request can include:

```json
{"action":"command","module":"Settings","language":"en","text":"Set Mode Team"}
```

The result contains the canonical module and messages; a write returns `proposal.id` and `proposal.previews`. Confirm using a **separate** request:

```json
{"action":"confirm","language":"en","id":"PROPOSAL-ID","answer":"Y"}
```

Other actions: `catalog`, `cancel`, `ai` with `text`. `ImportRule` requests include the literal script in `rule`. Existing Chinese canonical module names remain valid. The server accepts English reserved words independently of interface language; `language` selects returned help and messages, not account access.

The rendered manual is `GET /api/v1/cli/manual?language=en`; add `&download=1` to download Markdown. The Chinese manual uses `language=zh`.

Copyright © 2026 博成 · FMLC.

## V3.0.0 business commands

Modules: Settings, Shares, Orders, Workflow, Catalog, Operations, System and Weather. Import selects a namespace. Reserved words are case-sensitive. Order Create uses fixed field/value pairs separated by spaces. Quote literal values containing spaces with ASCII quotation marks. Duplicate fields are rejected.

```text
Import Catalog
View ClientTypes
View Packages
Import Orders
Create Client "Client name" Type TYPE-ID Shoot 2026-10-20T09:30 Gender Female Age Adult Package PACKAGE-ID Location "Shoot location"
```

Required fields: Client, Type, Shoot, Gender and Age. Optional fields: Package, Location, Photographer, Signature and Channel. Gender values: Male, Female, Nonbinary. Age values: Adult, Minor. Signature uses the stable account ID returned by System Accounts. Each proposal requires a separate Confirm Y.

|Module|Command|Purpose|
|---|---|---|
|Orders|Update order Shoot\|Location\|Photographer\|Signature\|Channel value|Update one field|
|Orders|Deliver order|Confirm delivery after editing is complete|
|Workflow|View Pre\|Post [order]|List task IDs and status|
|Workflow|Set Pre\|Post taskId Pending\|InProgress\|Completed|Update a task and its order workflow|
|Catalog|View All\|ClientTypes\|Packages\|Equipment\|Styles\|Extras|Read current business configuration|
|Operations|Overview|View operational estimates|
|Operations|Entries [order]|Show up to 100 recent entries in minor currency units|
|Operations|Accounts|Show member activity and share estimates|

Vertical bars in this table mean alternatives; do not type them in the command. Tasks use internal IDs. Orders accept their displayed order number or internal ID. Operating estimates are not accounting or tax records.

A group can contain up to 50 commands. Preview execution is rolled back. Confirmation rechecks policy, share and business revisions and executes the complete group in one transaction. A failure rolls back the entire group. Historical share snapshots remain unchanged. AI drafts only; the operator supplies required client details without model inference.

## Weather service

Weather in the calendar and the AI assistant comes from a service compatible with the Open-Meteo API. The free Open-Meteo API is used by default and needs no configuration. All weather requests go through the studio server; any key is stored encrypted on the server and is never sent to browsers or members.

**Licensing:** the free Open-Meteo API is for non-commercial use only. For commercial use, check Open-Meteo's terms; if required, buy its commercial API and enter the key here, or use a self-hosted Open-Meteo (open source, deployable on your own server).

|Command|Purpose|
|---|---|
|View|Show the current mode (free, commercial or custom) and endpoints; only the first and last four characters of the key are shown|
|Key key|Set an Open-Meteo commercial key. The forecast, air-quality and geocoding endpoints switch to the `customer-` commercial hosts and requests carry the `apikey` parameter|
|Endpoint Forecast\|AirQuality\|Geocoding url|Point one endpoint to a custom address, such as a self-hosted Open-Meteo. Enter the endpoint only; never put a key in the URL|
|Reset|Clear the key and custom endpoints and return to the free API|

```text
Import Weather
View
Key YOUR-COMMERCIAL-KEY
Confirm Y
Endpoint Forecast https://weather.example.com/v1/forecast
Confirm Y
```

Rules:

- Custom endpoints must be Open-Meteo compatible: the forecast endpoint matches `/v1/forecast`, air quality `/v1/air-quality` and geocoding `/v1/search`, with the same parameters and responses. Services with other formats cannot be connected directly.
- Endpoints must use HTTPS and must not point to private or reserved addresses. For a self-hosted service on the local network, the deployer lists the allowed host names (comma-separated) in the server environment variable `STUDIO_WEATHER_ALLOWED_HOSTS`; those hosts may use HTTP or private addresses.
- Every change is previewed first and applies after `Confirm Y`. It is recorded in the audit log (the action only, never the key).
