# Production architecture assessment

The starting project is a single HTML file: inline CSS, one non-module JavaScript program, embedded Patrick Hand font, generated SVG illustrations, canvas particles, DOM-driven scenes and localStorage saves. There is no server, external runtime dependency, audio subsystem, gamepad input, asset catalogue or build pipeline. Combat and world values are distributed across functions. Playwright exercises the real browser game and a ten-floor campaign.

## Chosen approach

Keep the existing mechanics and generated standalone HTML. Split authoring into `src/game.js`, `src/game.css`, a template and production service modules. `data/balance.json` is the authoritative gameplay data; the Excel workbook is an editable export, never a second runtime source. Import validates the complete workbook before atomically updating data and regenerating HTML. `data/assets.json` owns asset identity and replacement paths. Build embeds every referenced asset, so downloaded HTML remains offline-capable.

Production services own asset resolution, Web Audio playback and action-based input. They receive a narrow bridge to existing gameplay functions; input and sound do not introduce gameplay RNG draws. Save compatibility and default tuning are retained and checked against a captured baseline.

## Desktop recommendation, made before packaging implementation

Use a hardened Electron shell around the generated HTML, with a native Linux x64 build as the Steam Deck primary target and Windows x64 for Windows/Proton testing. This preserves Chromium's current SVG, canvas, Web Audio and Gamepad behaviour. A port to another game engine would be a much larger gameplay regression risk. Tauri would reduce package size but introduce Rust/WebKit and platform-specific browser behaviour. Electron's larger runtime is the trade-off.

The renderer has no Node access, uses context isolation and sandboxing, permits no remote navigation, and exposes only narrow desktop operations through preload. No Steamworks SDK integration is required for ordinary offline play or standard gamepad emulation. Steam achievements, cloud saves, overlay compatibility and store/depot uploads need a Steamworks partner account, an App ID and real Steam client testing.

## Steam Deck scope

Target Valve's published compatibility categories: controller-only operation and gamepad prompts; 1280×800 / 1280×720 presentation; readable text (12 px minimum, 18 px preferred where practical); no keyboard-dependent launcher; text input support when needed; and a working SteamOS build or tested Proton path. The project does not claim official Deck verification. Only Valve can assign that result.

Reference: https://partner.steamgames.com/doc/steamdeck/compat and https://partner.steamgames.com/doc/steamdeck/recommendations . The documentation host returned HTTP 403 from this execution environment; confirm the current checklist in Steamworks before submission. Hardware, Steam Input profiles, overlay interaction, battery/performance and suspend/resume still require real Deck testing.
