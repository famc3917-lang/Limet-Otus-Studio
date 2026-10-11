# Interface language

Chinese and English are available during registration and in Studio preferences. The choice is saved on the current device. Desktop menus and window titles follow the same language.

Switching languages changes interface text and built-in descriptions. Client names, notes, custom packages, voice names and other business inputs retain their original text. The selected voice determines speech language and assistant identity; changing the interface language does not select another voice.

Orders and the operations overview retain the studio currency. Switching the interface language neither converts amounts nor changes their currency. Automatic currency conversion is not provided.

Assistant requests include an optional `language` field (`zh` or `en`). The server validates it and applies it to that turn’s response instruction and weather descriptions. It does not grant permissions or alter the selected voice. When the field is omitted, Chinese is used. Existing conversation messages retain their original text.

## Print templates

Chinese and English booking forms, order confirmations and payment summaries are saved separately. English initially uses its own default copy; existing Chinese templates are retained. Switching language does not translate or overwrite saved custom terms. Unsaved drafts are retained per language within the current page; save before leaving. Restore original resets only the current language template and takes effect after saving. Printed amounts retain the studio currency.

Operational references use bilingual FTS5 keyword retrieval. English conversations receive English entries. The index contains built-in software instructions and does not load a neural retrieval model. Actual tool definitions are supplied for each turn.
