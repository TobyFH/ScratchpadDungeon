# Validation record

Validated in the cloud environment on 20 October 2026 with Node 24.19.0, Chromium 154.0.8037.57 and Electron 44.9.2.

- Clean `npm ci --ignore-scripts` completed from the committed lockfile; desktop runtime setup also completed.
- Full browser suite: **158 passed, zero failed/skipped**. This includes the existing 121 gameplay tests and 37 production tests.
- Pencil-art refresh: all six WebP sheets decode at their declared dimensions; frame bounds, distinct injury/corpse drawings, clipping and shared image resources are tested. Combat, traps, starter portraits and dark mode were inspected in Chromium at 1920×1080 and 1280×800. The desktop startup smoke also passed with the refreshed embedded artwork. Balance data and the designer workbook were unchanged.
- Default starter stats, reels, tier powers and all ten enemy-depth curves match the captured previous release. Thirty seeded maps/encounters across all depths also match. Existing campaign, save migration, death, inventory, critical and generation regressions pass.
- Production checks exercise a real edited workbook through validation and CLI import/rebuild, rejected imports without source changes, calculated workbook data, asset replacement/history, missing/unlisted/unused asset detection, audio pooling/settings, controller-only actions, pause and virtual input.
- Layouts are checked at 1920×1080, 1280×800 and 1280×720. Handheld menus keep at least 12 effective pixels for functional text; progress controls remain inside their panels. Affected existing layout/keyboard tests also passed after compact-menu adjustments.
- Additional focused checks passed after the final audio lifecycle hardening and licence-notice embedding. The generated HTML is deterministic, CSP-protected and self-contained. Spreadsheet/manifest validation and `git diff --check` pass.
- Native Linux x64 ZIP packaging succeeded. The unpacked game initialises 99 map tiles and its production services headlessly, resolves embedded offline assets and exposes no Node `require` to the renderer. The cloud smoke command uses a test-only sandbox override; shipped configuration keeps sandboxing enabled.

Screenshots and local build outputs are in ignored `test-results/` and `dist/desktop/`. Tests and packaging commands are documented in the linked workflow guides and CI configuration.

Physical controllers, Steam Input/overlay, SteamOS hardware, Windows/Proton, suspend/resume, handheld performance/battery behaviour and Steam depot installation remain manual release checks. No Steam upload or Valve verification was performed. The Steamworks documentation host returned HTTP 403 here; confirm Valve's current checklist through a partner account before submission.
