# Scratchpad Dungeon: pencil notebook style

The reference supplied for this restyle is the art-direction authority: an open,
cream-paper notebook, drawn in graphite, with legible hand lettering, sketched
creatures and restrained functional colour. The game should feel drawn by a
person, without becoming a collection of random scribbles. It is a notebook,
not a medieval parchment dashboard.

[Current implementation preview](docs/ui/notebook-preview.png) is a checked-in
visual anchor for future work. It records this implementation, not a replacement
for the user's canonical reference. Generate fresh captures with
`npm run review:ui`; compare them before intentionally updating the preview.

## Source of truth

| File                 | Responsibility                                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `ui/notebook.css`    | Presentation tokens, shared primitives, component treatments, palette and presentation breakpoints                       |
| `ui/layout.css`      | Existing structural geometry, responsive arrangements and animation choreography; isolated in the `legacy` cascade layer |
| `ui/drawings.js`     | All icons, portraits, creatures, corpses, floor marks, trap drawings and lever artwork                                   |
| `ui/assets/`         | Nine-slice frames, tape, page wear, graphite textures, embedded fonts/licences and original creature scans                |
| `tools/build-ui.cjs` | Embeds those sources and assets into the marked regions of `index.html`                                                  |
| `index.html`         | Runnable, downloadable, self-contained game; HTML structure and gameplay remain here                                     |

Run `npm run build:ui` after changing UI sources. Commit both the sources and
the generated HTML. `npm run check:ui` fails if they disagree. Do not edit a
generated region directly. No server or build is required to play the resulting
HTML; the build script uses only Node's standard library.

The unlayered notebook presentation deliberately wins over older paint rules in
`@layer legacy`. Add new visual treatments to the notebook system rather than
starting another specificity contest in the legacy sheet. Structural and timing
rules still come from the existing layout. The embedded Patrick Hand font and
its licence remain in the HTML outside the generated region.

## Paper and graphite

- Default paper is `--paper: #f2ead9`; raised paper is `--paper-raised`; recessed
  paper uses `--paper-shade`. Use the variables, including in SVG fills.
- `--ink: #35342e` is the primary graphite. `--soft: #686459` is secondary text;
  it is still readable, not a low-opacity decoration. `--line` separates modules.
- Fine page grain and faint notebook rules belong behind content. Never put a
  texture/filter over text. Avoid dark stains, torn holes, heavy grunge and busy
  paper patterns beneath the map or combat information.
- The centre crease, page edge and soft book shadow establish the notebook.
  Modules themselves are flat paper, without glossy gradients, raised bevels,
  glass, metallic chrome or pill-shaped containers.
- Warm and dark palettes use the same tokens and drawing language. Dark is
  pale graphite on charcoal paper, not a separate neon theme.
- Page wear is confined to the perimeter: `page-wear.svg` supplies small creases
  and rubbed fibres; the book's outer cut is slightly irregular. Keep it subtle
  and outside the content. Do not increase distress across the whole page.

## Colour has a job

| Token        | Meaning                                                  |
| ------------ | -------------------------------------------------------- |
| `--green`    | Health, healing and beneficial recovery                  |
| `--red`      | Damage, danger, wounds and enemy health                  |
| `--gold`     | Treasure, valuable items and active valuable discoveries |
| `--focus`    | Keyboard focus and movement/selection feedback           |
| `--ui-label` | A quiet paper label, not a reward or rarity colour       |

Keep most of the page monochrome. Retain existing gameplay status effects,
critical beams and feedback colours where they communicate an action. Never
add bright colours simply to make a panel more exciting. Health is also stated
numerically; targets, active events and terrain use shape/text cues as well as
colour. Body text and secondary text are tested for at least 7:1 and 4.5:1
contrast respectively against the main paper in every palette.

## Linework and frames

- Use a deliberate slightly uneven contour and a faint second pencil pass.
  Imperfection should describe the same object, not add unrelated marks.
- The nine-slice SVG frames preserve a consistent stroke while a panel grows.
  Use the shared `--frame` token. The light frame is selected automatically in
  dark mode. Keep SVG dimensions explicit when making another nine-slice asset.
- Large panels use the 7px source-space frame; small cards use 3px. This is the
  frame's slice area, not a seven-pixel solid outline. Actual graphite is finer.
- Frame-only pressure grain lives inside the SVG asset. It must never filter
  the panel's text. Retraced edges should remain visibly distinct at desktop fit.
- Combat and party/enemy headings sit on `--tape`, the reusable translucent,
  torn-end adhesive-paper label. Use it for actual section titles, without
  additional text or decoration. Preserve the heading's reserved space.
- Small buttons have a thin graphite edge and a very slight second contour.
  Hand-drawn does not require every control to be rotated. Side tabs never
  rotate on hover: they grow gently while retaining their orientation.
- Hatching belongs to material or shadow: cloth, armour, stone, covered tiles.
  Do not hatch arbitrary empty UI space. Avoid ornamental corner clutter.

## Typography and hierarchy

- **Cabin Sketch, weight 700 / `--display`:** title, section headings and tape
  labels. Its graphite lettering is part of the font, not a filter on live text.
  **Caveat, weight 700 / `--hand-display`:** creature names.
  **Patrick Hand / Notebook:** body, HP, stats, logs and controls.
- Keep real labels plain and concise. Use uppercase for major notebook labels;
  preserve normal case for names, explanations and class names.
- Desktop source sizes include 62px for the book title, 48px for the combat
  title, approximately 26–28px for section labels and 16–20px for ordinary
  information. The existing notebook fitting scales the source layout.
- Check the rendered result at 1920×1080 and 1280×800, not just CSS values.
  Narrow screens stack the pages. Do not solve crowding by continually shrinking
  an entire interface or by hiding necessary controls.
- Native dropdown **options** need explicit ink and raised-paper backgrounds in
  every palette, as well as the closed select itself. Set `color-scheme` to the
  palette. Test the expanded animation-speed menu and settings-page menus.
- Long event headings must wrap and fit their reserved area. Transient text,
  arrivals and damage results must not change the main layout's dimensions.

## Icons and illustrations

- Icons describe one thing at a glance. Keep their 32×32 viewBox and the same
  silhouette across the legend, map, bag, reels and effects. `icon(id)` supplies
  a restrained echo of the actual contour, not extra decorative paths.
- The empty face has a crossed-circle icon. Tiered symbols repeat the same
  meaningful icon: never change counts, tier identity or class-seal semantics
  for visual reasons.
- Portraits use a 120×150 viewBox, expressive faces, soft contour changes and
  small areas of pencil hatching. Keep the class/species recognisable at map
  token size. The new hero drawings and shaggy Candle Gnawer are examples.
- The Candle Gnawer uses `illustrations/candle-gnawer.png`: an original generated
  graphite illustration with transparent edges, embedded through `@asset(...)`
  in the portrait SVG. Keep its shaggy triangular silhouette, candle, crooked
  fangs and spindly limbs. Do not replace it with a clean polygon icon. Scanned
  pencil art skips the contour filter; dark mode reverses graphite into pale
  pencil. Injury overlays and corpse art keep the normal portrait contract.
- Show severe injury clearly, while retaining the character's identity.
  Corpses must remain unmistakably fallen; don't substitute a healthy portrait.
- `pencilIllustration()` normalises older illustration fills to palette tokens
  and adds a controlled contour echo. New drawings should use `currentColor`,
  `var(--paper)` and `var(--paper-shade)` directly. Scope pattern IDs with
  `artSerial` so multiple portraits can coexist.
- The shared, deterministic `pencil-grain` filter slightly varies art contours.
  It must never be applied to text. Art must never call `Math.random()`, change
  game state, alter slot weights or consume gameplay randomness.
- `pencilPath()` gives straight illustration segments a small, path-keyed curve.
  It preserves endpoints, subpaths and smooth-curve semantics, caches results,
  and leaves the underlying silhouettes recognisable. Keep the amplitude small
  (0.32 icon units / 0.85 portrait units); do not use this to create scribbles.
- Floor marks are cracks and small stone shapes. Avoid floor doodles resembling
  treasure, enemies or other active events. Covered cells are dense graphite;
  stone and water still read as impassable when revealed.
- `wallArt()` draws staggered masonry with mortar and small material shadows.
  A wall stays an opaque, disabled barrier; do not add event-style token discs.
  Active discoveries use restrained coloured pencil discs: gold valuables,
  muted red danger, green wells. Used tiles lose that active treatment. Never
  put a hidden cell's event type in its markup.
- Hero HP numbers and their shaded health strip sit **above** the slot machine;
  EXP sits below. Keep this ordering for all classes, injury states and sizes.
  `--pencil-shading` supplies graphite texture to coloured bars;
  `--reel-rim` confines hatching to the pencilled machine casing.

## Meaningful text only

**Do not add random handwritten notes, meaningless scribbles, fake lore,
decorative words, pseudo-annotations or irrelevant doodles.** A visible word
is interpreted as game information. Use space, linework and hierarchy to create
character instead. Existing contextual speech, actual discovery hints, field
guide instructions and game-world names have a purpose; don't multiply them
as a styling technique.

| Do                                                     | Don't                                                   |
| ------------------------------------------------------ | ------------------------------------------------------- |
| A slightly irregular frame around the actual inventory | Tape and filler notes scattered over items              |
| Short hatching under a helmet or cloak fold            | Random lines around a portrait to suggest craftsmanship |
| A gold chest icon and a clear active-event badge       | Ornamental coins that look like unclaimed loot          |
| A green bar, HP numbers and healing indicators         | Colour as the only health/target cue                    |
| A real instruction in the reserved map hint region     | A motivational quote added to fill a gap                |
| A stable handle button whose SVG animates              | Moving the handle's clickable region                    |

## Review and continuation

Read [UI_COMPONENT_RULES.md](UI_COMPONENT_RULES.md) before adding components and
use [STYLE_CHECKLIST.md](STYLE_CHECKLIST.md) before finishing. Run:

```sh
npm run build:ui
npm test
npm run review:ui
```

The review command produces screenshots under ignored `test-results/ui-review/`,
including palettes, one- and three-hero combat, paired enemies, menus, treasure
criticals and compact screens. Review them visually against the supplied
reference; passing geometry tests cannot prove the artistic match.

A useful future request is: **“Add [feature] using UI_STYLE_GUIDE.md and
UI_COMPONENT_RULES.md. Reuse the existing pencil primitives, preserve game rules,
and include desktop, compact-screen and relevant dialog screenshots.”**

## Functional combat colour additions

Purple (`--poison`, `--poison-wash`) exclusively identifies poison. Blue
(`--water-ink`, `--water-wash`) lightly tints impassable river water. Both have
explicit dark-palette counterparts and preserve graphite linework. Low health
uses the existing danger red; active rolling uses a faint gold card wash.
These are gameplay cues, not a broader decorative palette. Keep HP numbers,
injury/status labels, shield indicators and the river's blocked symbol.

Detached event sheets now use local `torn-paper.svg`, `torn-paper-dark.svg` and
`torn-paper-warm.svg` assets rather than a rectangular frame. Their slight edge
variation, fibres and quiet grain are purposeful material marks. Keep the paper
centre clean and do not add decorative writing. Audio and lighting controls use
the same paper buttons, native readable controls and restrained colours as play.

Camp upgrades reuse the torn sheets, pencil cards and readable paper tabs; the
catalogue and persistent profile live in `game/progression.js` and are embedded
by the same offline builder. The Ranger's bow and quiver are purposeful class
art, with an Aim status badge rather than a decorative flame. Ambient lighting
is concentrated at the outer edges so torch flicker is visible while the paper's
centre stays legible. Room text is a single contextual description of the actual
current terrain/environment, explicitly requested gameplay presentation, never
unrelated handwritten filler.
