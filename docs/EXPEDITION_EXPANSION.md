# Biome discoveries, recovery and class sketches (save 23)

> Current follow-up: [Curve and recovery tuning](CURVE_TUNING.md) supersedes
> earlier numeric examples for enemies, recovery, traits, biomes and nests.

The distributable is still one offline `index.html`. Run `npm run build:ui`
after editing embedded sources. No external assets, music changes or services
were added. Prior WAV cues and pencil illustrations remain in place.

## Ownership

- `game/expedition-expansion.js`: shared world tuning, maze carving, denser quartz
  placement, selected discoveries, safe brittle ice, mushroom checks, nests,
  horn interaction support and per-footstep Fury decay.
- `game/biomes.js`: existing generation, slide-aware routes, mushroom chains and
  one-tile crystal checks. `game/living-dungeon.js` includes brittle tiles in
  its conservative all-closed connectivity proof.
- `game/hero-builds.js`, `balance.js`, `battle-tactics.js`, `reel-upgrades.js`:
  caster-only face migration, shared powers/prices/availability, stimulant
  overflow, fountain scaling and carry-over Fury.
- `ui/expedition-presentation.js/.css`: semantic inks, paired-tunnel inspection,
  fixed map description area, biome margin drawings and quartz pulses.
- `ui/class-moments.js/.css`: cancellation-safe class sketches and larger enemy
  death clouds. These must never apply damage or consume gameplay RNG.
- `tools/review-expedition.cjs`, `tests/expedition-expansion.test.cjs`: focused
  browser fixtures, generation/connectivity proofs and current mechanics.

## Recovery and status identity

`selfheal` is an ordinary rank-I–IV face, contributing 2/4/6/8 base HP to its
caster through the existing internal `selfHeal` channel. `heal` remains an ally
heal, respecting the selected living healing target and the existing full-HP
misclick rescue. Self-heals never use that rescue and never overflow to an ally.
All healing still goes through `healHero`, spends only real Fury restored, and
can cleanse stun by the existing healing rules. Crits and levels use the shared
class calculations. No new Healer class or Mage speciality selector exists.

Tank, Rogue and Berserker edit self-healing rather than ally healing. Ranger can
build either; Mage and Jester can also use both. Physical classes' existing paid
healing faces migrate to self-heal without changing rank, face count or investment
receipts. Berserker normalization and every editor/AI validator reject ally-heal
faces. Defensive Mage starts split their recovery between one ally and one self
entry. Every reel still has equal faces; class/mystery marks remain permanent.

Fury survives battle cleanup and saves. Each actual tile walked loses 1 charge;
long commands decay once per footstep. Merely waiting/hovering/rendering does not
spend it. Healing still spends 1 per real HP; other battle statuses clear as before.

Stimulant has at most three own-action turns. Its initial mark rank sets potency;
three doses beyond full duration add one potency, capped at six, using a saved
remainder like poison. Its feedback states duration and potency separately.
Poison and stimulant remain distinct timed effects and both clear after battle.

Fountains rise from 16.5% base maximum HP on floor one, adding .7 percentage
points per floor and another .4 per floor after four. Rolled recovery retains its
half-roll opening, with slightly stronger late scaling. Shared helpers drive the
real healing, previews and autoplay. Unused wells remain optional.

All stun-related feedback, including cleansing, recovery and Steady, uses the
same amber pencil ink. Inspiration/heroic notices use a separate teal ink. Healing
is green, poison purple, and shared shielding blue-silver. `feedbackKind()` routes
callouts, notices, action labels and log vocabulary through the same language.

## Biomes and safe terrain

- **Maze:** randomized depth-first corridors, dense masonry, optional secret-door
  loops and matching plate/gate shortcuts. All discoveries attach to the tree;
  the stair starts at least eight moves away. Every closed gate/door preserves
  the main route. A revealed door opens by selecting it from an adjacent tile.
- **Mushroom:** poisonous caps harm the leading companion on every crossing.
  Burstcaps trigger within one tile and line of sight, reveal themselves, roll a
  trap-style check with explicit confirmation, then become ordinary mushrooms.
  A saved resolved check can resume its pending damage once. Mushroom reveals
  include all cap variants but do not automatically trigger their discoveries.
- **Ice:** up to three brittle tiles slide like ice, then leave impassable holes
  after departure. Placement proves every ordinary tile can reach stairs with
  **all** brittle/mud tiles closed, and also validates directed ice approaches.
  Route state tracks consumed brittle tiles, not just static walkability.
- **Quartz:** one-tile Chebyshev influence, respecting sight lines. Random safe
  deposits target about 50% union coverage of the walkable floor; overlaps are
  permitted. The existing single three-roll clock seals at most two reels per
  trigger, regardless of source count. Only known crystals draw blue pulses.
- **Lava:** watercourses retain the same blocked/bridge topology, tagged as molten
  rivers with orange flowing ink and lava-tinted crossings. Their light/glow uses
  the shared lava and ambient controls. No extra blocking barrier is introduced.

The user's selected extras are fruit bushes (Overgrowth), fairy rings (Mushroom),
brittle ice, beneficial geodes and prisms (Quartz), salvage rubble (Shaky), shadow
duels (Shadow), and secret doors/plate gates (Maze). No additional Cavern or Lava
mechanics from the idea menu were selected or added.

Geodes gild one reel per hero for two rolls in the next battle. Prism stones
reveal straight sight lines without activating discoveries. Fruit can be saved
for later. Fairy rings/rubble can disturb a foe; shadow duels are explicit,
optional strong encounters with richer existing stronghold spoils.

## Nests, items and presentation

A rare nest offers loot, a large egg, or leaving. Loot rolls normally; an egg
restores 65% of the selected hero's maximum HP. Taking either may bring a strong
broodmother (egg 45%, loot 25%); ignoring rolls no attack chance and preserves
the nest. Full bags warn before collecting and use the usual swap/use/leave flow.
Eggs are nest-only, not normal chest/shop stock. Companion's Horn is a replaceable
normal supply: using one outside combat opens the existing recruit/invite/swap/
decline interaction immediately. Autoplay handles the new choices and supplies.

Biome margin SVGs live outside the map coordinate board, with no input capture.
Leaves/motes/flows are restrained and follow ambient and reduced-motion settings.
Map inspection reserves fixed space and moves the stair action to its right.
It defaults to the current tile when no tile is hovered. Hovered revealed tunnels
link only to a revealed partner; drawing hints never discloses a covered exit.

Ranger Execute fires a large sketched arrow. Tank shields, Rogue blades, Mage
runes and Berserker Fury marks emphasize their actual defining actions, alongside
the existing Jester spring-box. Presentation promises pause for utility pages,
respect speed/Skip/reduced motion and cancel on a changed run. Skip retains
bounded particles and impact shake. Death clouds add larger, species-themed
paper/ink/spore/ember bursts without changing corpse identity or loot timing.

## Validation

Run the focused suite, ice/crystal and combat identity checks, then the complete
browser suite and UI reviews. Fixtures force a biome through generateFloor's
optional fifth argument; ordinary play leaves it null and uses normal chances.
Do not force a second biome over another theme for screenshots: that retains
its earlier discoveries and makes a misleading mixed-biome fixture.

The reel-editor presentation is separately owned and documented in
`docs/ICON_REEL_WORKSHOP.md`; it can be switched back without reverting any
of the mechanics above.
