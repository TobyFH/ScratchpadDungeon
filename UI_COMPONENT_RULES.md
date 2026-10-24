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
| Tape label   | `.pencil-label`; `.party-label`, `.enemy-label`, combat heading                                  | `--tape` torn-end adhesive paper behind actual headings; no filler writing; small fixed tilt permitted                                   |
| Button       | Native `button`, optional `.pencil-button`; `.primary`, `.quiet`                                 | Paper fill, graphite edge; primary has a stronger outline; quiet still gains a hover/focus cue                                           |
| Side tab     | `.notebook-tabs button`                                                                          | Same paper family; vertical label, stable orientation; `scale(1.045)` hover, never rotation                                              |
| Icon         | `icon(id)` / `.pencil-art.pencil-icon`                                                           | 32×32, meaningful silhouette, `aria-hidden` when labelled by its control; no independent decorative glyphs                               |
| Illustration | `portraitArt(kind, entity)` / `.pencil-art`                                                      | 120×150, shared material fills, unique hatch IDs, injury and corpse states, no game-state mutation                                       |
| Log          | `.journal`, `.journal-head`, `#log`                                                              | Fixed frame and heading; only entries scroll; retain keyboard focus and live announcements                                               |
| Bag          | `.inventory`, `.inventory-items`                                                                 | Three fixed pockets; icon, name/count and short description; all three must fit inside the frame                                         |
| Health / EXP | `.healthbar.hp-bar`, `.healthbar.exp`                                                            | Hero HP numbers and textured HP bar above reels, EXP below; preserve thresholds and critical-health pulse                                |
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
- Autoplay is an explicit opt-in exception to manual discovery confirmation.
  Its driver activates the existing event buttons; do not add unconditional
  popup-dismissal timers or bypass rolls and critical holds. Player-opened
  menus pause autonomous travel, and final run summaries stay open. Autofight
  is separate and does not automate exploration or field decisions by itself.

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

## Combat feedback and floor summaries

- Keep the full `.lever` button inside the hero's reserved machine/caption row.
  Its SVG animation must not move the hitbox. EXP follows the whole machine,
  including that hitbox, and the edit row stays inside the fixed hero card.
- Use `.low-health` / `.critical-health`, `.poisoned`, `.stunned` and the existing
  roll/status hooks on the whole hero card. Damage/heal/roll pulses use
  `partyCardFeedback()` without changing card size. Critical HP flashes red;
  poison is purple via `--poison` and `--poison-wash`, with a labelled badge.
- Rivers use `--water-ink` / `--water-wash` while retaining their blocked mark.
  Never tint a hidden tile based on its concealed terrain.
- Stronger supplies have a full name for decisions and a concise `shortName`
  for three fixed bag pockets. Two name lines and one effect line are reserved;
  don't hide clipping with overflow rules. Full effects remain in the tooltip
  and bag/event views. Check Masterwork names on 320px and 390px screens.
- Enemy traits occupy the existing machine-title row. Use a short label plus
  the description tooltip, without pushing health/clocks/reels into targeting.
- Floor-clear results use `.floor-summary`, a fixed three-column statistic
  pattern with actual labels and values. Fanfare never replaces the confirm
  button or automatically dismisses the result in manual play. Final victory
  retains the full roster and appends final-floor statistics inside its existing
  scrollable records; don't compress all adventurer text to fit an extra grid.

## Detached sheets and settings

- Dialogs and event/critical panels share `--torn-paper` and the three
  `ui/assets/torn-paper*.svg` assets. These nine-slice images supply an opaque
  paper centre and transparent, fibrous perimeter. Do not reintroduce a second
  straight/dashed frame inside the torn sheet. Borders are decorative; content
  remains in rectangular accessible DOM controls with unchanged focus hooks.
- Settings use `.settings-tabs`, `.settings-panel`, `.settings-grid`,
  `.setting-slider` and `.setting-check`. All four pages fit at small sizes;
  don't put every control in one long scrolling sheet. Range controls have
  explicit labels/outputs. Preview settings must say they are not active.
- Equipment names use a fixed single text line measured by `fitText()`;
  preserve their full name/effect in the accessible label and tooltip. Check
  all ten pieces, not only the empty slot. Enemy machine state captions
  share a reserved row with passive information; phones reserve two short lines.
- A `.trait-badge` sits in a portrait corner, distinct from bottom status badges.
  It has a meaningful icon, accessible name, effect and origin tooltip. Positive,
  negative and mixed traits use the existing green/red/gold semantics. It adds
  no new card row and never opens a mandatory choice.
- Dead health bars use `.dead`, never `.critical`, and have no flashing animation.
  Re-run title fitting after embedded fonts finish loading, as well as on resize.

## Camp and banking

Camp uses the existing torn-sheet modal, `.settings-tabs` navigation and a
`.camp-grid` of `.pencil-card` entries, up to four per category. The Adventurers
page currently has one illustrated Ranger invitation, not empty upgrade cards.
Descriptions are real
effects; do not add decorative camp notes. Purchases and enable/disable actions
must be distinct, with visible costs and `aria-pressed` for toggles. Fit whole
pages without another scrolling panel. The Ranger adds a fourth starting class after its camp unlock. The starter
grid also keeps the `.five-classes` hook for older layout integrations.

`.banking-panel` contains four equal choices plus a status line. Banking does
not dismiss floor/victory records. Update the line and disable the four choices
after a committed deposit; retain the normal Continue button. Gameplay logic
belongs in `game/progression.js`, which the builder embeds separately from art.

Portrait status badges use `statusBadge()` with actual effect values, accessible
labels and `data-tooltip`; the shared viewport tooltip also supports passive and
trait descriptions. Never make a status look like a new action. Keep tooltips
within the viewport and dismiss them on focus/pointer exit, click and rerender.
Inspection buttons keep the same opacity during travel locks; ordinary movement
is not a new treasure animation. Inactive round/block widgets use the shared
`.inactive-combat` treatment and reset values outside battle.

The team-block pool uses `--block-blue`, `--block-silver` and a strength fraction
which saturates at twenty, retaining an uncapped numeric value. Keep its shield
SVG mounted when changing the count: enemy interception beams target that icon,
with a separate beam for real HP damage. Blue-silver is protection, not healing.
Hero card background/name/health clicks roll; nested targeting, equipment and
edit buttons retain their actions. Keep the card keyboard-focusable in combat.
Portrait statistics use the shared tooltip frame and a compact labelled grid;
read live values on hover/focus, and give nested status badges priority.

Options tabs replace only `.modal-flow`, preserving the existing title node
and its initial opening animation. Don't replay `popTitle()` on each tab.
Discovery callouts hold at full opacity before a slow fade; retain the journal
entry and tile hint. Floor changes still dismiss obsolete callouts quickly.
Victory banking uses a concise `.victory-banking` receipt, not percentage
buttons. Fireworks remain behind meaningful content and require no extra click.

Ranger's Execute `.aim-meter` uses the existing `.machine-footnote` row: labelled patience, short fill track and next-hit bonus. Do not add a row, move EXP, or rely
on colour alone. Keep the meter and portrait badge consistent through storage,
release and cleanup; its shared tooltip explains the cap and timing.

Full-screen event feedback belongs in `screenFX()` / `#screen-edge-fx`, using
the shared damage/healing/poison/value tokens. It is fixed, non-interactive and
masked away from central information. Never shake or recolour the entire
document to implement it. Keep its persisted Display toggle separate from
Torchlight, and respect reduced motion without changing gameplay outcomes.

The reel workshop uses `.workshop-tabs`, `.workshop-faces` and
`.workshop-detail`: face odds remain visible; Upgrade, Downgrade/refund and an
explicit destination select/Swap have distinct fixed hitboxes. The permanent
middle class seal gets a clear locked explanation. Mage Resonance follows the
actual rolled marks; it has no role selector. Portraits open this workshop;
healing-target buttons remain separate.
`.points-prompt` may pulse its paint/shadow, never move its button geometry.
Enemy protection reserves space below each portrait, sharing one pool in double
fights. `.entrance-member` keeps every foe's name and portrait together before
its individual flight to combat. `.rolled-projectile`, `.symbol-arrival` and
minor combat numbers are fixed overlays without input capture or layout effects.

Tactical additions use the same notebook primitives. Enemy shields sit inside
`.enemy-presence`, directly below each portrait, and mirror one shared pool.
`.enemy-action-state` shares a reserved caption with the passive label.
`.encounter-tag` labels real boss, elite, dual, surprise and passive states; the second enemy has its own entrance.
`.critical-payoff` reserves the large final number while arithmetic settles.
`.fury-meter` reuses the reel caption; it never pushes EXP down. Temperament stays
visible on portraits/health captions and the workshop without an in-run selector.
The workshop's three numbered steps and `faceDescription()` explain every mark.
Its fitting uses the full sheet width before reducing text size. Rank-IV symbols
share the constrained grid inside `.slot-window`; never let a fourth icon clip.
Lava paint is meaningful illumination and impassable terrain, with a muted orange
token. Keep all callouts input-transparent and respect reduced motion.

Long-form instructions live in `ui/field-guide.js`, embedded by the same builder.
Use short topic pages with a native topic selector and previous/next buttons,
not one shrinking wall of instructions. Keep topic changes within the existing
sheet and preserve keyboard focus. The fitting routine uses the full available
width before reducing text size. Check every topic at compact sizes.

## Fixed notebook pages and faction controls

- Field-guide topics share one grid cell. Inactive topics are inert and invisible
  but reserve the longest page's space. Navigation always precedes the body.
- Camp navigation and balance have fixed rows above a fixed card region; changing
  a category must not move its controls. Training shows the next tier per family.
- The compact workshop uses a native face selector and fixed Power, Replace and
  Weight operation pages. Use the same validators and descriptions as desktop.
  Never shrink the desktop face-list's small lettering into unreadable type.
- Bestiary entry selection, previous/next, record frame, count and close control
  reserve consistent regions for unknown and known creatures. Lore is purposeful
  content for that creature; it is not decorative notebook filler.
- Utility side tabs remain above confirmation layers and suspend/restore the
  original modal DOM. Their labels never rotate. Do not resolve a pending event
  just to open a guide or options page.
- A faction has one block readout: party in its panel header; solo enemy below
  the portrait; paired enemies one large row above their roster. Never draw two
  shields implying two pools. Trait/condition/temperament portrait badges are
  icons only; exact meaning belongs in their accessible hover tooltips.
- Reel windows centre the entire tier grid. Direct SVG children must be static
  grid items: retired absolute rank-I/II/III offsets must not reappear.
- Treasure scenes reserve artwork, machine, inline-critical, result and reward
  regions. The main machine has an explicit width independent of the marks.
  Multiple finds use the fixed loot browser; criticals never resize existing art.
- Corpse contours are normalised inside their fallen transform. Never insert a
  second untransformed contour that resembles a live ghost behind the remains.
- Portrait motion is independent of shake, respects reduced motion and its own
  strength slider, and must leave actual button hitboxes stationary.

## Criticals, return effects and readable automation

- Keep one `.critical-payoff` node from original roll value through final payoff.
  Update its number/label and animate paint only. Pending event critical regions
  are blank reserved space; no dashed placeholder or calculation grid appears.
- Treasure and battle-spoil icons centre across their full scene row. The trap
  illustration's old 200px maximum must not constrain these standalone icons.
- A loot machine's reserved row includes its title and result caption. The inline
  critical has its own title row; neither caption may spill into that heading.
- Enemy tape labels use a content-sized width within the 26px encounter heading
  row. Do not stretch a tiny title across the whole enemy column or exceed its row.
- Bridge water reuses the exact river path at reduced opacity; the wooden deck
  stays bold. The terrain layer is separate from any discovery/corpse marker.
- Edit and critical workshop pages share a grid cell and reserve the larger
  intrinsic content height. Inactive pages are inert/invisible, retaining their
  geometry; note/footer follow that grid. Do not restore rigid page heights that
  let long face descriptions overlap the explanatory line.
- Outgoing projectile completion is part of the feedback contract. A life-drain
  return starts at the victim portrait after outgoing damage has arrived; the
  heal number/pulse occurs after the return. Utility suspension preserves it.
- Poison identity is purple text/particles and an explicit POISON label; its HP
  number may remain red. Do not label damage-over-time HIT or consume Vulnerable.
- Automated confirmations get a speed-aware reading hold; manual interaction
  stays enabled. See `game/automation-pacing.js`, including Skip's 5× reference.
