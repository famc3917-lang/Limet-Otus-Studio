# Limet Otus Studio · Error and message reference

This reference lists every error and refusal message the software can show, in the order of the areas below. Each entry gives the HTTP status code returned by the service (if any), what the message means and how to resolve it.

How to use it:

- Search this page for the words in the message you see. The interface shows the message in the language you selected; both languages list the same entries.
- `{1}` and `{2}` stand for values filled in at run time, such as a field name, a number or a permission.
- A status code appears when the message comes from the service. Messages without one are raised in the app or the desktop client.
- If a message is not listed or the resolution does not help, note the time, the steps taken and the exact message, and report it.

## HTTP status codes

| Code | Meaning and what to do |
| --- | --- |
| 400 | The request is invalid: a required field is empty, a format is wrong or a value is out of range. Correct it and resubmit. |
| 401 | Not signed in, the session expired, or the API key is invalid. Sign in again or use a valid API key. |
| 403 | Identity is known but the operation is not permitted, or the request came from an untrusted origin. Ask the super administrator for permission, or use the correct address. |
| 404 | The record or endpoint does not exist; it may have been deleted or cleared. Refresh and check. |
| 405 | The endpoint does not support this method. Use the method given in the API reference. |
| 409 | The data changed in the meantime, or the operation conflicts with the current state. Refresh, check and try again. |
| 413 | The request is too large. Reduce it and retry. |
| 426 | The connecting software uses an incompatible protocol version. Update it. |
| 429 | Too many requests, or voice processing is busy. Wait a moment and retry. |
| 500 | Internal server error. Retry later; if it recurs, check the server logs or report it. |
| 503 | The service is unavailable, usually because configuration is incomplete, a component is not installed, or it is restarting. The deployer should check the configuration, or install the component as prompted. |

## Accounts and permissions

| No. | Message | Status | Meaning | Resolution |
| --- | --- | --- | --- | --- |
| E001 | `The password must be 12–256 characters with letters and digits, no spaces` | 400 | The password is too short, lacks a letter or a digit, or contains spaces. | Choose at least 12 characters including letters and digits. |
| E002 | `The text password must be 6–200 characters of any text, without control characters` | 400 | The text password is too short or too long, or contains invisible control characters. | Use a memorable line of six or more characters, such as a line of verse. |
| E003 | `Enter a new password or text password` | 400 | Neither new password was filled in. | Fill in at least one of them. |
| E004 | `Set a text password` | 400 | This account has no text password yet. | Fill in a text password and save again. |
| E005 | `Account check failed: this account was changed outside the app, so sign-in is refused` | — | The account’s password, role or status was edited by another program and no longer matches its seal. | Sign in as another owner to reset this member, or restore from a backup; never edit the database with other tools. |
| E006 | `The account is disabled` | 401 | An administrator disabled the account. | Contact the studio's super administrator. |
| E007 | `Your session is no longer valid. Sign in again.` | 401 | The session expired or was revoked. | Sign in again and retry. |
| E008 | `The API key is no longer valid` | 401 | The API key expired or was revoked. | Ask an administrator to create a new API key. |
| E009 | `The current account cannot use the assistant` | 403 | The assistant is not enabled for your role. | Ask the super administrator to perform this operation or to grant you the required permission. |
| E010 | `This account is read-only. Ask an administrator for business permissions.` | — | Your role can view but not change business data. | Ask the super administrator to perform this operation or to grant you the required permission. |
| E011 | `This change was not authorised: ` | — | The account lacks permission to save this change. | Ask the super administrator to perform this operation or to grant you the required permission. |
| E012 | `Create the studio in the desktop app, or contact whoever deployed this server` | — | First setup on the web requires a setup token from the deployer. | Ask the deployer for the setup token, or create the studio in the desktop app. |
| E013 | `Enter the initial setup token` | — | The setup token was not entered. | Enter the setup token provided by the deployer. |
| E014 | `Ask the studio's super administrator for an invitation code` | — | Joining an existing studio requires an invitation code. | Ask the super administrator for an invitation code. |
| E015 | `Changes have not been synchronised. Export them or restore the connection first.` | — | There are unsaved changes when signing out. | Restore the connection and let it synchronise, or export the data before signing out. |
| E016 | `The new password must be 12–256 characters` | — | The password is too short or too long. | Correct the entry as described and submit again. |
| E017 | `Hardware authentication is for signed-in users only` | 403 | Hardware authentication was called without signing in. | Sign in again and retry. |
| E018 | `Registering an elevation card requires the super administrator to confirm the password` | 403 | The password must be confirmed before registering an elevation card. | Enter the super administrator password and retry. |
| E019 | `Elevation cards must use an Ed25519 public key; NFC UID alone is not accepted` | 400 | The card has no signing public key. Card numbers alone are easy to copy and are not accepted. | Use a card that supports Ed25519 signatures. |
| E020 | `The bound member does not exist` | 400 | The member to bind the card to does not exist. | Refresh to load the latest data, check it, then try again. |
| E021 | `Elevation cards allow only specific finance or settings operations` | 400 | An operation that cards cannot authorise was requested. | Correct the entry as described and submit again. |
| E022 | `Card or elevation operation not supported` | 403 | The card is not registered or the operation is unsupported. | Ask the super administrator to perform this operation or to grant you the required permission. |
| E023 | `The challenge has expired or was already used` | 403 | The card challenge timed out or was reused. | Tap the card again. |
| E024 | `Card signature verification failed` | 403 | The card signature does not match the registered key. | Make sure you use the registered card. |
| E025 | `Desktop operations require a signed-in session` | 403 | A desktop feature was called without signing in. | Sign in again and retry. |
| E026 | `Profiles require a signed-in session` | 403 | A profile change was made with an API key. | Sign in to the app and change it there. |
| E027 | `You cannot change records you are not authorised to see` | 403 | The change includes fields hidden from your role. | Ask the super administrator to perform this operation or to grant you the required permission. |
| E028 | `You cannot change expenses you are not authorised to see` | 403 | Your role has no finance permission but changed an expense. | Ask the super administrator to perform this operation or to grant you the required permission. |
| E029 | `This account or API key lacks permission for this operation: {1}` | 403 | A required permission is missing; {1} is its name. | Ask the super administrator to perform this operation or to grant you the required permission. |
| E030 | `Too many requests. Retry shortly.` | 429 | Too many requests were made in a short time and were temporarily limited. | Wait a few minutes and retry. |
| E031 | `The API key is invalid, expired or revoked` | 401 | The API key is wrong or no longer valid. | Ask an administrator to create a new API key. |
| E032 | `Sign in first` | 401 | You are not signed in or the session expired. | Sign in again and retry. |
| E033 | `Security check failed. Refresh the page.` | 403 | The page's security token expired, often after a long idle period or signing in on another tab. | Refresh the page and retry. |
| E034 | `The hardware authorisation is invalid or already used` | 403 | The card authorisation expired or was already used. | Tap the card again. |
| E035 | `Incorrect account name or password` | 401 | The account name or password is wrong. | Check and re-enter them; if you forgot the password, contact the super administrator. |
| E036 | `Invalid account details` | 400 | The account name, display name or password does not meet the requirements. | Correct the entry as described and submit again. |
| E037 | `Ask the studio owner for a valid invitation code` | 403 | The invitation code is wrong, used or expired. | Ask the super administrator for a new code. |
| E038 | `The account name is already taken` | 409 | Another member uses this account name. | Choose another account name. |
| E039 | `First setup requires the desktop app or a setup token from the deployer` | 403 | No valid setup token was provided for first setup on the web. | Enter the STUDIO_SETUP_TOKEN set by the deployer, or create the studio in the desktop app. |
| E040 | `The studio already exists. Sign in or register with an invitation.` | 409 | A studio already exists on this server. | Sign in, or ask the super administrator for an invitation code. |
| E041 | `Too many legacy accounts to migrate` | 400 | More than 100 accounts were being migrated. | Migrate in batches or contact the deployer. |
| E042 | `Invalid account role` | 400 | The role does not exist. | Correct the entry as described and submit again. |
| E043 | `The member does not exist` | 404 | The member was removed. | Refresh to load the latest data, check it, then try again. |
| E044 | `At least one active studio owner must remain` | 400 | The change would leave the studio without a super administrator. | Appoint another super administrator first. |
| E045 | `Choose a member role` | 400 | A role that cannot be assigned here was chosen. | Correct the entry as described and submit again. |
| E046 | `Key export requires a signed-in session` | 403 | Key export was requested with an API key. | Sign in to the app and do it there. |
| E047 | `Incorrect password` | 403 | The password entered for confirmation is wrong. | Enter the password again. |
| E048 | `The key is no longer valid or does not exist` | 404 | The API key was revoked or expired. | Create a new API key. |
| E049 | `This key was created in an older format. Create a new key and revoke the old one.` | 409 | This key cannot be shown again. | Create a new key, update the integration, then revoke the old key. |
| E050 | `Invalid key permissions; members, keys and AI settings are managed only in signed-in sessions` | 400 | Administrative permissions were requested for an API key. | Grant only business read and write scopes. |
| E051 | `Key lifetime must be 1–365 days` | 400 | The lifetime is out of range. | Correct the entry as described and submit again. |
| E052 | `Use a signed-in session` | 403 | This operation cannot be done with an API key. | Sign in to the app and do it there. |
| E053 | `The current password is incorrect` | 403 | The current password was entered incorrectly. | Enter the current password again. |
| E054 | `Elevation requires a signed-in session` | 403 | Elevation was requested with an API key. | Sign in to the app and do it there. |
| E055 | `Only the super administrator can grant or revoke elevation` | 403 | Your account cannot grant or revoke elevation. | Ask the super administrator to perform this operation or to grant you the required permission. |
| E056 | `The member does not exist or is disabled` | 400 | The member was removed or disabled. | Refresh to load the latest data, check it, then try again. |
| E057 | `This studio does not allow extension-approval elevation` | 403 | The studio policy disables extension-approval elevation. | The super administrator can approve it directly. |
| E058 | `The elevation lasts longer than the studio allows` | 400 | The requested elevation exceeds the limit. | Shorten it and retry. |
| E059 | `Your session has expired. Sign in again.` | — | The session expired. | Sign in again and retry. |
| E060 | `You do not have permission for this operation.` | — | Your role lacks permission for this operation. | Ask the super administrator to perform this operation or to grant you the required permission. |

## Orders and tasks

| No. | Message | Status | Meaning | Resolution |
| --- | --- | --- | --- | --- |
| E061 | `Provide a valid {1}` | — | A required field is empty or malformed; {1} is the field name. | Correct the entry as described and submit again. |
| E062 | `Dates must be valid YYYY-MM-DDTHH:mm values` | — | The date does not exist (for example 30 February) or is malformed. | Correct the entry as described and submit again. |
| E063 | `Confirm the client's gender and age category` | — | Gender or age category is missing. | Correct the entry as described and submit again. |
| E064 | `Choose an existing client type` | — | The client type does not exist or was deleted. | Check Business settings › Client types and choose again. |
| E065 | `The package does not exist` | — | The selected package was deleted. | Choose another package. |
| E066 | `The order does not exist` | 400 / 404 | The order was deleted or the ID is wrong. | Refresh to load the latest data, check it, then try again. |
| E067 | `Invalid shoot time` | — | The shoot time does not exist or is malformed. | Correct the entry as described and submit again. |
| E068 | `The order has already been delivered` | — | The order has already been delivered. | No action needed. |
| E069 | `Complete the editing task first` | — | The editing task is not complete, so delivery cannot be confirmed. | Complete the editing task, then confirm delivery. |
| E070 | `Invalid task status` | 400 | A task status must be pending, in progress or completed. | Correct the entry as described and submit again. |
| E071 | `The task does not exist` | — | The task was deleted or the ID is wrong. | Refresh to load the latest data, check it, then try again. |
| E072 | `Invalid work signature` | — | The order's signature ID is too long or malformed. | Choose the work signature again. |
| E073 | `The memory card list is invalid or contains duplicates` | — | Memory card IDs on the shoot task are duplicated or invalid. | Choose the memory cards again. |
| E074 | `Invalid amount or quantity in {1}` | — | An amount or quantity is not a valid non-negative number. | Correct the entry as described and submit again. |
| E075 | `Invalid signature member ID` | — | The member ID on the order is malformed. | Choose the signature member again. |
| E076 | `Invalid signature display name` | — | The member's display name is too long. | Correct the entry as described and submit again. |
| E077 | `Channels can be up to 80 characters` | — | The referral source is too long. | Correct the entry as described and submit again. |
| E078 | `Up to 20 client tags, each 1–40 characters and unique` | — | Too many tags, a tag is too long, or tags repeat. | Correct the entry as described and submit again. |
| E079 | `Up to 20 client tags, each 1–40 characters` | — | Too many tags or a tag is too long. | Correct the entry as described and submit again. |
| E080 | `Invalid signature account ID` | — | The signature member ID is malformed. | Choose the signature member again. |
| E081 | `{1} is malformed` | — | A field is malformed. | Correct the entry as described and submit again. |
| E082 | `{1}{2} can be up to 80 characters` | — | The field is too long. | Correct the entry as described and submit again. |
| E083 | `Unable to read the file` | — | The browser could not read the selected file. | Choose the file again and check that no other program is using it. |
| E084 | `Unable to decode the image` | — | The file is not a recognised image or is damaged. | Choose a JPG or PNG image. |
| E085 | `Unable to create a canvas` | — | The browser could not process the image, usually because memory is low. | Close other tabs and retry, or use a smaller image. |
| E086 | `Reload the data first` | — | This window's data is out of date and cannot be saved yet. | Refresh to load the latest data, check it, then try again. |
| E087 | `Reloading discards changes in this window that have not been synchronised. Export the current data first.` | — | This window has changes not yet saved to the server; reloading loses them. | Export the data under Data management first, then reload. |
| E088 | `Business data could not be read completely, so saving has stopped.` | — | The data read was incomplete or failed validation; saving is paused to prevent overwriting. | Export the current data and reload; if it still fails, restore from a backup. |
| E089 | `Conflicting changes exist. Export this window's changes, then reload.` | — | Another member changed the same data while you were editing. | Export your changes, reload, then reapply what you need. |
| E090 | `The weather service is unavailable` | — | The Open-Meteo weather service cannot be reached. | Check the network and retry. |
| E091 | `Incomplete weather data` | — | The weather service returned incomplete data. | Retry later. If it keeps happening, note the time and the steps taken and report it. |
| E092 | `City search is unavailable` | — | The city search service cannot be reached. | Check the network and retry. |
| E093 | `A bound signature account cannot be cleared` | 400 | The order already has a signature member and cannot be left empty. | Choose another member. |
| E094 | `The signature member does not exist or is disabled` | 400 | The selected member was removed or disabled. | Choose another signature member. |
| E095 | `Order numbers and recorded creation times cannot be rewritten` | 403 | The order number or recorded time was changed. | They are fixed after creation; delete and recreate the order if they are wrong. |
| E096 | `A delivered order's progress cannot be reset through its tasks` | 409 | The order is delivered and a task status was changed. | No action needed. |
| E097 | `Delivery and cleanup times are set only by their workflows` | 403 | The delivery or cleanup time was edited directly. | Use Confirm delivery or the retention workflow. |
| E098 | `Order progress must go through editing and delivery` | 409 | Editing or delivery was skipped. | Complete the editing task, then confirm delivery. |
| E099 | `Task links cannot be rewritten` | 403 | A task was moved to another order. | Delete it and create the task under the correct order. |
| E100 | `Data conflict. Export this window's changes, then reload.` | — | Another member changed the same data while you were editing. | Export your changes, reload, then reapply what you need. |
| E101 | `Enter a city name` | 400 | The city search text is empty or too long. | Correct the entry as described and submit again. |
| E102 | `Select a valid date.` | — | The date does not exist or is malformed. | Correct the entry as described and submit again. |
| E103 | `This form has not been submitted. Leaving will discard what you entered. Continue?` | — | You are leaving a page whose form has not been submitted. | Choose Continue to discard it and leave, or Cancel to stay and submit. |

## Payments and shares

| No. | Message | Status | Meaning | Resolution |
| --- | --- | --- | --- | --- |
| E104 | `The paid instalment count must be between 0 and {1}` | — | The paid count exceeds the order's number of instalments; {1} is that number. | Refresh to load the latest data, check it, then try again. |
| E105 | `Use 1–20 refund tiers` | — | There are no refund tiers or too many. | Correct the entry as described and submit again. |
| E106 | `Days must be a whole number from 0 to 3650` | — | A refund tier's days value is not a valid whole number. | Correct the entry as described and submit again. |
| E107 | `Refund share must be 0%–100%` | — | A refund share is out of range. | Correct the entry as described and submit again. |
| E108 | `Each refund tier needs a different number of days` | — | Two tiers have the same number of days. | Correct the entry as described and submit again. |
| E109 | `Include a tier starting at 0 days` | — | No tier covers the shoot date itself. | Add a tier starting at 0 days. |
| E110 | `Use 1–{1} instalments` | — | There are no instalments or too many; {1} is the limit. | Correct the entry as described and submit again. |
| E111 | `Each instalment needs a name` | — | An instalment has no name. | Correct the entry as described and submit again. |
| E112 | `Each instalment share must be above 0% and no more than 100%` | — | An instalment share is zero or out of range. | Correct the entry as described and submit again. |
| E113 | `Instalment shares must add up to 100%` | — | The instalment shares do not add up to 100%. | Adjust the shares until they total 100%. |
| E114 | `Amounts must be non-negative numbers with up to two decimals` | — | The amount is negative or has too many decimals. | Correct the entry as described and submit again. |
| E115 | `The amount is out of range` | — | The amount is too large. | Correct the entry as described and submit again. |
| E116 | `The total amount is out of range` | — | The accumulated amount is too large. | Correct the entry as described and submit again. |
| E117 | `Invalid share rule` | — | The share rule is missing fields or has invalid values. | Correct the entry as described and submit again. |
| E118 | `Invalid member share amount or percentage` | — | A member's fixed amount or percentage is invalid. | Correct the entry as described and submit again. |
| E119 | `Shares exceed 100%. Enable proportional scaling or adjust the rule.` | — | Member percentages add up to more than 100%. | Enable proportional scaling or lower the percentages. |
| E120 | `Only single-parameter synchronous rule functions are supported` | — | The rule function signature is not supported. | Write it as function rule(input) { return {...}; }. |
| E121 | `The business script exceeded its computation limit` | — | The script performs too many steps. | Simplify the script. |
| E122 | `Calculations must produce finite numbers` | — | The script produced infinity or a non-number. | Check for possible division by zero. |
| E123 | `Unsupported variable: {1}` | — | The script uses a variable that is not provided. | Use only the fields listed in the input. |
| E124 | `Only values listed in the input can be read` | — | The script reads data outside the input. | Use only the fields listed in the input. |
| E125 | `Only Math.min/max/round/floor/ceil/abs are supported` | — | The script calls a function that is not allowed. | Use one of the permitted functions. |
| E126 | `Return values must be unique numeric fields` | — | Returned fields repeat or are not numbers. | Correct the entry as described and submit again. |
| E127 | `The business script does not support this syntax: {1}` | — | The script uses unsupported syntax. | Use only constants, conditions and return statements. |
| E128 | `Only uniquely named constants are supported` | — | The script declares the same constant twice. | Give each constant a different name. |
| E129 | `Business scripts support only constants, conditions and return values` | — | The script contains loops, assignments or other disallowed statements. | Use constants and conditions instead. |
| E130 | `The rule function must return an object of numbers` | — | The script does not return an object of numbers. | Correct the entry as described and submit again. |
| E131 | `Business scripts can be up to 20,000 characters` | — | The script is too long. | Shorten the script. |
| E132 | `The script must be one function: function rule(input) { return {...}; }` | — | The script is not a single function. | Correct the entry as described and submit again. |
| E133 | `Business script output must be permitted non-negative whole-number fields` | — | The script returned negative or fractional values, or fields that are not allowed. | Correct the entry as described and submit again. |
| E134 | `This order already has a share snapshot; historical rules are not rewritten` | 400 | Shares for the order were already calculated under an earlier rule. | New rules apply only to orders whose shares have not been calculated. |
| E135 | `Instalments and refund rules cannot be changed after an order is created` | 403 | An order keeps the plan agreed when it was created. | To change the agreement, confirm with the client, then delete and recreate the order. |
| E136 | `Existing amounts cannot be relabelled by switching currency; set the currency only in a studio with no orders, no ledger entries and zero prices` | 409 | The currency was changed while amounts already exist. | The currency is set when the studio is created; create a new studio for another currency. |
| E137 | `Set the share plan for this order first` | 400 | The order has no share plan. | Set a share plan for the order in the operations overview. |
| E138 | `Fixed shares exceed the amount available for this order; resolve the shortfall first` | 400 | Fixed member amounts exceed the distributable amount. | Lower the fixed amounts or wait for further payments. |
| E139 | `Ledger records have changed. Refresh and retry.` | 409 | Another member changed the ledger at the same time. | Refresh to load the latest data, check it, then try again. |
| E140 | `Archived orders record amounts only, without free-text notes` | 400 | A note was entered for a cleared order's entry. | Leave the note empty and submit. |
| E141 | `Share plans are set by managers` | 403 | Your role cannot set share plans. | Ask the super administrator to perform this operation or to grant you the required permission. |
| E142 | `Business scripts are imported through the super administrator command panel` | 403 | A business script was submitted outside the command panel. | The super administrator imports it in the command panel. |
| E143 | `The share member does not exist or is disabled` | 400 | A member in the share plan was removed or disabled. | Remove the member from the plan. |
| E144 | `This order already has a share snapshot, so its rule is kept; new rules apply to orders not yet calculated` | 409 | Shares for the order were already calculated under an earlier rule. | New rules apply only to orders not yet calculated. |
| E145 | `The original entry does not exist or was already reversed` | 400 | The entry was already reversed or removed. | Refresh to load the latest data, check it, then try again. |
| E146 | `The amount must be greater than 0` | 400 | The amount is zero or negative. | Correct the entry as described and submit again. |
| E147 | `The recording member does not exist` | 400 | The member on the entry does not exist. | Choose the member again. |
| E148 | `Reimbursements can only refer to order expenses` | 400 | The reimbursement refers to an entry that is not an order expense. | Choose the matching order expense. |
| E149 | `The reimbursed expense is invalid or already reimbursed` | 400 | The expense was already reimbursed or does not exist. | Refresh to load the latest data, check it, then try again. |
| E150 | `Unknown ledger operation` | 400 | The requested ledger operation does not exist. | Correct the request according to the API reference and send it again. |

## Settings and data

| No. | Message | Status | Meaning | Resolution |
| --- | --- | --- | --- | --- |
| E151 | `Invalid lighting specifications` | — | A light’s photometric values are out of range or its type is invalid. | Correct the entry as described and submit again. |
| E152 | `This is not a Limet lighting sheet` | — | The chosen file was not exported from the lighting lab. | Choose a text file that begins with the lighting sheet header. |
| E153 | `No subject model found` | — | The chosen folder has no GLB, glTF or FBX model. | Choose the folder that contains the model file. |
| E154 | `The model has no visible meshes` | — | The model file has no geometry that can be shown. | Check the model in your 3D software and export it again. |
| E155 | `Each signature needs a name` | — | A signature under Orders and payments has no name. | Correct the entry as described and submit again. |
| E156 | `Provide valid studio settings` | — | The submitted settings are incomplete. | Correct the entry as described and submit again. |
| E157 | `The studio name must be 1–80 characters` | — | The name is empty or too long. | Correct the entry as described and submit again. |
| E158 | `The accent colour must be #RRGGBB` | — | The colour value is malformed. | Correct the entry as described and submit again. |
| E159 | `Invalid motion preference` | — | The reduce-motion value is not on or off. | Correct the entry as described and submit again. |
| E160 | `Channels, client tags and payment methods must be 1–40 characters and unique` | — | A list item is empty, too long or duplicated. | Correct the entry as described and submit again. |
| E161 | `Invalid time zone` | — | The time zone is not a valid IANA name. | Choose a zone from the list, for example Europe/Zurich, or leave it blank to follow the device. |
| E162 | `Use 1–20 signatures with names of 1–40 characters` | — | The number of signatures or a name length is out of range. | Correct the entry as described and submit again. |
| E163 | `The backup is not studio data` | — | The imported file is not a business backup exported by this app. | Choose a file created by Data management › Export. |
| E164 | `Invalid studio preferences` | — | Preference fields in the backup or request are incomplete, or the currency is unsupported. | Correct the entry as described and submit again. |
| E165 | `Invalid print template` | — | The print template is missing fields or has out-of-range values. | Use Restore original on the print template page and edit again. |
| E166 | `Missing or damaged data list: {1}` | — | The backup lacks a required list; {1} is its name. | Use a complete export file. |
| E167 | `Invalid list of removed add-ons` | — | The record of removed built-in add-ons is not a list of IDs, or is too long. | Use a complete export file. |
| E168 | `{1} contains invalid or duplicate records` | — | Records in the list lack an ID or share an ID. | Use a complete export file that has not been edited by hand. |
| E169 | `{1} is malformed` | — | A field is malformed. | Correct the entry as described and submit again. |
| E170 | `Records in {1} are incomplete` | — | A record is missing required fields. | Use a complete export file that has not been edited by hand. |
| E171 | `{1} contains tasks without an order, or duplicate tasks` | — | A task refers to a missing order, or an order has two tasks of the same kind. | Use a complete export file that has not been edited by hand. |
| E172 | `Business data is too large` | — | The business data exceeds the size allowed per save. | Remove records you no longer need or import in parts. |
| E173 | `Client phone or social-media fields are not supported` | — | The imported data contains phone or messaging-account fields, which the app does not store by design. | Remove those fields and import again. |
| E174 | `Invalid file format.` | — | The selected file is not a valid business backup. | Choose a file created by Data management › Export. |

## Retention

| No. | Message | Status | Meaning | Resolution |
| --- | --- | --- | --- | --- |
| E175 | `Invalid retention period` | — | The retention months are out of range or the start date is invalid. | Correct the entry as described and submit again. |
| E176 | `The order does not exist or its records have been cleared` | 404 | The order was deleted or cleared under the retention policy. | Refresh to load the latest data, check it, then try again. |
| E177 | `Cleared orders keep only financial records` | 409 | A cleared order was changed. | Cleared orders cannot be edited. |
| E178 | `Retention operations require a signed-in session` | 403 | A retention operation was called with an API key. | Sign in to the app and do it there. |
| E179 | `Only the super administrator can confirm handling of external copies` | 403 | Only the super administrator can confirm external copies were handled. | Ask the super administrator to perform this operation or to grant you the required permission. |
| E180 | `Cleanup requires confirmation by the super administrator` | 403 | Immediate cleanup needs the super administrator's confirmation. | Ask the super administrator to perform this operation or to grant you the required permission. |
| E181 | `Retention records have changed. Refresh and check.` | 409 | Another member handled the retention records at the same time. | Refresh to load the latest data, check it, then try again. |
| E182 | `The order does not exist or has been cleared` | 404 | The order was deleted or cleared. | Refresh to load the latest data, check it, then try again. |
| E183 | `Reminders can be snoozed for 1–168 hours` | 400 | The snooze length is out of range. | Correct the entry as described and submit again. |
| E184 | `Enter a reason and a valid new deadline for the extension` | 400 | The extension has no reason or an invalid deadline. | Correct the entry as described and submit again. |
| E185 | `The new deadline must be later than the current one and within ten years` | 400 | The new deadline is earlier than the current one or too far ahead. | Correct the entry as described and submit again. |
| E186 | `An extension request is already pending` | 409 | The order already has a pending request. | Wait for the decision. |
| E187 | `The extension request log is full. Ask an administrator to archive it.` | 400 | The extension request log has reached its limit. | Ask the super administrator to perform this operation or to grant you the required permission. |
| E188 | `Requires the super administrator or a valid extension-approval elevation` | 403 | You cannot approve extensions. | Ask the super administrator to perform this operation or to grant you the required permission. |
| E189 | `The request does not exist or was already handled` | 409 | The request was approved, rejected or withdrawn. | Refresh to load the latest data, check it, then try again. |
| E190 | `The requested deadline has passed. Submit a new request.` | 409 | The requested deadline has already passed. | Submit a new extension request. |
| E191 | `Unknown retention operation` | 400 | The requested retention operation does not exist. | Correct the request according to the API reference and send it again. |
| E192 | `The order has not reached its automatic cleanup date` | 409 | The order is still within its retention period. | No action needed; you will be reminded when it is due. |
| E193 | `Not yet due for cleanup` | 409 | The order is not yet due for cleanup. | No action needed. |

## AI assistant

| No. | Message | Status | Meaning | Resolution |
| --- | --- | --- | --- | --- |
| E194 | `Includes an unregistered AI plugin` | — | The AI configuration contains a plugin the app does not recognise. | Reselect the plugins under AI service connection and save. |
| E195 | `Select an API protocol` | — | No protocol is selected for the AI service. | Check the provider, API address, protocol and model under Preferences › AI service connection, then retry. |
| E196 | `Enter the API base address` | — | The AI service address is empty. | Check the provider, API address, protocol and model under Preferences › AI service connection, then retry. |
| E197 | `Invalid API address` | — | The API address is not a valid URL. | Check the provider, API address, protocol and model under Preferences › AI service connection, then retry. |
| E198 | `The API address must use HTTPS; local models may use http://localhost` | — | External AI services must use HTTPS to protect the key. | Use an https:// address; a model running on this computer may use http://localhost. |
| E199 | `Invalid model ID` | — | The model ID contains characters that are not allowed. | Choose or copy the model ID from the provider's list. |
| E200 | `Invalid API key format. Paste only the key.` | — | The key contains spaces, line breaks or other text. | Paste only the key itself. |
| E201 | `The API key does not need a Bearer prefix. Paste only the key.` | — | The pasted text starts with "Bearer ". | Remove the prefix and keep only the key. |
| E202 | `Select or enter a model ID` | — | No model is selected. | Check the provider, API address, protocol and model under Preferences › AI service connection, then retry. |
| E203 | `Invalid search service key` | — | The web search service key is malformed. | Paste the search service key again. |
| E204 | `Invalid model identity fields` | — | The model developer or other identity fields are too long or contain disallowed characters. | Correct the entry as described and submit again. |
| E205 | `This model does not support the business tool protocol. Choose a Chat Completions model with tool calling.` | — | The selected model does not support tool calls, so it cannot perform business operations. | Choose a model that supports tool (function) calling. |
| E206 | `The conversation is too long. Start a new one.` | — | The conversation exceeds the size allowed per request. | Start a new conversation. |
| E207 | `The AI service returned an invalid response or the connection dropped. Retry.` | — | The provider's response could not be read or the connection dropped. | Retry later. If it keeps happening, note the time and the steps taken and report it. |
| E208 | `The AI service returned an invalid response` | — | The provider's response does not match the selected protocol. | Check the provider, API address, protocol and model under Preferences › AI service connection, then retry. |
| E209 | `The model requested a plugin that is not enabled or not permitted` | — | The model tried to use a feature that is not enabled; the app refused. | No action needed. To allow it, an administrator can enable the plugin under AI service connection. |
| E210 | `The AI response does not match the selected protocol` | — | The provider uses a different protocol from the one configured. | Check the provider, API address, protocol and model under Preferences › AI service connection, then retry. |
| E211 | `The AI returned invalid business parameters` | — | The model's operation parameters were invalid; the app refused to run them. | Rephrase the request, or do it directly in the interface. |
| E212 | `The AI stream exceeded its limit` | — | The streamed reply exceeded the permitted length. | Start a new conversation or ask for a shorter answer. |
| E213 | `The AI stream did not finish` | — | The streamed reply stopped before it finished. | Retry later. If it keeps happening, note the time and the steps taken and report it. |
| E214 | `The AI stream was empty` | — | The provider returned nothing. | Retry later. If it keeps happening, note the time and the steps taken and report it. |
| E215 | `Too many tool calls` | — | The model requested too many operations at once. | Split the request into smaller steps. |
| E216 | `The AI stream returned an error` | — | The provider reported an error while replying. | Retry later. If it keeps happening, note the time and the steps taken and report it. |
| E217 | `Up to 32 voices` | — | Too many voices were imported. | Import fewer voices. |
| E218 | `Each imported voice must be labelled male or female` | — | An imported voice has no gender label. | Set male or female for every voice in the list. |
| E219 | `Voice gender does not match the original voice` | — | The imported gender label conflicts with the built-in voice. | Correct the entry as described and submit again. |
| E220 | `Imported voice IDs must be unique and start with custom-` | — | A voice ID is duplicated or malformed. | Correct the entry as described and submit again. |
| E221 | `Invalid voice name or model voice ID` | — | The voice name is empty or its ID is malformed. | Correct the entry as described and submit again. |
| E222 | `The voice does not exist or has no gender label` | — | The selected voice is not listed or lacks a gender label. | Choose another voice. |
| E223 | `This model needs a different protocol for business tools. Choose a compatible model.` | — | The model's tool calling is incompatible with the configured protocol. | Check the provider, API address, protocol and model under Preferences › AI service connection, then retry. |
| E224 | `The AI service returned an invalid response. Check the API address and protocol.` | — | The API address or protocol is misconfigured. | Check the provider, API address, protocol and model under Preferences › AI service connection, then retry. |
| E225 | `The AI response does not match the selected protocol` | — | The provider uses a different protocol from the one configured. | Check the provider, API address, protocol and model under Preferences › AI service connection, then retry. |
| E226 | `Unsupported AI address scheme` | 400 | The API address is neither https nor local http. | Check the provider, API address, protocol and model under Preferences › AI service connection, then retry. |
| E227 | `The AI address points to a reserved network. Check DNS; trusted model hosts on a server must be configured by the deployer.` | 403 | The address resolves to a private or reserved network; the server refuses it to prevent misuse. | Check the DNS record. If an internal model host is required, the deployer must configure it as trusted on the server. |
| E228 | `The AI response exceeded the size limit` | — | The provider returned too much data. | Start a new conversation or ask for a shorter answer. |
| E229 | `The AI service returned an invalid response` | — | The provider's response could not be read. | Check the provider, API address, protocol and model under Preferences › AI service connection, then retry. |
| E230 | `Select a service and enter the API key first` | — | The AI service has not been configured. | Check the provider, API address, protocol and model under Preferences › AI service connection, then retry. |
| E231 | `Enter the API key` | — | The API key is empty. | Check the provider, API address, protocol and model under Preferences › AI service connection, then retry. |
| E232 | `The model list is invalid. Check the API base address and protocol.` | — | The model list could not be read. | Check the provider, API address, protocol and model under Preferences › AI service connection, then retry. |
| E233 | `The model list does not match the selected protocol. Check the API base address.` | — | The model list format differs from the selected protocol. | Check the provider, API address, protocol and model under Preferences › AI service connection, then retry. |
| E234 | `AI settings require a signed-in session` | 403 | AI settings were called with an API key; they require a signed-in session. | Sign in to the app and change it there. |
| E235 | `The request includes an AI plugin the administrator has not enabled` | 403 | The request uses a plugin that is not enabled. | Ask the super administrator to perform this operation or to grant you the required permission. |
| E236 | `Web search is not configured. An administrator must enter a Tavily key.` | — | The web search plugin has no service key. | Ask the super administrator to perform this operation or to grant you the required permission. |
| E237 | `Search terms must be 1–500 characters` | — | The search terms are empty or too long. | Correct the entry as described and submit again. |
| E238 | `The search service returned an invalid response` | — | The search service response could not be read. | Retry later. If it keeps happening, note the time and the steps taken and report it. |
| E239 | `Invalid conversation ID` | 400 | The conversation ID is malformed. | Start a new conversation. |
| E240 | `The conversation does not exist or has expired` | 404 | The conversation was cleared after its retention period. | Start a new conversation. |
| E241 | `An administrator must configure the AI service first` | 400 | The studio has no AI service configured. | Ask the super administrator to perform this operation or to grant you the required permission. |
| E242 | `The assistant does not accept tool results or key settings from the client` | 403 | The request tried to submit tool results or keys directly and was refused. | Correct the request according to the API reference and send it again. |
| E243 | `Invalid interface language` | 400 | The requested language is neither Chinese nor English. | Correct the request according to the API reference and send it again. |
| E244 | `Invalid confirmation state` | 400 | The confirmation is missing approve or cancel. | Correct the request according to the API reference and send it again. |
| E245 | `The pending operation does not exist or was already handled` | 409 | The operation was already confirmed, cancelled or expired. | Refresh to load the latest data, check it, then try again. |
| E246 | `Your permissions do not allow this operation` | 403 | The proposed operation exceeds your permissions. | Ask the super administrator to perform this operation or to grant you the required permission. |
| E247 | `The client confirmation contains unsupported fields` | 403 | The confirmation form submitted client fields that are not allowed. | Correct the request according to the API reference and send it again. |
| E248 | `Confirm or cancel the pending operation first` | 409 | An operation proposed by the assistant is awaiting your decision. | Confirm or cancel it in the conversation before sending a new message. |
| E249 | `Messages must be 1–8000 characters` | 400 | The message is empty or too long. | Correct the entry as described and submit again. |
| E250 | `The model requested a plugin that is not enabled` | 403 | The model tried to use a feature that is not enabled; the app refused. | No action needed. To allow it, an administrator can enable the plugin. |
| E251 | `The model returned client fields it may not access` | 403 | The model tried to read or write protected client fields; the app refused. | No action needed; client details must be entered by a person in the interface. |
| E252 | `Operation cancelled` | 409 | The conversation or operation was cancelled before it finished. | No action needed. |
| E253 | `This plugin has been disabled` | 403 | An administrator disabled the plugin. | Ask the super administrator to perform this operation or to grant you the required permission. |
| E254 | `Choose a city in the shoot calendar first` | 400 | Weather requests need a city. | Choose a city in the shoot calendar, then retry. |
| E255 | `The search terms contain private information. Use public terms.` | 403 | The search terms contain client names, contact details or other private data and were not sent to the external service. | Remove the private information and search again. |
| E256 | `The previous assistant request is still running. Please wait.` | 409 | A request in the same conversation is still running. | Wait for the previous reply to finish. |
| E257 | `Invalid tool parameter: {1}` | — | A parameter from the model is invalid; {1} is its name. | Rephrase the request. |
| E258 | `Tool parameter must be true or false: {1}` | — | The parameter must be a yes/no value. | Rephrase the request. |
| E259 | `Tool parameter must be a finite number: {1}` | — | The parameter must be a number. | Rephrase the request. |
| E260 | `Tool parameter out of range: {1}` | — | The parameter is out of range. | Rephrase the request. |
| E261 | `Tool parameters must be an object` | — | The model's parameters are malformed. | Rephrase the request. |
| E262 | `Unsupported tool parameter: {1}` | — | The model supplied a parameter that is not allowed. | Rephrase the request. |
| E263 | `Missing tool parameter: {1}` | — | The model left out a required parameter. | Add the missing detail to your request and retry. |
| E264 | `The AI may not call extension commands` | 403 | The model tried to call an extension command and was refused. | No action needed. |
| E265 | `The AI command contains client fields it may not access` | 403 | The model tried to write protected client fields and was refused. | Client details must be entered by a person in the interface. |
| E266 | `The assistant request could not be completed.` | — | The AI service or network had a problem. | Check the provider, API address, protocol and model under Preferences › AI service connection, then retry. |

## Voice

| No. | Message | Status | Meaning | Resolution |
| --- | --- | --- | --- | --- |
| E267 | `Speech-recognition model source mismatch` | — | The download address is not the official source the app expects. | Reinstall the voice components in the app with a working network and enough free disk space. |
| E268 | `Speech-recognition model download failed (HTTP {1})` | — | The model download server returned an error status. | Check the network connection and reinstall; the number is the server's status code. |
| E269 | `Unexpected speech-recognition model size` | — | The downloaded model has an unexpected size and may be incomplete. | Reinstall the voice components in the app with a working network and enough free disk space. |
| E270 | `Speech-recognition model archive failed verification` | — | The model archive checksum does not match the official release. | Reinstall the voice components in the app with a working network and enough free disk space. |
| E271 | `Speech-recognition model file failed verification: {1}` | — | An extracted model file has an unexpected checksum. | Reinstall the voice components in the app with a working network and enough free disk space. |
| E272 | `Voice component installation did not finish. Retry.` | — | The installation was interrupted. | Reinstall the voice components in the app with a working network and enough free disk space. |
| E273 | `Voice component installation did not finish. Check the network and free space, then retry.` | — | Download or extraction stopped, usually because of a network interruption or low disk space. | Reinstall the voice components in the app with a working network and enough free disk space. |
| E274 | `Voice installer failed verification` | — | A component required for installation has an unexpected checksum. | Reinstall the voice components in the app with a working network and enough free disk space. |
| E275 | `Voice component verification failed` | — | The post-installation self-check failed. | Reinstall the voice components in the app with a working network and enough free disk space. |
| E276 | `Invalid recording format` | 400 | The recording is not 16 kHz mono PCM or cannot be read. | Record again; when using the API, submit audio as described in the API reference. |
| E277 | `Recordings must be 0.1–30 seconds long` | 400 | The recording is too short or too long. | Keep each recording under 30 seconds and speak in parts. |
| E278 | `Speech recognition is unavailable` | 503 | The speech-recognition model is not installed or failed to load. | Install the speech-recognition component in the app. |
| E279 | `Speech recognition is busy. Retry shortly.` | 429 | Recognition and synthesis share one processing slot, which is in use. | Wait for the current voice task to finish, then retry. |
| E280 | `The voice engine is busy. Retry shortly.` | 429 | Recognition and synthesis share one processing slot, which is in use. | Wait for the current voice task to finish, then retry. |
| E281 | `Speech recognition timed out. Retry.` | — | Recognition did not finish in time, often because the computer is busy. | Retry later. If it keeps happening, note the time and the steps taken and report it. |
| E282 | `Speech recognition failed. Retry.` | — | The recognition process failed. | Retry later. If it keeps happening, note the time and the steps taken and report it. |
| E283 | `Speech recognition stopped` | — | The recognition process was stopped, for example while the app was closing. | Retry later. If it keeps happening, note the time and the steps taken and report it. |
| E284 | `Configure the voice release resource directory` | 503 | The server cannot find the release resources needed for speech synthesis. | The person who deployed the server should check the configuration against the Deployment manual and restart the service. |
| E285 | `Voice settings require a signed-in session` | 403 | Voice settings were called with an API key; they require a signed-in session. | Sign in to the app and change it there. |
| E286 | `The voice engine timed out while starting. Retry.` | — | The speech-synthesis engine did not start in time. | Retry later. If it keeps happening, note the time and the steps taken and report it. |
| E287 | `Speech generation failed. Retry.` | — | Speech synthesis failed. | Retry later. If it keeps happening, note the time and the steps taken and report it. |
| E288 | `The voice engine cannot start. Reinstall the voice components.` | — | The speech-synthesis components are missing or damaged. | Reinstall the voice components in the app with a working network and enough free disk space. |
| E289 | `Text to read aloud must be 1–600 characters` | 400 | The text is empty or too long. | Correct the entry as described and submit again. |
| E290 | `Install the voice components first` | 503 | The speech-synthesis components are not installed. | Install them under Preferences › Assistant voice and identity. |
| E291 | `This voice is not installed in the speech model` | 409 | The selected voice has no matching model files yet. | Choose an installed voice or reinstall the voice components. |
| E292 | `Speech generation timed out. Shorten the text and retry.` | — | Synthesis did not finish in time because the text is long or the computer is busy. | Shorten the text and retry. |
| E293 | `Speech output exceeded the resource budget` | 503 | The generated audio exceeded the size allowed per request. | Shorten the text and retry. |
| E294 | `The reply is long; read the rest as text.` | — | The reply is longer than automatic read-aloud allows; the rest is not read aloud. | Read the full text in the conversation. |
| E295 | `Cancelled` | — | Reading aloud or voice processing was cancelled. | No action needed. |
| E296 | `Configure the AI service first` | 400 | Speech synthesis needs an AI service configured first. | Check the provider, API address, protocol and model under Preferences › AI service connection, then retry. |

## Desktop app

| No. | Message | Status | Meaning | Resolution |
| --- | --- | --- | --- | --- |
| E297 | `Untrusted caller` | — | A desktop call did not come from one of the app's own windows. | This is an internal safety check that normal use does not trigger. Restart the app; if it persists, report it with the logs. |
| E298 | `Only the main window can set up the studio` | — | A setup request came from a secondary window such as the floating orb. | Create the studio from the main window. |
| E299 | `Only the main window can change preferences` | — | A preference change came from a secondary window. | Change it in Preferences in the main window. |
| E300 | `Invalid preference format` | — | The desktop preference file or request is incomplete. | This is an internal safety check that normal use does not trigger. Restart the app; if it persists, report it with the logs. |
| E301 | `Invalid calling window` | — | The window that made the call has closed or is unavailable. | Close and reopen the window, then retry. |
| E302 | `Unsynchronised drafts cannot be decrypted. Keep the original file and check the key.` | — | Unsynchronised drafts saved on this device cannot be opened with the current system key, usually after a change of system account or a reinstall. | Do not delete the draft file. Open the app under the original system account, or discard the drafts. |
| E303 | `Read-only accounts cannot save drafts` | — | The current account can only view records. | Ask the super administrator to perform this operation or to grant you the required permission. |
| E304 | `Invalid draft format` | — | The draft is incomplete or damaged. | This is an internal safety check that normal use does not trigger. Restart the app; if it persists, report it with the logs. |
| E305 | `Unauthorised IPC caller` | — | A desktop inter-process call came from an unauthorised page. | This is an internal safety check that normal use does not trigger. Restart the app; if it persists, report it with the logs. |
| E306 | `Unable to read removable storage` | — | The system did not return a list of removable storage devices. | Check that the memory card or reader is connected, then retry. |
| E307 | `Invalid order ID` | — | The requested order ID is malformed. | Refresh to load the latest data, check it, then try again. |
| E308 | `Order unavailable or its records have been cleared` | — | The order was deleted, or its client records and proof were cleared under the retention policy. | Cleared orders keep amounts only; their proof can no longer be viewed. |
| E309 | `Invalid encryption format` | — | Local encrypted data is not in this app's format or is damaged. | This is an internal safety check that normal use does not trigger. Restart the app; if it persists, report it with the logs. |
| E310 | `System secure storage is unavailable, so encrypted business storage cannot start` | — | The operating system's credential protection is unavailable, so the app cannot obtain its local encryption key. | Sign in to Windows with your usual account and open the app again; do not run it as another user. |
| E311 | `The current account cannot perform this desktop operation` | — | This desktop feature requires a higher role. | Ask the super administrator to perform this operation or to grant you the required permission. |
| E312 | `Unable to open the encrypted studio` | — | The app could not obtain its local encryption key at start-up. | Sign in to Windows with your usual account and open the app again. |
| E313 | `Start-up failed` | — | The local service did not start in time. | Close and reopen the app; if it still fails, restart the computer. |
| E314 | `The local service timed out while starting. Reopen the app.` | — | The local service did not start in time, often because the computer is busy or security software blocked it. | Close and reopen the app; if needed, allow it in your security software. |

## Command panel

| No. | Message | Status | Meaning | Resolution |
| --- | --- | --- | --- | --- |
| E315 | `The command is too long` | — | The command exceeds the length limit. | Split it into several commands. |
| E316 | `Unclosed quotation mark` | — | A quotation mark in the command is not closed. | Add the missing quotation mark. |
| E317 | `The command panel is for signed-in super administrators only` | 403 | The account is not a super administrator, or an API key was used. | Ask the super administrator to perform this operation or to grant you the required permission. |
| E318 | `Wrong number of arguments. Use Help to see the fixed syntax.` | 400 | The command has too many or too few arguments. | Enter Help, or Help followed by a module name, to see the fixed syntax. |
| E319 | `The argument must be a whole number` | 400 | The argument is not a whole number. | Enter Help, or Help followed by a module name, to see the fixed syntax. |
| E320 | `The argument must be from {1} to {2}` | 400 | The argument is out of range. | Enter Help, or Help followed by a module name, to see the fixed syntax. |
| E321 | `Percentages must be 0–100 with up to two decimals` | 400 | The percentage is out of range or has too many decimals. | Enter Help, or Help followed by a module name, to see the fixed syntax. |
| E322 | `Switches must be On or Off` | 400 | A switch argument has an invalid value. | Enter Help, or Help followed by a module name, to see the fixed syntax. |
| E323 | `Mode must be Personal or Team` | 400 | The mode argument has an invalid value. | Enter Help, or Help followed by a module name, to see the fixed syntax. |
| E324 | `The start must be Delivery, Shoot or Created` | 400 | The retention start argument has an invalid value. | Enter Help, or Help followed by a module name, to see the fixed syntax. |
| E325 | `Unknown settings field` | 400 | The settings command uses a field that does not exist. | Enter Help, or Help followed by a module name, to see the fixed syntax. |
| E326 | `The account ID does not exist` | 400 | The account ID in the command does not exist. | Use the account listing command to find the correct ID. |
| E327 | `AI requests can be up to 4,000 characters` | 400 | The request is too long. | Correct the entry as described and submit again. |
| E328 | `Configure a model in the app first` | 400 | AI drafting in the command panel needs an AI service. | Check the provider, API address, protocol and model under Preferences › AI service connection, then retry. |
| E329 | `Type an uppercase Y to confirm` | 400 | The confirmation was not an uppercase Y. | Type an uppercase Y to run it, or cancel. |
| E330 | `The preview has expired. Submit it again.` | 409 | Too much time passed after the preview. | Submit the command again and confirm. |
| E331 | `Business rules have changed. Preview again.` | 409 | Someone changed the related rules after the preview. | Preview again, then confirm. |
| E332 | `Business records have changed. Preview again.` | 409 | Someone changed the related records after the preview. | Preview again, then confirm. |
| E333 | `Enter a command` | 400 | The command is empty. | Enter Help, or Help followed by a module name, to see the fixed syntax. |
| E334 | `Up to 50 commands at a time` | 400 | Too many commands were submitted at once. | Submit them in batches. |
| E335 | `The native interpreter is available only to registered maintenance plugins. No handler matched; nothing is passed to the system shell.` | 400 | The input is not a Studio command; it is never passed to the system shell. | Enter Help, or Help followed by a module name, to see the fixed syntax. |
| E336 | `The module does not exist` | 400 | The module name does not exist. | Enter Help, or Help followed by a module name, to see the fixed syntax. |
| E337 | `Help takes at most one module name` | 400 | Help was given more than one argument. | Enter Help, or Help followed by a module name, to see the fixed syntax. |
| E338 | `Order queries take at most one keyword` | 400 | The query has more than one keyword. | Wrap a keyword containing spaces in quotation marks. |
| E339 | `Create commands need field and value pairs` | 400 | Fields and values are not in pairs. | Enter Help, or Help followed by a module name, to see the fixed syntax. |
| E340 | `Duplicate or unsupported command field` | 400 | A field repeats or is not supported by this command. | Enter Help, or Help followed by a module name, to see the fixed syntax. |
| E341 | `Invalid order field` | 400 | The order update uses a field that cannot be changed. | Enter Help, or Help followed by a module name, to see the fixed syntax. |
| E342 | `Invalid task type` | 400 | The task type must be shoot or editing. | Enter Help, or Help followed by a module name, to see the fixed syntax. |
| E343 | `Invalid catalogue type` | 400 | The catalogue type does not exist. | Enter Help, or Help followed by a module name, to see the fixed syntax. |
| E344 | `The command does not belong to this module or its syntax is wrong. Enter Help.` | 400 | The command does not match the current module. | Enter Help, or Help followed by a module name, to see the fixed syntax. |
| E345 | `Invalid weather service key` | 400 | The key is empty, too short or contains characters such as spaces. | Paste only the key issued by the provider. |
| E346 | `Invalid weather endpoint address` | 400 | The address is not a complete URL, or contains credentials or a # fragment. | Enter the full endpoint, for example https://weather.example.com/v1/forecast; set the key separately with Weather Key. |
| E347 | `The endpoint type must be Forecast, AirQuality or Geocoding` | 400 | The first argument of Endpoint is not a supported type. | Enter Help, or Help followed by a module name, to see the fixed syntax. |

## API

| No. | Message | Status | Meaning | Resolution |
| --- | --- | --- | --- | --- |
| E348 | `Invalid command format` | — | The business command has no type or payload. | Correct the request according to the API reference and send it again. |
| E349 | `Unregistered business command` | — | The command name is not supported. | Correct the request according to the API reference and send it again. |
| E350 | `Unregistered command` | 404 | The command name is not supported. | Correct the request according to the API reference and send it again. |
| E351 | `Invalid or already registered extension ID` | — | The extension ID is malformed or already in use. | Give the extension a unique ID. |
| E352 | `Extension commands must use their own namespace` | — | An extension command name does not start with the extension ID. | Name the command extensionId.command. |
| E353 | `Invalid or duplicate hardware driver ID` | — | The hardware driver ID is malformed or duplicated. | Give the driver a unique ID. |
| E354 | `The family interface currently allows read-only queries only` | 405 | A write request was sent to the family interface. | Use GET queries only. |
| E355 | `Incompatible family protocol version` | 426 | The connecting software uses an unsupported protocol version. | Update the connecting software as described in the family integration guide. |
| E356 | `Family interface not found` | 404 | The requested family interface path does not exist. | Correct the request according to the API reference and send it again. |
| E357 | `Hardware interface not found` | 404 | The requested hardware interface path does not exist. | Correct the request according to the API reference and send it again. |
| E358 | `Request method not supported` | 405 | The endpoint does not support this HTTP method. | Correct the request according to the API reference and send it again. |
| E359 | `Request too large` | 413 | The request body exceeds the size limit. | Reduce the upload size and retry. |
| E360 | `Empty request` | 400 | The request body is empty. | Correct the request according to the API reference and send it again. |
| E361 | `The request contains unsafe fields` | 400 | The request contains fields such as __proto__ that could tamper with the program. | Correct the request according to the API reference and send it again. |
| E362 | `The request must be a JSON object` | 400 | The request body is not a JSON object. | Correct the request according to the API reference and send it again. |
| E363 | `Invalid revision` | 400 | revision is not a non-negative whole number. | Read the latest data and use the revision it returns. |
| E364 | `Invalid Idempotency-Key` | 400 | The idempotency key is empty or too long. | Correct the request according to the API reference and send it again. |
| E365 | `The earlier request expired with the privacy cleanup and cannot be repeated` | 409 | The repeated request concerns an order that has been cleared. | Reload the data and send a new request for the current state. |
| E366 | `The same idempotency key cannot be used for different requests` | 409 | The same Idempotency-Key was sent with a different request body. | Generate a new key for each new request. |
| E367 | `Provide a valid latitude and longitude` | 400 | The weather request has missing or invalid coordinates. | Correct the request according to the API reference and send it again. |
| E368 | `Endpoint or method not found` | 404 | The path or method does not exist. | Correct the request according to the API reference and send it again. |
| E369 | `The stored response is too large. Reload the current business data.` | 409 | The stored result of the repeated request is too large to return. | Refresh to load the latest data, check it, then try again. |
| E370 | `Full synchronisation requires contacts:read; use /commands for safe order queries` | 403 | The API key cannot read full data. | Use /commands, or ask an administrator for the scope. |
| E371 | `API integrations write through the command endpoint and may not replace all business data` | 403 | An API key tried to replace all business data. | Write through POST /commands. |
| E372 | `The base revision is out of date. Read the latest data.` | 409 | The revision sent is not the latest; something changed in the meantime. | Read the data again, check it, and resubmit with the new revision. |
| E373 | `Write commands require the latest revision` | 409 | The write command has no revision or an outdated one. | Read the revision with GET /state and send it with the command; on 409, read again. |
| E374 | `Endpoint not found` | 404 | The requested path does not exist. | Correct the request according to the API reference and send it again. |

## Server and connection

| No. | Message | Status | Meaning | Resolution |
| --- | --- | --- | --- | --- |
| E375 | `Unsupported encrypted data format` | 500 | Encrypted data in the database is in an unrecognised format or damaged. | Make sure the same STUDIO_MASTER_KEY is in use; restore from a backup if needed. |
| E376 | `The server has no valid STUDIO_MASTER_KEY (32-byte Base64)` | 503 | The master key is not configured or is malformed. | The person who deployed the server should check the configuration against the Deployment manual and restart the service. |
| E377 | `The database transaction is temporarily unavailable. Retry.` | 503 | The database is busy or the connection dropped. | Retry later. If it keeps happening, note the time and the steps taken and report it. |
| E378 | `Configure DATABASE_URL or STUDIO_DATA_DIR` | 503 | No database location is configured. | The person who deployed the server should check the configuration against the Deployment manual and restart the service. |
| E379 | `The privacy journal directory is not configured` | 503 | The server has no writable data directory. | The person who deployed the server should check the configuration against the Deployment manual and restart the service. |
| E380 | `Privacy journal identity mismatch` | 503 | The deletion journal does not match this workspace; the data directory may have been swapped. | The person who deployed the server should check the configuration against the Deployment manual and restart the service. |
| E381 | `Production servers must configure STUDIO_ORIGINS` | 503 | The server has no allowed origins configured. | The person who deployed the server should check the configuration against the Deployment manual and restart the service. |
| E382 | `Untrusted service address` | 403 | The request Host is not in the allowed list. | Use the domain configured at deployment; the deployer can check STUDIO_ORIGINS. |
| E383 | `Origin not authorised` | 403 | The request came from an unauthorised site. | Use the domain configured at deployment. |
| E384 | `Weather endpoints must use HTTPS; a self-hosted service on the local network must be allowed by the deployer` | 403 | The configured endpoint uses HTTP. Only allowed hosts may use HTTP, to prevent interception. | Use an HTTPS address. For a self-hosted service on the local network, the deployer adds its host name to STUDIO_WEATHER_ALLOWED_HOSTS. |
| E385 | `The weather endpoint points to a private or reserved address; a self-hosted service must be allowed by the deployer` | 403 | The address resolves to a private network; the server refuses it so it cannot be used to probe internal systems. | Check the DNS record. For a self-hosted service on the internal network, the deployer adds its host name to STUDIO_WEATHER_ALLOWED_HOSTS. |
| E386 | `The request could not be completed.` | — | The service did not return a recognisable error. | Retry later. If it keeps happening, note the time and the steps taken and report it. |
| E387 | `The service returned an empty response.` | — | The service returned nothing, usually because the connection dropped. | Retry later. If it keeps happening, note the time and the steps taken and report it. |
| E388 | `The response exceeded the permitted size.` | — | The service returned too much data. | Retry later. If it keeps happening, note the time and the steps taken and report it. |
| E389 | `The connection was interrupted. Please retry.` | — | The network connection dropped during the request. | Check the network and retry. |
| E390 | `The service is temporarily unavailable. Contact your studio administrator.` | — | The server failed or is restarting. | The person who deployed the server should check the configuration against the Deployment manual and restart the service. |

This page is generated from `src/lib/error-catalog.ts` by `node scripts/generate-error-reference.cjs`. Do not edit it by hand.
