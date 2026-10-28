# Environmental journeys and protected escape routes

This implements the attached seven-feature biome specification on the existing
11 × 9 board (9 × 7 interior). The board, room/combat loop, character classes,
reels, ordinary rewards and permanent bridges/tunnels are retained.

## Ownership and tuning

- `game/environment.js`: `ENVIRONMENT_TUNING`, generation, saved controller,
  conservative traversal proofs, room-payload swaps, movement receipts and root
  encounter continuation. All durable state is `map[0].environment`; tile
  overlays are `cell.env`. Room contents remain in their original fields.
- `ui/environment.js` / `.css`: pencil sketches, anchored overlays, closed-edge
  lines, hover descriptions, movement countdowns and finite map feedback.
- Existing `floorNeighbors`, `movementRoute`, `glideCells` and
  `allTilesCanReachStairs` interpret the same current edges and walls. The
  pursuer also respects closed corridor connections.
- `game/living-dungeon.js`: existing shadow cover now advances at **1.8×** its
  previous rate, including old saved deadlines. Lantern protection overrides
  re-covering. Existing stalactites remain footstep-based.
- `WORLD_BALANCE.strongholdChance`: **18%** placement attempt per floor, formerly
  3.5%; available safe sites still determine actual occurrence.
- `ENCOUNTER_TUNING.returnedHeroChance`: **12%**, formerly 6.5%, per eligible
  ordinary encounter with an earlier-floor memorial. A person still returns at
  most once and remains dead in the memorial.

Build with `npm run build:ui`. Sources and embedded HTML must be committed
together. No external assets, dependencies or audio recordings were added.

## Shared clock and safety

One completed journey advances the new controller once, regardless of walked
path length, ice-slide steps or an included tunnel transit. Taking a tunnel in
place also counts once. Declining a tunnel, invalid movement, reveal-only wall
clicks and merely waiting do not advance it. Retargeting an ongoing journey
changes its destination; it does not add an environmental tick.

`pendingMovement` records actual movement. If combat, treasure, a shop or another
confirmation interrupts travel, its tick waits until the interaction is over.
`flushEnvironmentalMovement` requires exploration, no current travel, and no
other update. It clears the receipt before committing changes and saving, so
reloads cannot apply the same movement twice. Short finite map animations occur
after changes, with the ordinary busy gate, speed/skip, shake and reduced-motion
controls. Environmental time never advances from a render or animation frame.

Generation reserves a permanent slide/tunnel route excluding consumable mud and
brittle ice. Roots, trees and faults cannot occupy it. Every proposed wall or
edge change additionally proves escape from every remaining walkable tile, using
actual directed movement. The conservative proof closes all temporary crust,
consumable mud and brittle ice, and exhaustively checks every corridor-layout
combination (at most two sections). Optional root/tree battles and waiting for
crust are never counted as an escape route. Rejected mutations restore their
previous walls/layouts. An occupied crust formation is held as one unit. The moving hunter is also
kept out of newly blocking terrain: crust holds and faults delay while it
occupies them, and new roots cannot grow under it.

## Features

| Feature | Generation and behaviour |
| --- | --- |
| **Heartwood** | 70% Overgrowth attempt; one optional tree, normally near an outer margin, behind 2–3 connected roots. Every 3 journeys, at most one safe connected root grows, up to 5 active. Cleared cells never regrow; detached roots wither. |
| **Sunlit clearings** | 90% Overgrowth chance; 1–2 landmarks. First entry scouts the four cardinal neighbours without resolving their rooms. The light protects against roots and removes only the additional Overgrowth surprise modifier. |
| **Cooling crust** | 80% Lava chance where a useful connected crossing exists; 1–2 formations of 1–3 tiles. Molten for 3 journeys, solid for 5, with the last solid journey marked cracking. Initial molten countdown varies. All stones share a phase; melting waits until the player leaves the whole formation. Light is weaker over solid crust. |
| **Spreading faults** | 60% Shaky Caverns attempt; one safe 2–4-cell chain. With faults present, ceilings cap at three and mudslides at one. A crack propagates every 2 journeys; each cell warns for 4 journeys before collapse. Unsafe/current-tile collapses are cancelled permanently for that cell. Contents are retained beneath impassable rubble. |
| **Seismic shifts** | 60% Shaky Caverns chance, reduced to 35% when faults already exist. Every 4 journeys, one pair of eligible unvisited discoveries swaps. Scouted previews are preferred. Visited/completed rooms, stairs, tunnels, adventurers, fixed structures and environmental landmarks never move. |
| **Lantern islands** | Shadow Galleries have 2–3 where space permits. First entry permanently lights the tile and four cardinal neighbours. Already visited cover clears and cannot return inside the light; unvisited contents are not scouted. |
| **Shifting corridors** | 75% Labyrinth attempt; 1–2 optional sections controlling 2–3 neighbouring connections. Each cycles predictably between two proved layouts every 4 journeys, with a warning one journey beforehand. A permanent anchor connection remains open; secret doors and pressure gates are excluded. |

No safe placement means that feature is omitted rather than damaging the floor.
Features may coexist with a room where appropriate: a rooted Treasure remains a
Treasure, and a lantern over a room does not consume the discovery.

## Root combat and rewards

Selecting a root/tree offers Fight or Leave. The player stays outside until
victory. Root clusters use an existing Overgrowth creature and ordinary combat;
the Heartwood uses the existing elite/stronghold enemy and guaranteed-artefact
loot path. It is an optional boss and **never** sets staircase victory flags or
ends floor ten. Environmental encounter tags survive saving.

Victory clears the barrier once, then the saved `pendingEntry` resumes entry
only after battle spoils and other confirmations are finished. The underlying
room resolves normally, once. Its treasure is separate from root-battle loot.
A manual new destination can override the continuation. Enemy corpses remain on
the root/tree tile. Defeating the Heartwood withers every remaining root and
permanently disables growth.

## Seismic payload contract

`ENVIRONMENT_TILE_FIELDS` enumerates anchored coordinate/visibility/terrain
properties. Every other room-owned property travels with the unresolved
payload, including shop stock, stable discovery IDs, generated reward objects
and future metadata. No encounter/loot generator is invoked by a swap. Cave-room
reveal groups, environmental state, corpses and seen/visited flags stay at their
coordinates. Stale hints on the swapped cells are cleared; visible previews
rerender from their actual new contents.

## Saves, tests and review

This is an additive save-23 extension. Existing floors without an environmental
controller are not rerolled or populated during loading. New floors receive the
features. Existing phase/layout/activation, cleared-root and movement receipts
restore without consuming world RNG; loading re-derives crust/root blocking.

Run `tests/environment.test.cjs` for 300 seeded biome floors with 6,000 committed
mutations, full root-combat/loot/arrival flow, actual long/slide/tunnel movement,
light/scouting, copied room metadata, phases, route rejection and save roundtrips.
Also run the existing ice/crystal, biome, clarity, expedition and full tests.
`npm run review:environment` captures the live overlays and choices at desktop,
Deck and phone sizes. The field guide has four compact environmental topics.
