# Limet Otus Studio · V3.1.1 User Manual

AI assistance was used in the development of this software.

Limet Otus Studio manages orders, schedules, tasks, people, equipment and delivery. It is designed for individual photographers and very small studios, particularly those working in ACGN (anime, comics and games) photography, and suits other small studios and independent photographers equally well. This manual covers V3.0.0.

The software is provided as is. Data security, calculation accuracy and completeness are not guaranteed. Read the [as-is notice](../../NOTICE-AS-IS.md), verify actual transactions and maintain your own backups.

## 1. Create a studio and sign in

On first launch, select Create studio, enter an account name, nickname, a password and a text password, and select the interface language and studio currency. The first account has ID 0 and is the Super Administrator; no invitation is required. Later members register with invitation codes issued by the studio administrator. For server deployments, the operator supplies the initial setup details. There is no public default password.

The password needs at least 12 characters with letters and digits and no spaces; the text password needs at least 6 characters of any kind, such as a line of poetry. Either one signs you in. Both are case-sensitive and can be changed separately under Change my password in Studio preferences; leave the one you keep blank. Check which studio you are signing in to, and sign out after using a shared computer. If sign-in fails, check the account, password and studio address before contacting the administrator.

## 2. Workspace and preferences

The sidebar opens Orders, Shoot calendar, Production, Post-production, Operations overview, Business settings and Preferences. Entries requiring permissions you do not hold are hidden. In supported desktop clients, the red, yellow and green window buttons close, minimise and maximise or restore the window.

Preferences controls light or dark appearance, Chinese or English, reduced motion, voices and the floating orb. Language is saved on the current device. Custom studio names, client names, notes, historical conversations and edited terms retain their original text.

The studio time zone follows the device by default and can be changed under Time zone in Preferences (for example Europe/Zurich). Shoot times, timestamps and printed forms use the studio time zone; timestamps also record UTC.

Language and currency are independent. The ledger currency is chosen from common currencies (such as USD, EUR, GBP, JPY and CNY) when the studio is created; switching the interface language neither converts amounts nor relabels them. Once business records exist, do not change their currency through direct database edits.

## 3. From order creation to delivery

1. In Orders, select Create order. Enter the client nickname, client type, package, date, location and photographer, review the form, then submit.
2. Create a production task, record the shoot arrangements and select equipment and multiple memory cards. Mark the task complete when the shoot ends.
3. Create a post-production task with retouching quantities, software and delivery plans. Completion moves the order to awaiting delivery.
4. After the photographs have actually reached the client, select Confirm delivery in the order. The recorded delivery time starts the default retention period.

Business settings › Orders and payments holds work signatures, order channels, client tags, payment methods, the instalment plan (1–12 instalments whose shares add up to 100%) and refund tiers (days before the shoot and refund share, including a tier starting at 0 days). Each order keeps the plan and refund tiers in effect when it was created; later changes apply to new orders only. A refund under agreed terms is the payments received multiplied by the applicable share, less the expenses recorded on the production task. Full refund returns all payments received.

Order credits can be linked to a member account. Historical credits keep the member name recorded at that time. An assistant response does not establish success: check the system receipt and the updated order record.

Studio covers the business workflow from booking to delivery. Organising, selecting and colour-adjusting photographs is planned for Limetkura, and pixel editing for Limetan; neither has been released yet.

## 4. Calendar and weather

The calendar shows scheduled sessions by date. Check the administrative region when choosing a city, then open a day for orders, temperature and shoot guidance. Dates outside the forecast range have no determined forecast. Data, suggestions and animations do not replace judgement on location.

City and weather data come from the free Open-Meteo API by default and are fetched through the studio server, which needs access to that service. The free Open-Meteo API is for non-commercial use only; for commercial use, check its terms and, if required, have the super administrator enter a commercial key or a self-hosted service in the Weather module of the command panel (see the [CLI syntax manual](CLI-syntax-manual.md), Weather service). Before an outdoor shoot, recheck rain, wind and temperature and prepare suitable protection, weights and water.

## 5. Operations overview and team shares

Record actual receipts, refunds and order expenses before reviewing member shares. Fixed amounts, percentages and mixed schemes are supported. Calculations are internal; the software does not transfer funds to banks or payment platforms. Members see records within their permissions; administrators can review the team summary.

When percentages exceed the available pool, the administrator chooses adjustment or proportional normalisation. Historical snapshots retain the rules used at the time and are not recalculated under new rules.

The historical payment-stage reference estimates receipts from paid instalments and uses planned shoot-task expenses. It differs from the actual transaction ledger; do not interchange them. Amounts, balances and shares may be inaccurate and must not serve as bookkeeping, tax returns or statutory financial evidence. Verify original records independently.

## 6. Print documents, terms and templates

Open Terms and print templates from Preferences. Edit headings, statement blocks, text, tables and styling, then review the live preview and save. Order details provide confirmation and payment-summary previews, printing, image downloads and copying.

The placeholders {{Payment plan}} and {{Refund rules}} in a template are replaced at print time with tables built from the current settings.

Chinese and English templates are saved separately. English initially loads its own defaults; existing Chinese templates remain. Switching language does not translate saved custom terms. Drafts are retained per language within the current page; save before leaving. Restore original resets only the current language template and applies after saving. Amounts retain the studio currency.

Terms are editable templates, not legal advice. Changing printed terms does not alter recorded receipts or refunds. Check all wording, amounts and historical agreements before sharing. Printing to PDF depends on the system print service. If image copying fails, download and attach the image manually.

## 7. AI and voice

In Preferences, select a provider, model and endpoint, enter your own API Key, test the connection and enable the required capabilities. On failure, check the endpoint, model identifier, quota and provider status. Do not paste keys into chat.

The assistant uses the authorised tools supplied by Studio. Changes require user confirmation. Sensitive client details are excluded from assistant order queries. A connected indicator does not establish that every external service is available.

Male voices select Limenotus and female voices select Limenotessa. Change voices in settings. Replies can be read automatically; Mute controls playback. Interface language does not change the selected voice, and historical conversations retain their text.

Install speech recognition and speech synthesis from the assistant panel first: select **Install speech recognition** and **Install speech**. The app downloads each model, verifies every file and shows progress. Only accounts allowed to configure AI can install; other members see **Speech recognition unavailable**. The synthesis model is about 1.7 GB, so install it on a stable connection; see the [deployment manual](Deployment-manual.md) for hardware requirements.

## 8. Super Administrator command panel

Press Ctrl + Backquote in the main window, usually the key to the left of 1. Esc closes the panel. Other roles cannot enter. Use Help in English or 帮助 in Chinese. Commands and module names are case-sensitive; identifiers, amounts, search text and script bodies remain literal.

For example, enter Import Shares, followed by Help. The Chinese equivalents are 引入 分润 and 帮助. Use the fixed grammar rather than natural-language requests. AI can draft commands, but you must review writes and confirm them with uppercase Y yourself.

See the [CLI syntax manual](CLI-syntax-manual.md) for commands, arguments, quoting and script rules. The panel manages Studio business components; it is not a general-purpose operating-system terminal.

## 9. Retention and extensions

Retention normally starts at delivery. An expiry notice precedes the configured grace period and cleanup. Members may request an extension; an authorised approver handles it. Cleanup deletes the order's client details and payment proof images and keeps amounts as anonymised records. External backups and copies held by other software require separate management.

Before cleanup, restoration or upgrades, check the records you need to retain. A notice does not establish that external copies have been erased. Documentation does not guarantee data security.

## 10. Desktop business backups and troubleshooting

Each time the desktop app starts it opens the unlock window: enter the owner account name and either password, then select Unlock. The master key is stored only encrypted with the owner’s passwords and is not kept elsewhere on the computer; if both passwords are lost, the data on this computer cannot be recovered.

When the app shows an error, look up its wording in the [Error and message reference](Error-reference.md) for its meaning and resolution.

Configure your own Git repository in Preferences, then run a backup from Data management in Business settings. Backups include order data and payment or refund evidence. Payment summaries can be uploaded separately. **Backup and restore** on the same page exports a business backup file (JSON) for moving to another computer or restoring data; it does not include member accounts or API keys.

**Git backups are encrypted with the same master key as the local data: after a disk failure, a Windows reinstall or a change of computer they cannot be opened either. Export JSON backups regularly and keep them elsewhere.** See [NOTICE-KEYS.md](../../NOTICE-KEYS.md).

A failed Git initialisation, staging operation or commit stops the backup. On a push failure, check repository access and connectivity before retrying. A business backup is not a complete server migration package. Follow the [deployment manual](Deployment-manual.md), retain the required service data and verify restoration.

If saving fails, retain the input and resolve the synchronisation notice. Do not repeatedly overwrite conflicting records. Ask the operator to inspect service logs when the server is unavailable. Do not directly edit the database or installation directory during routine use.

## 11. Lighting lab (beta)

Select Lighting lab in the side navigation. This is a beta feature: its results are estimates for planning a setup; rely on an actual meter reading.

1. In the Equipment register under Business settings, enter each light with its guide number, energy or illuminance at 1 m, and its colour temperature, beam angle, colour rendering index and body shape. Missing values are estimated from similar lights.
2. Open the lighting lab and place lights from From the register, or choose a preset under Lighting setup; the output of each light is solved for the camera aperture.
3. Drag lights, props and the camera into place, or press G to move, R to rotate, X, Y or Z to lock an axis, or type exact values.
4. Read Incident at the face and the lighting ratio; Set the aperture from the reading sets the camera aperture to it. Switch the view between Photo, False colour, Zebra and Clipping; the Camera view shows luminance and RGB histograms and depth-of-field blur.
5. Use Import a subject folder to load your own GLB, glTF or FBX subject model.
6. Export lighting sheet saves the position, height, angle, modifier, output and reading of each light; Import a sheet restores a scene; Export image saves the current view.

## 12. Licensing

Original code uses GPLv3. Original non-code assets and trademarks are not licensed by the code licence. Third-party components retain their respective licences. Consult LICENSE, ADDITIONAL_TERMS.md, LICENSE-ASSETS.md and the dependency inventory. The project version record determines edition boundaries and release status.

### Desktop and in-app assistants

Clicking the desktop orb expands its own conversation without opening the main window. Closing the conversation collapses it back into the orb. The in-app launcher moves its own conversation only. The two launchers have independent positions; dragging a conversation header moves its launcher with it. Service settings open in the main Studio window.
