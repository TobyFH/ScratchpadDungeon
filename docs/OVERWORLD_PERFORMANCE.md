# First overworld performance pass

This is a bounded presentation optimisation, not a balance or quality change.
No particle count, lifetime, art path, texture, animation speed, movement rule,
event chance, input path or save format changes. The intentional visual change
is stronger purple ink and a light purple paper tint for poison mushrooms.
Covered hazards remain indistinguishable from other covered tiles.

## Rendering ownership

`ui/overworld-rendering.js` is embedded before `renderMap()` by the usual builder.
`paintMapTiles()` keeps the renderer's existing 99 authored button strings as its
source of truth. It updates changed attributes and art while retaining unchanged
buttons/SVGs. A new map array starts a fresh board, preserving floor transitions.
Changing the leader still uses the original portrait renderer and unique hatch
IDs. No shared portrait SVG or cached random outcome is introduced.

The cache is ephemeral and keyed by actual DOM nodes. A small MutationObserver
invalidates content edited directly by the eraser or other presentation code,
including edits deep inside an SVG. The renderer drains its own synchronous
writes, so it does not invalidate itself. Root button attributes, including
disabled/accessibility state and temporary route classes, are always reconciled.
Do not put these caches in `state` or consult them when making game decisions.

`paintMapDrawing()` retains unchanged crystal pulse fields and corridor boundary
drawings. Real wall/vision changes rebuild the corresponding drawing; an absent
field removes it. The same pulses, clipping, counts and CSS animations remain,
and unrelated renders no longer restart them.

`icon()` caches only deterministic, ID-free icon strings. Portraits, injuries,
corpses and hatch IDs retain their existing generation rules. Keep new icon
drawings pure; never put state-dependent art or generated IDs in that cache.

At exactly 100% brightness, `#screen-lighting.brightness-neutral` removes the
identity `brightness(1)` backdrop filter. The brightness slider still uses the
original filter at every other setting. Torchlight, screen effects and all
other layers stay enabled with their original artwork and timing.

## Measurement and checks

Run `node tools/profile-overworld.cjs --out test-results/performance-current`.
Use `--html /path/to/baseline.html` to compare a prior standalone build. It runs
the same authored crystal-map fixture with 4× CPU throttling, 24 redraws and an
eight-tile walk. Reports include timings, live tile mutations, retained nodes,
layout/style work, animation-frame gaps and screenshots. Keep comparison runs
isolated from the full test suite. These are local browser measurements, not a
hardware-independent FPS promise or a campaign simulation.

The isolated comparison for this pass (1920×1080, 4× CPU throttling) measured:
The baseline HTML was revision `54bf461`; both runs used the same map fixture.

| Check | Before | After |
| --- | ---: | ---: |
| Mean `renderMap()` work | 21.9 ms | 8.5 ms |
| Existing tile buttons retained | 0 / 99 | 99 / 99 |
| Live tile additions/removals over 24 unchanged refreshes | 2,376 each | 0 |
| Style recalculation over those refreshes | 607 ms | 78 ms |
| Layout work over those refreshes | 346 ms | 56 ms |

Both walks reached the same tile in eight steps. The frozen crystal-map
screenshots were pixel-identical (175,014 pixels). Purple mushroom changes are
covered separately by palette screenshots. Retain the reports and screenshots
under `test-results/performance-before` and `performance-after-isolated` when
comparing further changes; timing varies with the machine and browser load.

`tests/overworld-rendering.test.cjs` verifies retained art, full-redraw DOM
equivalence, invalidation, new floors, crystal animation continuity, unchanged
world/RNG/particles, brightness and purple mushrooms in all palettes. Existing
terrain, ice/crystal, environmental and full browser regressions still apply.
Run `npm run build:ui`, `npm test`, `npm run review:ui` and
`npm run review:environment` before publishing. Screenshots must preserve the
notebook's pencil texture; never disable its grain or lower effects to hit a
benchmark number.

If real play is still slow, the next pass should start from a trace of that
browser/device and biome. This pass intentionally leaves broader layout/text
fitting, combat rendering and terrain effect implementation alone.
