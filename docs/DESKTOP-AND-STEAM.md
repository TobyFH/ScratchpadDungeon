# Desktop builds, Steam and Steam Deck

The architecture assessment in [ARCHITECTURE.md](ARCHITECTURE.md) preceded packaging: retain the offline HTML and use Electron to preserve Chromium rendering, Gamepad API and Web Audio behaviour. Ship native Linux x64 for Steam Deck/SteamOS and Windows x64 for Windows and an explicitly tested Proton fallback. Electron is larger than a WebKit wrapper; a new-engine port would create much greater gameplay risk.

## Build

Use Node 22+ and the committed lockfile. Python 3 is needed only to regenerate placeholder audio.

```sh
npm ci --ignore-scripts
npm run build
npm run validate
npm test
npm run desktop:setup
npm run desktop:start
npm run desktop:dist:linux
npm run desktop:dist:win
```

`desktop:setup` downloads the pinned official Electron runtime with its checksum verification intact. It uses the environment's HTTPS proxy when configured and a project-local cache. Browser tests use `CHROMIUM_PATH`, `/usr/bin/chromium`, or Playwright's installed Chromium. On a fresh machine without either, run `npx playwright install --with-deps chromium` (system dependency installation may require administrator privileges).

Linux output is `dist/desktop/Scratchpad-Dungeon-1.1.0-x64-linux.zip`; the unpacked executable is `dist/desktop/linux-unpacked/scratchpad-dungeon`. Windows output is the corresponding `windows.zip` / `win-unpacked/`. A Windows cross-build requires downloading its runtime and possibly builder helpers; native Windows testing/signing still requires a Windows build/test machine. ZIP builds deliberately avoid an extra installer/launcher. They are appropriate depot inputs; Steam distributes the unpacked directory, not the ZIP itself.

No Node APIs are exposed to game code. The desktop window uses context isolation, renderer sandboxing, restrictive CSP, denied permission requests, blocked remote navigation/new windows/webviews, and a narrow preload bridge for fullscreen and quitting. Production launch commands do **not** disable sandboxing. Do not add `--no-sandbox` to Steam launch settings.

A headless cloud smoke check can be run against an unpacked Linux build:

```sh
XDG_CACHE_HOME=/tmp/scratchpad-runtime-cache SCRATCHPAD_SMOKE_TEST=1 \
  dist/desktop/linux-unpacked/scratchpad-dungeon \
  --no-sandbox --headless --ozone-platform=headless --disable-gpu \
  --user-data-dir=/tmp/scratchpad-electron-test
```

The sandbox override above is confined to the constrained cloud test runner. The smoke check exits nonzero if the game fails to initialise its map/services, loses offline assets, or exposes Node to the renderer. It does not replace a normal sandboxed launch on a desktop/Deck.

## Steam setup (manual partner steps)

1. Create/use your Steamworks App ID and Linux/Windows depots. Replace placeholders in `desktop/steam-depot-example.vdf`; do not commit credentials or auth tickets.
2. In Steamworks Installation → General Installation, configure Linux executable `scratchpad-dungeon` and Windows executable `Scratchpad Dungeon.exe`, with OS-specific launch options. Set the game directory to the corresponding unpacked output. Use the native Linux build as the SteamOS choice; validate an explicit Windows/Proton configuration separately.
3. Upload through your authorised SteamCMD build account, keep the first build on a private testing branch, then install through the real Steam client. The example VDF never sets a public branch live.
4. Configure a standard gamepad Steam Input profile. Avoid simultaneous keyboard-emulation and gamepad mappings that trigger duplicate actions. The game handles standard XInput-style emulation; native Steam Input API action sets are not integrated.
5. Test overlay, fullscreen, launch/exit, offline mode, saves, suspend/resume and updates through Steam. Supply store capsule/library/controller artwork and any required Windows signing separately. Achievements/cloud saves/Steamworks SDK authentication are not implemented or required for the offline build; they need a separate integration if desired.

The Electron app stores browser saves/settings in its platform-specific user-data directory (`app.getPath('userData')`). Standalone-browser saves are separate and are not silently copied into the desktop app. Do not configure Steam Cloud until save migration, conflict behaviour and cross-platform paths have been designed and tested.

## Deck target and release checklist

Targets are based on Valve's published compatibility categories, not a claim of official verification:

| Category      | Implementation / remaining verification                                                                                                                           |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Resolution    | Readable compact layout at 1280×800 and 1280×720; original responsive notebook at larger sizes                                                                    |
| Legibility    | Main compact labels 14–27 CSS px, smallest functional labels 12 px; no global page zoom in Deck mode; inspect on actual handheld hardware                         |
| Input         | Controller actions, modal focus, configurable bindings/deadzones, device prompts, controller-only menu/party/bag/editor use; test Steam Input routing on hardware |
| Text input    | Current game needs no typing; controller-operated virtual keyboard is available for text fields                                                                   |
| Launch        | Direct game executable, no keyboard-dependent launcher; Deck fullscreen detected from SteamDeck environment flags or `--steam-deck`                               |
| Compatibility | Native Linux package builds and initialises; real SteamOS, Proton, driver and overlay tests remain manual                                                         |
| Performance   | Check 30/60 FPS, battery/power draw, thermal behaviour and particle-heavy criticals on Deck; browser automation is not a hardware performance result              |
| Suspend       | Audio backgrounds/returns with page visibility; verify sleep, controller reconnect and resumed saves on hardware                                                  |
| Runtime       | Install through Steam and test offline; use Steam Linux Runtime/container settings appropriate to the chosen executable and current Steamworks guidance           |

Published references: https://partner.steamgames.com/doc/steamdeck/compat and https://partner.steamgames.com/doc/steamdeck/recommendations . This cloud environment received HTTP 403 from that documentation host, so the current checklist must be confirmed in your Steamworks account before submission. **Only Valve can assign Steam Deck Verified status.** No Steam upload or public release is performed by these scripts.
