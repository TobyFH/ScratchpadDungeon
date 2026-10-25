# Biomes, class identity and combat feedback

This is expedition save version **21**. The distributable remains the standalone
`index.html`; run `npm run build:ui` after editing embedded source modules.
Settings, camp ownership, banked gold, wounds and legal purchased marks survive.
Old maps retain their layout and receive a cave name. Living legacy Tanks gain
the two-HP base increase while retaining their missing HP; dead heroes stay dead.

## Balance ownership

`game/hero-builds.js` owns the following shared helpers. Manual actions, expected
roll estimates, workshop descriptions and automation use the same rules:

| Change | Current value |
| --- | --- |
| Tank base HP | 50, previously 48 |
| Ranger Execute | Existing calculation multiplied by 1.12 |
| Rogue direct damage | Final blade power multiplied by .94, rounded once |
| Rolled hero healing | Positive base healing multiplied by 1.10, rounded once |
| Shield Bash block | `2 + floor((level - 1) / 3)` |
| Fury capacity | `24 + 3 * (level - 1)` |
| Fury damage | One extra blade power per four Fury |
| Fury lifesteal | 4.5% per bonus blade power; cap 24%, rising .5 percentage points per level to 32% |
| Fury spent on lifesteal | `ceil(actual HP restored / 2)`; no spend at full HP |
| Fountain base | 15% maximum HP + .25 percentage points per floor after the first |
| Fountain roll contribution | 50% of rolled power + 1.2 percentage points per floor after the first |

Fountain depth bonuses stop increasing after floor ten. These are fountain
formulas, separate from the hero-healing modifier. Raw rank tables remain shared
across classes. Existing equipment, traits and critical rules still apply.
`WORLD_BALANCE.shopChance` is .40 (was .36); base tunnel-pair chance is .18
(was .14). Challenge/oddity overrides remain unchanged.

Blood Price is exclusive to Berserker; Trick is exclusive to Jester. The shared
edit validator enforces this for manual and automated edits. On load, illegal
legacy Blood Price becomes Trick for Jester or an empty rank-I face for other
classes; an illegal Trick becomes empty. Legal weights/receipts remain intact.
Each class keeps its single permanent middle seal.

## Named floors and terrain

`game/biomes.js` owns biome data, floor naming, terrain generation and directed
movement. Map cell zero stores `biome` and `floorName`, preserving the existing
map save shape. Rendering never chooses a theme or consumes gameplay RNG.

The themed-floor probability is `min(.72, .16 + (depth - 1) * .062)`.
Ordinary caves remain in the pool on every floor. Overgrowth starts at one,
mushrooms at two, ice at three and lava at five. Every floor has a named heading,
terrain-specific description and restrained perimeter tint.

- **Ice** forces continued movement in the entry direction until non-ice or a
  blocker. Routing searches stopping positions with full slide sequences as
  edges, counting each crossed tile for events and the pursuer. Known tunnels
  remain valid edges. A route requiring an impossible turn on ice stops before
  the first ice tile and explains why. Unrevealed cells never become shortcuts.
- **Mushrooms** form connected patches. Entering one reveals up to eight new
  nearby connected mushrooms through unobstructed sight lines. Discoveries are
  revealed, not activated.
- **Overgrowth** can coexist with discoveries. It raises surprise chances for
  the party and can catch enemies unready. It does not invent a hidden stat buff.
- **Lava** remains impassable and uses the universal blocker frame. New lava is
  rejected if it disconnects traversable terrain. New ice is rejected unless a
  directed slide/tunnel route to stairs still exists. The original minimum stair
  distance and reciprocal tunnel connectivity rules remain in force.

## Biome creatures and self-destruction

`game/biome-enemies.js` owns explicit themed species, floor bands, weighted face
mixes, lore and unique cry profiles. The early/late pairs are Rootbound prowler /
Thornwood ancient, Sporecap stalker / Myconid monarch, Cinder hopper / Basalt
wyrm, and Frostglass mite / Rime sentinel. They join only their matching biome
and depth pool. Generic creatures remain available.

The **Powder imp** appears from floor two in caves or lava. It has a two-turn
fuse: its first scheduled turn warns, its second detonates toward every hero for
`max(3, ceil(base damage * 1.8))`, then kills itself. Shared block and Unbroken
page protect normally; death, defeat and victory resolve through ordinary combat
paths. Its badge/intent show the remaining fuse; the burning aura, escalating
shake, smoke, blast and original synthesised cues distinguish it from a strike.
Killing it early prevents the blast. All new creatures have pencil portraits,
species corpses, bestiary records, pun names and distinct appearance/death cries.

## Automation

`game/auto-builds.js` retains paid, validated edits. Jesters prefer Trickster and
repair missing Trick coverage to at least 15% of ordinary faces. A Mage beside
two damage partners prefers Mender and repairs missing heal/block coverage.
Builds retain damage and avoid excessive stun/buff coverage. No free marks or
points are awarded to automation.

Autofight scores Fury, anticipation and Execute charge. It usually lets an
uncharged Ranger wait while another damage dealer acts, and prioritises a useful
charged Berserker/Jester. Emergency healing and expected kills can override that
preference. Existing anti-stalemate rules remain active.

## Stable presentation

Gold criticals use `rollCritical`'s `onLocked` callback to update the large final
number and compact equation together. There is no second delayed calculation
phase. Reward art, critical, result and loot regions keep reserved sizes. The
fixed find browser measures long text within its card, with a readable minimum
font size. All supply descriptions are tested at desktop, Deck and phone widths.

Class marks use centred icons without tiny labels and highlight on moving reels.
Their workshop detail keeps the same two power controls and geometry as other
faces; irrelevant replacement is unavailable. Map captions use hyphens and
"activated" for resolved discoveries. The redundant Exploration button is gone.

Shake passes through the shared control and is 2.4 times the previous amplitude.
Rumble, recoil, settle, healing, critical, fuse and explosion profiles communicate
different events. Zero disables shake; reduced motion scales it down. Empty
movement still causes no notebook shake. The audio additions use the existing
volume/mute/unlock lifecycle; no external audio service or runtime request exists.

## Verification and future changes

`tests/biome-update.test.cjs` covers real combat balance, Fury consumption, paid
class repairs, charged actor selection, generated floor connectivity, actual ice
movement, hidden-path restrictions, mushroom caps, overgrowth openings, species
identity, detonation/victory, gold timing, workshop geometry, all supply pickup
descriptions and save migration. `tools/review-ui.cjs` includes biome, creature,
fuse, charged-party and workshop screenshots at desktop/compact sizes. For just
these new captures, use `UI_REVIEW_SCOPE=biomes npm run review:ui`; the normal
command includes the full legacy review too.

Keep new biome terrain in this directed movement graph. Never repair a valid
tunnel crossing into a mandatory bridge. Never put a decorative tint or border
inside the coordinate board, where it would displace the player token. Follow
the notebook style documents for new art and components.

## Ice escape and crystal cave follow-up

Known ice can now be selected at the end of any revealed route even when its
landing is covered. The planner stops its knowledge at the first covered tile;
physical sliding then reveals each entered tile, including consecutive covered
ice. A known route never uses further hidden cells as shortcuts. If the requested
tile is passed during a forced slide, its landing becomes the movement goal.

Ice proposals must pass **reverse reachability from stairs for every walkable
cell**, including cells where encounters could interrupt movement. This replaces
the weaker spawn-only check. Loading a legacy one-way ice layout melts only as
many old ice tiles as needed to restore escape routes; discoveries, walls and
other terrain remain intact. Reciprocal tunnels count as graph edges.

Crystal caves start on floor three. Crystal deposits use the common impassable
frame, cannot replace room cells/discoveries, and cannot disconnect the map.
Their blue aura reaches within two tiles, with walls occluding it. Seen deposits
subtly tint affected revealed ground. In a nearby fight, every third party roll
(including a free Punchline) seals two distinct random, currently unsealed reels.
Sealed reels produce Empty once. Rolling that hero cracks all their gems after
the result locks; other heroes retain their seals. Badges, tooltips, encounter
tags, a chime and blue shard particles communicate the effect. Stunned attempts
do not advance the counter. Fight cleanup clears seals and the counter; ongoing
fight saves retain them. Crystal effects use the same gifted-reel input path as
ordinary rolls, including class seals, critical calculations and automation.

Starter cards reserve the same portrait/name/availability/stats/description rows
for locked and available classes. Phones use horizontal cards to keep meaningful
information together. `tests/ice-crystal.test.cjs` covers exploratory slides,
all-approach connectivity, legacy repair, real sealed rolls, cleanup/save rules,
wall occlusion and starter-card geometry.
