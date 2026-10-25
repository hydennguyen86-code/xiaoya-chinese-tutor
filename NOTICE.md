# Third-party material

The MIT license in `LICENSE` covers original app code, except the separately licensed `server/edgeGec.mjs` module described below. The bundled
sample avatars and the libraries below keep their own licenses.

## Bundled files

| File | Source | License |
|---|---|---|
| `public/avatars/brunette.glb` | Example avatar of [TalkingHead](https://github.com/met4citizen/TalkingHead), made with Ready Player Me | [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/): non-commercial use only |
| `public/avatars/lam-sample.zip` | `barbara.zip` sample from [OpenAvatarChat](https://github.com/HumanAIGC-Engineering/OpenAvatarChat) | Apache-2.0 |

Because of the Ready Player Me avatar, the repository **as shipped** is for
non-commercial use. Replace `brunette.glb` with your own avatar if you need
otherwise.

## Libraries and tools used at run time (not bundled)

| Project | Used for | License |
|---|---|---|
| [TalkingHead](https://github.com/met4citizen/TalkingHead) | 3D avatar, lip sync | MIT |
| [gsplat-flame-avatar-renderer](https://www.npmjs.com/package/@myned-ai/gsplat-flame-avatar-renderer) | LAM Gaussian avatar rendering | MIT |
| [three.js](https://threejs.org/) | 3D rendering | MIT |
| [pinyin-pro](https://github.com/zh-lx/pinyin-pro) | pinyin and tones | MIT |
| [whisper.cpp](https://github.com/ggml-org/whisper.cpp) and the Whisper models | local speech-to-text (downloaded by `npm run setup:whisper`) | MIT |
| [msedge-tts](https://www.npmjs.com/package/msedge-tts) | Microsoft Edge online voices | MIT; the voices are Microsoft's service |
| [Ollama](https://ollama.com/) / [LM Studio](https://lmstudio.ai/) and the model you choose (e.g. Qwen) | the tutor's replies and corrections | each model has its own license |
| [LAM](https://github.com/aigc3d/LAM) | making a LAM avatar from a photo (done outside this app) | see the LAM repository; its model weights have their own terms |

## Textbook

The daily lesson follows the order of lessons of 《体验汉语口语》 (Experiencing
Chinese: Oral Course) only through a table of contents that you type in
yourself (`data/syllabus/tiyan-hanyu-kouyu.json`, not in this repository). No
text, dialogue or exercise from the book is included; the practice material is
written by the local model.

## Edge GEC v2 compatibility module

`server/edgeGec.mjs` is a JavaScript port derived from
[rany2/edge-tts drm.py](https://github.com/rany2/edge-tts/blob/master/src/edge_tts/drm.py),
including the v2 work discussed in [upstream PR 492](https://github.com/rany2/edge-tts/pull/492).
The upstream DRM file is **LGPLv3**, not covered by the MIT exception for its
subtitle composer. Copyright belongs to rany and the edge-tts contributors.
Changes on 2026-10-24: JavaScript arithmetic/Buffer port, generic SHA rounds,
explicit timestamp argument and local reference-vector tests.

This module is distributed as separate, replaceable source under LGPL-3.0-only;
see [the upstream license](licenses/edge-tts-LGPL-3.0.txt) and
[GPLv3 incorporated by LGPLv3](licenses/GPL-3.0.txt). Keep these notices and the
module source with redistributed builds; users can replace the module and run
its tests without rebuilding the browser app. Other app files retain their
existing licenses. This server module is not bundled into the browser.

`selfsigned` and `qrcode` use MIT licenses; their dependency notices remain in
node_modules when installed. No new speech model is bundled. Whisper Windows
uses the upstream MIT release; downloaded GGML weights retain their upstream
terms and live outside tracked source.
Full notices for the newly bundled/generated-code dependencies are also kept
in [licenses/qrcode-MIT.txt](licenses/qrcode-MIT.txt) and
[licenses/selfsigned-MIT.txt](licenses/selfsigned-MIT.txt).

## Optional Common Voice listening corpus (not bundled)

Common Voice Scripted Speech is community-contributed speech labeled CC0-1.0.
Users obtain datasets themselves through Mozilla Data Collective under the
applicable access terms. For the user-provided Beijing Chinese 26.0 release,
the app respects the stated restriction against redistribution: audio is read
in place from an explicitly configured external folder, never copied into app
data, Git or dist, and unavailable to remote LAN clients. A private catalog
retains sentence and release provenance without speaker demographics. No
Common Voice audio is distributed with this app. See
[configuration and limitations](docs/COMMON-VOICE.md).

## Unihan Sino-Vietnamese readings

`src/data/hanviet-unihan.json` is derived from the Unicode **17.0.0**
[Unihan database](https://www.unicode.org/Public/17.0.0/ucd/Unihan.zip),
`Unihan_Readings.txt` **kVietnamese**, with simplified-character fallback via
`Unihan_Variants.txt` **kTraditionalVariant**. © 2025 Unicode, Inc.
Distributed under [Unicode License V3](licenses/Unicode-3.0.txt); the full
permission notice is retained. See [UAX #38](https://www.unicode.org/reports/tr38/)
for field definitions. The pinned archive SHA-256 and release version are
recorded in the generated JSON. Rebuild with `node scripts/build-hanviet.mjs`
and an official 17.0.0 Unihan.zip outside the repository.

The derived file retains multiple readings and the traditional characters used
for fallback. These are character readings, not context-resolved word readings,
modern Vietnamese translations or Mandarin pronunciation. Missing readings are
reported rather than guessed. DeepSeek's `hanviet-traps.json` is separately
labeled **AI soạn, chưa duyệt**; its two groups are semantic traps and approximate
sound mnemonics, not Unicode data or teacher-reviewed instruction.
The Unicode definition of kVietnamese is pronunciation(s) in Quốc ngữ; it does
not guarantee a complete or context-disambiguated Sino-Vietnamese dictionary.
The UI reports missing data and retains alternatives. It does not silently
replace absent entries with AI guesses.

For example, this pinned kVietnamese snapshot gives 你=nể and 好=háo;
these values are faithfully reported as **Vietnamese character readings**, not
asserted to be the standard Sino-Vietnamese word reading of 你好. AI-authored
Sino-Vietnamese mnemonics remain separately labeled and unreviewed.
