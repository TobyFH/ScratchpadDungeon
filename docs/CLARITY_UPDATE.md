# Combat clarity and living floors (save version 22)

This is the current rules supplement. It supersedes older notes about free solo
stun misses, treasure carousels, most-used targeting for ordinary ally stimulant,
and lava outside its own biome. Existing class balance, camp ownership and
linear tier powers are otherwise retained.

## Source ownership and build

- `game/combat-clarity.js`: shared hero availability, whole-machine lock reasons,
  automatic solo stun recovery, enemy clocks, equipment inspection, class prices,
  once-per-action Pennant, rare hero notices and grouped action logs.
- `game/living-dungeon.js`: safe mudslide/rockfall placement, shadow exploration
  clock, numbered ceilings, Veil weaver locks and crystal map influence.
- `game/jester.js`: permanent mysteries, exact expanded probabilities, anticipation
  and the single six-mark Punchline burst. `hero-builds.js` migrates wheels;
  `reel-upgrades.js` validates edits and exposes their prices/odds.
- `game/biomes.js`: terrain, directed movement, ice/mud transitions and themes.
  `game/biome-enemies.js`: themed species, cries and profiles.
- `ui/notebook.css`, `ui/drawings.js`, `ui/notebook-pages.js`: existing shared
  notebook presentation, terrain/status art and fixed all-find reward cards.
- `index.html`: core orchestration, embedded module regions and Web Audio mixer.

Run `npm run build:ui` after editing sources. Commit the generated HTML with its
sources. `npm run check:ui` rejects drift. No new runtime dependency or network
asset was added; the five supplied WAVs and handwriting font remain embedded.

## Turn availability

Surprise, stun and the Veil weaver's forced switch have different labelled
whole-machine overlays. A surprised opening hero waits for a ready companion.
A stunned hero cannot be selected while an unstunned eligible ally can act;
that ally's real roll runs the existing stun recovery checks.

When every eligible living hero is stunned, a short automatic recovery turn
runs even with Autofight off. It records one missed turn, guarantees recovery,
grants the existing two-action Steady ward, ticks normal turn effects and
**advances enemy countdowns once**. It is not a reel spin or a free attack.
Utility pages, unresolved confirmations, another action and run replacement
prevent the recovery timer from acting. Manual, keyboard and AI selection use
the same availability predicate; a veiled solo survivor can still act.

Initiative highlights its hero's machine each encounter. A brief first-time
explanation says to use that hero first for 25% stronger effects. It expires
when another hero takes the opening roll, as before.

## Reels, equipment and feedback

- A blank opens an explicit power chooser. Only the named `Inscribe …` button
  pays for that chosen type. Ordinary upgrades, downgrades/refunds and class
  restrictions keep their shared validators. The Class prices workshop page
  lists real inscribe and II/III/IV costs plus class affinity and critical range.
- Every Jester reel has exactly one immutable `?`, in addition to the middle
  reel's unique class mark. Legacy Jesters gain missing mysteries once; repeated
  loads do not append more. They cannot be copied, upgraded, replaced or refunded.
- `?` selects an ordinary power uniformly, ignoring class restrictions, then a
  rank matching the other ordinary faces on its reel. Class and mystery faces
  are excluded from the rank sample; Empty counts as rank I. Thus two I and two
  IV marks give a 50/50 I/IV result. Blood Price is possible and still cannot
  kill its caster. The revealed power participates normally in matching crits.
- Exact crit odds and AI expectations expand mysteries into that same power/rank
  distribution. All authored faces remain equally likely; no weighting is sold.
- Three matching Trick marks multiply their total anticipation by the Jester's
  ordinary critical multiplier. At six, one Punchline fires six real reel marks;
  overflow carries at most five. Burst marks never crit, refill anticipation,
  reroll or chain another burst. Clown-cap particles and simple synthesised bell
  cues emphasise the charge/payoff without changing gameplay RNG.
- Counterstroke is the Tank's complementary physical-plus-block roll: it adds
  two shared team block. It is separate from the class mark's Shield Bash.
- Iron Pennant adds its flat bonus once per paid action that actually produces
  shielding, after critical scaling. Multiple shield faces and a Punchline do
  not repeat it. All block still obeys the existing living-party cap.
- Ordinary ally stimulant buffs the selected living heal target, even at full
  HP; otherwise the caster. Random Wildcard/Punchline targeting remains random
  or uses its existing fallback. Healing's full-HP rescue targeting is separate.
- Equipped items open an information sheet listing only compatible alternatives
  in the bag. Shop and satchel tags distinguish equipment, consumables and
  immediate services. Full-bag action columns reserve a disabled Use button when
  use is unavailable, keeping choices aligned before any purchase is paid.
- Loot shows all finds together in a fixed 2×2 space. Compact cards retain class
  restrictions and a short effect; hover/focus exposes the full description.
  The game currently produces at most four simultaneous finds.
- Fountains scale from 15% base HP at floor one to 19.5% at floor ten, plus the
  modest depth-scaled roll bonus. Displayed percentages round to whole numbers;
  the actual internal calculation is unchanged by display rounding.
- A paid action's multihits, Flurry and Punchline produce one log summary using
  actual HP damage and correctly summed individual hits. Poison/enemy turns and
  important passive events retain their own log entries.
- Rare personal notices survive ordinary card re-renders in a reserved overlay.
  Heroic survival also waits for confirmation before the next attack continues.

## Living terrain and route guarantees

**Mudslide:** entering forces straight movement like ice. Leaving it collapses
that tile into an impassable mud bank. At most two are generated on a floor.
All four approaches must be ordinary safe landings; adjacent mud/ice is excluded.
Placement proves every ordinary tile can reach the stairs even when **all**
mudslides are closed. This conservative proof also covers every subset already
consumed. Dijkstra route state includes a consumed-mud mask, so a single planned
route cannot promise to reuse its collapsed crossing. Ice, tunnels, active-trap
avoidance and covered exploratory landings retain their previous rules.

**Crystal:** deposits remain impassable. A dotted blue map outline marks visible
walkable cells within two tiles and line of sight of a revealed deposit. It does
not reveal unknown contents. The same radius/LOS rules select affected fights.

**Shaky caverns:** three to five unoccupied floor tiles can have numbered
stalactites. Each physical step (including slides) decrements every ceiling
counter. At zero a stone drops and the counter resets to 4–8. If the party is
under it, the first living hero takes `2 + floor(depth / 3)` damage. If the
Unwritten is there, it dies without EXP or immediate battle rewards; that cell
becomes ordinary treasure and loses the ceiling hazard permanently.

**Rockfall:** the minor event is eligible only if a safe permanent wall can be
placed. Candidate tiles exclude player/spawn, discoveries, structures, rooms,
ice and mud approaches. The same all-mud-closed stair proof prevents creating
an island or stranding any walkable area. The event selects an available safe
cell and identifies it with smoke/map feedback.

**Lava:** generated only in lava biomes. Old off-theme lava loads as blocking
stone and participates in the existing safe route repair.

## Shadows are biome-specific

Shadow galleries begin at floor four. Previously visited walkable tiles regain
pencil cover after a varied **38–64 seconds of active exploration**. The current
tile is exempt. Each covered tile slows that clock by a further 8% of its base
rate. Contents, activation state and known routes remain intact: this is a
visual cover, not a newly undiscovered room. Re-entry erases it and raises the
ordinary stale-tile ambush chance from 12% to 25% for that entry. Popups, combat and hidden-tab time do not advance the shadow clock.
Travel remains active exploration; its clock continues while movement can be retargeted. The
ordinary non-shadow ambush system remains command-aged, not timer-based.

A **Veil weaver** can fog one reel per enemy turn (two at depth seven+). Fogged
reels count as Empty on that hero's next roll, then clear. With multiple living
heroes, the last actor must yield to another eligible ally. One survivor can
still act, and ready-ally checks prevent a stun/veil deadlock. Shadow status is
cleared at the end of combat. The Shale-back scuttler is the unstable theme's
armoured creature. Each species/guardian has one distinct pun counterpart,
including unique names and sketches in the bestiary.

## Audio and performance

Battle uses a separate faster score with restrained percussion. Low filtered
noise and a bass drone grow with floor depth on the existing ambience bus.
All music, ambience, SFX gains, mute, voice caps and browser audio-unlock rules
remain in force. New cues use local Web Audio synthesis; no paid service/assets.

Particles now integrate position, gravity, rotation and lifetime by elapsed
milliseconds rather than frames. Motion matches at low refresh rates; a 250ms
step cap protects against a tab-resume leap. DPR is capped at 1.5 for the effects
canvas. Symbol projectiles, shake magnitudes and gameplay timing remain separate.

## Verification

- `npm test`: all browser/data regression tests.
- `node --test tests/clarity-world.test.cjs`: targeted availability, actual solo
  recovery, mysteries/odds/migration, targeting, Pennant, grouped logs, terrain,
  a seeded 1,000-floor connectivity sample, audio and confirmations.
- `node --test tests/ice-crystal.test.cjs`: existing slide/escape guarantees.
- `npm run review:ui`: established visual fixture suite.
- `npm run review:clarity`: focused default/compact terrain, locks, workshop,
  equipment, four-find loot and new guide pages; output under
  `test-results/clarity-review` with browser error and external-request reporting.

Generated screenshots and offline backups are ignored build/test artifacts.
Review the actual captures; tests alone do not establish visual accuracy.
