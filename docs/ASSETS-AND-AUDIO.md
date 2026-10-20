# Assets and audio

`data/assets.json` is the asset registry. Each entry has a stable ID, active path, retained original path, type, declared usage, replacement status, content checksum and licence information. The active illustrations are detailed graphite sprite sheets with healthy, injured and fallen variants. Original SVG illustrations remain available as retained placeholders. See [pencil art provenance and sheet layout](../assets/PENCIL-ART.md). The manifest also stores extracted SVG reference files, the embedded font and deterministic synthesized WAV placeholders. Drawing primitives such as particle positions, health bars and animated beams are renderer code, not external assets.

Build embeds manifest assets into `index.html`. Runtime icons, portraits, corpses, floor illustrations, traps, font, paper texture, SFX and music resolve through their manifest IDs. The desktop package needs no asset server. There is no runtime download or paid audio service.

## Replace an asset

```sh
npm run assets:audit
npm run assets:replace -- --id portrait.fighter --file /path/to/fighter.png --licence "Artist name; licensed for this project"
npm run assets:replace -- --id sfx.damage --file /path/to/hit.wav --licence "CC0-1.0; source URL"
npm run build
npm run validate
```

Use `--licence-file assets/licences/your-licence.txt` if you have added licence text to the project. The original remains at `originalPath`; previous replacement files are retained under `previousPaths`. Content-hashed replacement filenames avoid overwriting earlier versions. The entry records the original licence separately when replaced. Commit the replacement, manifest and generated HTML together. Referenced licence notices are embedded as inert text in the standalone HTML and retained in desktop builds.

To revert, set the entry's `path` back to `originalPath`, restore its original licence and original render mode (`icon` or `procedural` for original drawings; `file` for font/audio), and set `replacementStatus` to `placeholder`. Move the displaced active replacement path into `previousPaths` if retaining it. Then run `npm run assets:sync` and rebuild. For graphical edits, use `assets:replace` to activate your edited file; procedural reference SVGs preserve their dynamic placeholder renderer until explicitly replaced. For intentional edits to active files, `assets:sync` refreshes checksums after validation; do not use it to conceal unexpected changes.

Supported replacements: basic SVG, PNG/JPEG/WebP, WAV/OGG/MP3, TTF/WOFF2. The importer rejects path traversal, escaped symlinks, oversized files and scripted/external SVG content. Complex SVGs should be flattened to basic paths or exported as PNG. Portraits use a 120×150 viewBox, icons/floors 32×32, and trap art 200×90. The default pencil sheets use validated atlas frames, shared offline resources and health-state frames. They are embedded once per sheet in the standalone HTML and decoded once per resource in the renderer. Individual replacements override a frame without editing the sheet. Replaced art is rendered as a contained image; animated injury drawing layers in the procedural placeholder are not automatically recreated in a single static replacement. Health bars, condition badges and injury labels still apply.

`assets:audit` detects missing/invalid assets, checksum mismatches and files absent from the manifest, while separately listing intentionally retained originals. It also reports manifest entries with no static reference or supported dynamic rendering family as unused candidates (including retained obsolete icons); review these before removing them. Declared usage describes dynamic families (for example every enemy corpse); not encountering a rare asset during one playthrough does not mean it is unused. Add every new runtime file to the manifest and reference its ID. The build also validates balance-to-asset references. Runtime resolution/decode failures appear as actionable diagnostics; the game continues with a placeholder or silence when possible.

## Audio service

`src/production/audio.js` owns Web Audio. Independent master/SFX/music gain buses feed a limiter. Sixteen reusable effect voice slots bound simultaneous playback; per-cue cooldowns and priorities control overlap/stealing. Clips are decoded once, field/battle loops crossfade, pause ducks music, and background tabs mute. Options → Audio controls volume and mute, saved separately from run saves. Browser audio requires a gesture; the desktop shell permits gamepad startup without a mouse gesture.

Manifest audio metadata includes volume, priority, cooldown, and music loop points. Update loop points when replacing a track; they must fit its duration. The decoder reports invalid or unsupported audio. `npm run audio:generate` uses Python's standard library to regenerate deterministic CC0 temporary effects and two 16-second ambient loops. It preserves active replacement metadata and updates only placeholder entries. Originals remain available. These are simple synthesized placeholders, not polished compositions.

The Patrick Hand font retains its complete SIL Open Font License in `assets/fonts/OFL.txt` and the downloaded HTML. Project illustration rights were not specified by the repository; the manifest explicitly records that uncertainty rather than inventing a licence. See `assets/LICENCES.md`.
