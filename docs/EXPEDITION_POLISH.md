# Heavy marks, roaming swarms and notebook polish

The distributable remains one offline `index.html`. Edit the owning sources and
run `npm run build:ui`. This update adds no fetched files, runtime dependencies
or paid services. The chosen victory title is **THE FINAL GUARDIAN FALLS!**.

## Physical attacks and saved builds

- `game/balance.js` owns `POWER.heavy = 2` and `markDamage(type, tier)`. Regular
  physical and spell marks remain **1/2/3/4**; heavy physical is **2/4/6/8**.
- A heavy mark is a separate `heavy` reel identity. It matches other heavy marks
  of the same rank, or a middle class wildcard between matching outer marks.
  Regular and heavy marks do not match each other.
- Both physical types resolve into `calculate(...).attack`. The `heavy` total
  stays zero: it is a symbol type, not another damage channel. Armour, traits,
  criticals, mixed-class combinations, area hits, Fury and actual damage all use
  the same physical pipeline. Do not apply the heavy factor twice.
- `game/hero-builds.js` permits heavy edits on Tank and Berserker. Their
  Aggressive starter replaces one rank-II regular mark with rank-I heavy,
  keeping that starter's base damage. Existing saved/purchased faces, ranks,
  investments and personal points are preserved; no automatic conversion occurs.
- `game/reel-upgrades.js` prices heavy faces at class factors **2** (Tank) and
  **1.75** (Berserker). The existing paid-receipt/refund validator remains the
  authority. The workshop, real rolls, forecasting, complementary bonuses and
  symbol flights all recognise the new type. Rank III/IV retains area damage.
- `ui/drawings.js` supplies a pencil axe. The workshop and guide show the actual
  heavy mark and its damage/cost distinction. Enemy floor budgets, regular mark
  values and existing class critical pools were not retuned.

## Ranger Execute and speech

`ui/class-moments.js/.css` own the arrow sequence. It starts at the Ranger's
portrait, grows for 40% of an 800ms reference duration, holds until 56%, then
accelerates cubically over 23% (about **184ms at 1×**) to impact. The point meets
the target; the remaining drawing drives through and fades behind it. Pace
shortens the whole sequence through the existing square-root scale.

At impact a bounded, forward-facing gold cone and paper burst erupt from the
enemy. Only its illustration recoils, preserving its target button and health
layout. `burst` accepts an optional direction/spread/speed; existing callers
retain their old trajectories and FX-random draws. `executionPayoffFX` still
applies no damage: the existing capped Execute hit resolves afterwards.

Skip, fast-forward, zero portrait motion and reduced-motion retain short impact
feedback. Utility pages pause/hide the travelling arrow. Restart, target removal
or viewport resizing cancels it. Existing audio buses and motion/shake controls
apply. The book/map shake uses pixel-snapped translation without rotation or
scaling, preserving tiny tile edges while keeping action-specific recoil/rumble.

Speech uses the shared torn-paper and tape assets, palette ink, a folded pointer,
and viewport clamping. Its frequency, actual lines and lifetime are unchanged.

## Living floors

Labyrinth generation attempts **three safe corridor sections on every floor**.
Each alternates every **two completed journeys**, with staggered phases, a warning
one journey beforehand and visibly sliding masonry edges. One long path is still
one environmental journey. Hover/status countdowns use the section's actual phase.

All eight combinations of three layouts are proved safe with consumable crossings
closed. A permanent stair route and escape from every walkable tile remain
required. Unsafe optional placements are still omitted. Roots, gates, ice and
pursuers keep using the same edge interpretation.

`game/roaming-swarms.js` owns **Canopy bee swarms**:

- A 48% placement chance on a generated Overgrowth floor, at least five tiles
  from spawn. Other biomes never seed one.
- One neighbour step per player footstep. It wanders, but within four tiles and
  line of sight has an 82% chance to follow a route toward the party.
- Walls/closed connections block it. It never moves from rendering, waiting,
  battle actions or utility/event menus. Tunnels check contact on arrival.
- Only a revealed occupied tile displays the swarm. Its drawing is an overlay,
  not a replacement for the room's contents. Contact starts a normal single-enemy
  fight and removes the traveller; no same-floor respawn is added.
- Durable location/steps are `map[0].environment.swarm`; reload never rerolls it.
  Environmental closures protect the swarm as well as the Unwritten.
- The species has pencil art, species-specific remains, bestiary lore, a cry and
  the optional **Spelling Bees** pun identity. It is excluded from ordinary
  random biome pools, so the travelling swarm remains its encounter source.

Burstcaps now use a red spiked silhouette and warning rim, remaining distinct
from purple poison caps. The open hole is a shaded, jagged chasm with a dark
recess; it remains impassable. Margins have larger drawings and nine themed
leaves/spores/drops/ice chips/etc. per side. Ambient/reduced-motion controls still
suppress movement. No hidden tile type is leaked by these effects.

## Readable notebook pages

Desktop party/enemy outlines share top/bottom bounds. Left expedition boxes and
right Event log/Satchel share `--ui-bottom-panels-height`; the left boxes are
higher/taller, and the right pair sits lower. Long logs cannot expand their frame.
Compact pages retain their stacked arrangement.

`notebookLayout.hold()` preserves the underlying expedition's fit while choosing
a New run. Closing/starting releases it. Real viewport changes and forced fits
still work; footer and font invalidation remain observable. Pencil covers no
longer overshoot/rotate over neighbouring cells; whole-map shakes preserve scale.

The field guide has **six illustrated quick-reference pages**: Explore, Combat,
Reels, Party, Biomes and Camp/controls. It reuses `icon`, `wallArt` and real hero
portraits. Concise rows replace the previous long catalogue. Inactive pages stay
in the same grid cell to reserve the tallest page, so navigation and confirmation
positions do not follow the selected topic. Old help-topic links use
`GUIDE_ALIASES`. Exact live rules belong in tooltips/workshop descriptions.

Bestiary **01 remains the Hostile Jester**, a declined wandering Jester that
turns hostile. Jesters require the camp invitation; it is not an ordinary roaming
encounter. Stable discovery IDs are unchanged by the newly added species.

## Battle records

`game/event-log.js` retains the compatible sixty raw strings/parallel metadata
and adds up to **ten battle receipts**, each bounded to **160 recorded lines**.
Records snapshot names, floor, outcome, actual party-action count and existing
term explanations. They do not roll RNG or retain live character references.

The latest completed battle remains expanded until a subsequent battle completes.
Earlier fights become single native keyboard-operable `<details>` summaries.
Opening one hydrates its stored lines/tooltips; closed histories initially render
only their summary, avoiding thousands of hidden nodes. Only the outer Event log
scrolls. Restart clears receipts with the run; saved reload retains them. Legacy
plain logs remain readable, and stored text/offsets are still escaped/validated.

## Validation and continuation

`tests/expedition-polish.test.cjs` exercises damage/critical identity, permissions,
prices/refunds, real rolls and reloads, arrow phases/cone/cancellation, all future
wall layouts, swarm rules/contact/persistence, journal folding/rehydration and
1920/1280/390/320px geometry. It writes targeted screenshots to
`test-results/expedition-polish/`.

Run `npm test`, `npm run review:ui` and `npm run review:environment`. Review the
images as well as assertions. Fixture updates intentionally replace the old
victory title, eleven-species count, four-journey wall period, separate Event-log
guide topic, and assumed rank-II Tank starter and former inner enemy-frame selector with the current contracts.
