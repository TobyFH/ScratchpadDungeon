# Notebook component rules

Use the primitives in `ui/notebook.css`; don't copy a previous panel's computed
CSS into a new one. Tokens and presentation belong there. The actual game
renderers stay in `index.html`; visual SVG renderers live in `ui/drawings.js`.
Regenerate the standalone HTML with `npm run build:ui`.

## Shared patterns

| Pattern      | Primitive / existing aliases                                                                     | Contract                                                                                                                                 |
| ------------ | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Main panel   | `.pencil-panel`; `.sketch-box`, `.party-side`, `.journal`, `.inventory`, `.modal`, `.stage-card` | Flat paper, shared nine-slice outline, clear title, consistent inset; no raised chrome                                                   |
| Compact card | `.pencil-card`; starter buttons, `.editor-row`, `.bag-card`, artefact and equipment choices      | Finer 3px frame slice; deliberate space between adjacent frames                                                                          |
| Tape label   | `.pencil-label`; `.party-label`, `.enemy-label`, combat heading                                  | `--tape` torn-end adhesive paper behind actual headings; no filler writing; small fixed tilt permitted                                  |
| Button       | Native `button`, optional `.pencil-button`; `.primary`, `.quiet`                                 | Paper fill, graphite edge; primary has a stronger outline; quiet still gains a hover/focus cue                                           |
| Side tab     | `.notebook-tabs button`                                                                          | Same paper family; vertical label, stable orientation; `scale(1.045)` hover, never rotation                                              |
| Icon         | `icon(id)` / `.pencil-art.pencil-icon`                                                           | 32×32, meaningful silhouette, `aria-hidden` when labelled by its control; no independent decorative glyphs                               |
| Illustration | `portraitArt(kind, entity)` / `.pencil-art`                                                      | 120×150, shared material fills, unique hatch IDs, injury and corpse states, no game-state mutation                                       |
| Log          | `.journal`, `.journal-head`, `#log`                                                              | Fixed frame and heading; only entries scroll; retain keyboard focus and live announcements                                               |
| Bag          | `.inventory`, `.inventory-items`                                                                 | Three fixed pockets; icon, name/count and short description; all three must fit inside the frame                                         |
| Health / EXP | `.healthbar.hp-bar`, `.healthbar.exp`                                                            | Hero HP numbers and textured HP bar above reels, EXP below; preserve thresholds and critical-health pulse                               |
| Map          | `.map-wrap`, `.map-board`, `.tile`, `.map-player`                                                | Frame the wrapper; **do not add borders/padding to the coordinate board**; token uses the board's percentage coordinate system           |
| Reel         | `.machine-shell`, `.machine-face`, `.slot-window`, `.lever`                                      | Three clearly separated windows, hatching confined to casing; fixed lever hitbox, animated child SVG                                     |
| Modal/event  | `openModal()` / `showSpotlight()`                                                                | Existing focus/confirmation semantics; shared frame/paper; reserved title, body, result and actions; don't dismiss choices automatically |

## Sizing and interaction

- Use `--ui-gap`, `--ui-inset`, `--ui-stroke`, `--frame` and colour/type tokens.
  Structural sizes in the desktop fit rules are **source-space** measurements,
  before `fitNotebook()` applies zoom. Check physical target sizes afterwards.
- The toolbar sits visually on the right page on desktop. Its DOM stays outside
  the perspective-transformed book so it can remain clickable above modal
  backdrops. On compact screens it is a sticky paper strip above the notebook.
  Keep its position tied to the shared page/desk inset and page-share tokens.
  Dialogs must not reserve space for an off-screen toolbar.
- Reserve three hero rows, result text and the discovered-stairs button area.
  Empty or hidden-but-reserved regions prevent combat controls from jumping.
- Keep hero health strips aligned with their reel faces. Both use
  `--ui-hero-reel-inset`, which compensates for the lever's fixed physical
  hitbox when the notebook is scaled. Do not hardcode a second bar width.
- A portrait, name/class and equipment button must not overlap. Every combat
  row's controls must end before targeting controls begin.
- Desktop paired enemies use two compact rows, each with its own portrait,
  HP, attack clock and wide reel. Don't squeeze two full-size illustrations
  and six narrow windows into a single row merely to mimic a solo encounter.
- Only the log and final adventurer roster scroll inside panels. Compact
  devices can scroll the document. Do not add clipping or independent panel
  scrollbars to disguise a layout failure.
- `fitDialogs()` measures the rendered content after applying zoom and corrects
  fractional-font reflow. Keep that validation if changing typography. Long
  headings use `fitText()`; do not abbreviate away enemy identity or decisions.
- Keep native labels, accessible names, aria-pressed target states, keyboard
  navigation and a conspicuous focus outline. Colour must not be the only cue.
- Style native `select option` backgrounds and text explicitly. Closed-select
  contrast does not prove expanded-menu contrast; check both in all palettes.
- Retain all `id`, `data-*` hooks and animation classes used by the game and
  tests. Animation speed, timing, slot outcomes and gameplay balance are not
  presentation tokens.

## Adding a panel

Long reading pages use `.pencil-columns` (the guide uses this treatment through
`.guide-grid`): balanced columns, no split paragraphs, and a wider sheet bounded
by `--ui-reading-width`. Keep body lettering readable after fitting; do not leave
a miniature block of instructions surrounded by empty paper.

```html
<section class="pencil-panel" aria-labelledby="supplies-heading">
  <h3 id="supplies-heading">Supplies</h3>
  <p>Actual information the player needs.</p>
  <button class="primary">Actual action</button>
</section>
```

Set its layout in the structural system and use the shared presentation. Do not
add a quote, pretend handwriting, unrelated drawing or extra labels to make it
look handmade. For an icon-only button, supply an accessible action name and a
meaningful `icon(id)` illustration.

## Adding artwork or an asset

1. Add the meaningful path/portrait in `ui/drawings.js`. Prefer controlled curves
   and intentional material hatching over perfectly straight geometric shapes.
2. Keep the existing coordinate and status contracts. Use palette fills and
   `currentColor`; art-only counters are allowed, gameplay RNG is not.
3. A reusable SVG texture/frame belongs in `ui/assets/`. CSS references it as
   `url("@asset(filename.svg)")`; the builder embeds the file as a data URI.
   PNG illustrations use the same syntax in `ui/drawings.js`. Preserve the
   portrait SVG wrapper and its injury, action, targeting and corpse hooks.
   Use `.pencil-scan` for already textured art, without an extra grain filter.
4. Store any third-party font licence alongside its font. Caveat and Cabin Sketch
   licences are also embedded into the final HTML. No remote dependency is allowed.
5. Run `npm run build:ui`, `npm test` and `npm run review:ui`. Inspect at least
   the default and dark palettes, a small target size and relevant injury states.

The supplied visual reference remains the authority. A new component should
look like another part of the same drawn notebook, not a separate application.
