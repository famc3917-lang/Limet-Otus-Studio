# Third-party licensing and distribution materials

Version: V3.0.0.

AI assistance was used in the development of this software.

## Scope

Original code is GPL-3.0-only. Reviewed LGPL components are permitted; all third-party works retain their applicable terms. Brand and separate asset reservations, commercial terms and disclaimers do not limit rights granted by third-party licenses.

## Electron and Chromium

The project currently locks Electron 44.0.0. Its [MIT license](../../third-party/notices/electron/LICENSE) and [complete Chromium third-party notices](../../third-party/notices/electron/LICENSES.chromium.html) are retained separately. Unabridged upstream notices are also provided for [FFmpeg](../../third-party/notices/electron/ffmpeg.txt) and [WebKit / Blink](../../third-party/notices/electron/WebKit.txt).

The upstream aggregate includes material for multiple platforms; a notice entry does not establish inclusion in the Windows artifact. Review actual shipped files, linking relationships, build revisions and corresponding source. An npm license field or keyword count is insufficient.

### FFmpeg corresponding source

Electron 44.0.0 is based on Chromium 152.0.7977.54. The `ffmpeg.dll` in the installation folder is Chromium's FFmpeg build, distributed under the LGPL and loaded by dynamic linking, so it can be replaced with a compatible build of your own. The corresponding source is the [chromium/third_party/ffmpeg](https://chromium.googlesource.com/chromium/third_party/ffmpeg) revision pinned in that Chromium version's [DEPS](https://chromium.googlesource.com/chromium/src/+/refs/tags/152.0.7977.54/DEPS); Electron's build configuration is in [electron v44.0.0](https://github.com/electron/electron/tree/v44.0.0).

## npm dependencies

The npm packages in the installer and their licence texts are collected in [third-party/notices/npm/THIRD-PARTY-NOTICES.txt](../../third-party/notices/npm/THIRD-PARTY-NOTICES.txt), generated at packaging time by `scripts/third-party-notices.cjs`. They use MIT, Apache-2.0, ISC, BSD-3-Clause and similar licences; the browser-compatibility data `caniuse-lite` is CC-BY-4.0, attributed in the same file.

## Speech components

Speech models are not shipped with the installer; users download them from within the app. Licences:

| Component | Purpose | Licence | Licence text |
| --- | --- | --- | --- |
| sherpa-onnx-node 1.13.8 | Speech-recognition runtime | Apache-2.0 | Shipped with the npm package |
| SenseVoiceSmall INT8 | Speech-recognition model | FunASR Model Open Source License 1.1 | `speech/FunASR-MODEL-LICENSE.txt` |
| CosyVoice (code) | Speech-synthesis engine | Apache-2.0 | `tts/vendor/CosyVoice/LICENSE` |
| Matcha-TTS (code) | Speech-synthesis component | MIT | `tts/vendor/CosyVoice/third_party/Matcha-TTS/LICENSE` |
| CosyVoice-300M-SFT | Speech-synthesis model | Apache-2.0 | Model repository FunAudioLLM/CosyVoice-300M-SFT |
| uv 0.11.8 | Installs the Python runtime | MIT or Apache-2.0 | `tts/bin/LICENSE-MIT`, `tts/bin/LICENSE-APACHE` |
| PyTorch and other Python packages | Speech-synthesis inference | Their own licences | Versions locked in `tts/requirements-lock.txt` |

The CosyVoice code and uv are fetched at build time by `scripts/fetch-tts-bootstrap.cjs` at the versions pinned in `tts/RUNTIME.json`, and ship with the installer. The SenseVoiceSmall model is subject to its model licence; read it in full before redistributing.

## Redistribution

When you redistribute installers or modified versions of this software, observe the following:

1. Record the actual component, version, copyright holders, applicable license, source revision and modifications. An unmodified library is not exempt from distribution obligations.
2. Retain applicable license texts and notices in installers, portable packages and source packages. Link the in-app third-party notices to packaged files. For LGPL 3 components, include GPL 3 as well.
3. Provide the required corresponding source, including relevant patches and build/installation scripts. Prefer version-pinned source materials alongside the binary at the same release location, rather than a changing repository home page.
4. Provide the materials and procedure required for replacing, recombining or relinking modified libraries under the applicable terms. A DLL alone does not establish compliance.
5. Document library changes. Commercial terms must not prohibit reverse engineering permitted by the applicable LGPL to debug library modifications.
6. LGPL 3 may additionally require installation information. Review license versions, alternative licenses, exceptions and static linking individually.

References: [GNU LGPL FAQ](https://www.gnu.org/licenses/gpl-faq.en.html#LGPLStaticVsDynamic), [LGPL 2.1](https://www.gnu.org/licenses/old-licenses/lgpl-2.1.html), [LGPL 3](https://www.gnu.org/licenses/lgpl-3.0.en.html).

Copyright © 2026 FMLC.
