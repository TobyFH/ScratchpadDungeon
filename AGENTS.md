# Scratchpad Dungeon UI continuity

For UI work, read `UI_STYLE_GUIDE.md`, `UI_COMPONENT_RULES.md` and
`STYLE_CHECKLIST.md`. The user's supplied pencil-notebook reference is the art
direction: purposeful rough graphite, cream paper, legible hand lettering,
restrained functional colour. No decorative filler words, fake notes or random
scribbles.

Presentation sources are `ui/notebook.css` and `ui/drawings.js`. Existing layout
and animation choreography live in `ui/layout.css`. Run `npm run build:ui` to
embed sources/assets into the generated regions of `index.html`; don't edit
those regions directly. Keep the result self-contained and offline-capable.

Preserve gameplay rules, balance, RNG, existing DOM hooks and confirmations
unless the user requests changes to them. Art must never consume gameplay RNG.
Run `npm test` for changes and `npm run review:ui` for visual work; inspect the
screenshots at desktop and compact sizes, including applicable dialogs and
palettes. Don't claim an exact visual match based only on passing tests.

Camp progression, stable unlock IDs and persistent banking transactions live in
`game/progression.js`, embedded by the same builder. Never directly edit its
generated HTML block. Enabled rules are snapshotted per expedition; deposits
use a separate profile ledger. Read `docs/CAMP_PROGRESSION.md` before changing
that economy or its save migration/recovery.

Hero builds, reel edits and encounter presentation are embedded from
`game/hero-builds.js`, `game/reel-upgrades.js` and
`game/encounter-presentation.js`. Rolled-symbol flights and combat numbers come
from `ui/combat-feedback.js`. Read `docs/COMBAT_BUILDS.md` for shared rules and
save migration. Manual controls and autoplay must use the same edit validators,
prices and roll calculations; feedback and cosmetic modes must not consume
gameplay RNG. Rebuild and commit their generated HTML alongside these sources.

Temporary combat state, openings, statuses and focused enemy intent live in
`game/battle-tactics.js`; travel choices and lava lighting live in
`game/world-events.js`. Read `docs/BATTLE_TACTICS.md` for current rules and
version-20 migration. Mage Resonance is derived from rolled marks, never an
editable role. Temperament is fixed outside the starting choice. Berserker edits
must use `editableTypes()` and the same validators as player/autoplay edits.

Field-guide text and topic navigation live in `ui/field-guide.js`, embedded by
the same builder. Keep topics short enough to read without internal scrolling.

The economy, equal-face reels and exploration rules
are documented in `docs/EXPEDITION_UPDATE.md`; read it before changing them.
`game/economy.js` owns shop spending curves and permanent training lookup;
`game/encounter-journal.js` owns bestiary IDs/receipts, lore and zombie selection;
`ui/notebook-pages.js` owns utility suspension, portrait motion and fixed loot
browsing. All are embedded by the builder. New hero faces start at weight one;
paid weighting is retired; all hero faces remain weight one. Class marks remain unique/permanent.
Utility pages must suspend an existing confirmation without discarding its DOM
callbacks. Keep journal encounter/death receipts idempotent across reloads.
Camp lessons use the highest selected rank, bounded by ownership, never additive ranks; selections apply to future runs.
Lava stays impassable; floor generation and save repair preserve the stair route.

Automatic confirmation/arrival timing lives in `game/automation-pacing.js`.
Both drivers must share its gate; manual buttons remain immediately usable.
Critical presentation uses `criticalFigures`/`criticalPayoff` and updates one
reserved number node. Do not reinsert a calculation grid or transient result box.
Damage flights return completion promises; Fury lifesteal waits for outgoing
arrivals, then sends healing back from victims before restoring caster HP.
Poison uses its own purple identity and does not consume direct-hit Vulnerable.
Bridge terrain art is independent of active/spent discovery icons and never fades.

Read `docs/CAMPFIRE_UPDATE.md` for version-19 rules before editing progression,
reel presets, luck or exploration. Campfire Lessons separates owned and active
ranks; eight families have five ranks each, and eight Challenges are untiered.
`game/character-events.js` owns the saved personal luck stream/receipts;
`game/auto-builds.js` owns AI editing preferences and paid solo repairs;
`game/jester.js` owns ordinary Jester critical dispatch, anticipation, one six-mark
Punchline burst per action and six Wildcards; `game/exploration-rules.js` owns command-aged ambushes and
reserved fountain rows. All are embedded sources. Ambush age must never resume
using wall-clock time. Bridges have no discoveries. Future UI should preserve
bulleted guide pages, equal unlock cards and stationary paginated camp controls.

Read `docs/PUNCHLINE_UPDATE.md` for current version-20 rules. Self/ally stimulants are distinct validated face types with a shared three-action overflow model. Floor connectivity must count reciprocal tunnel edges; never force physical bridge repairs across valid portal routes. Punchline now fires six actual ordinary marks (see COMBAT_IDENTITY.md), never edits purchased reels, grants extra turns or chains itself.

Read `docs/BIOMES_UPDATE.md` for current version-21 rules. `game/biomes.js` owns named themes, directed ice movement and bounded mushroom reveals; `game/biome-enemies.js` owns themed species and the self-destruct lifecycle. Generation must preserve a real slide/tunnel stair route. Keep all class tuning in shared hero helpers; Blood Price and Trick are class-exclusive. Fury capacity scales by level; every actual HP restored spends charge. Autoplay repairs class identity through paid validators. Gold critical lock callbacks update one reserved payoff without a later delay.

Ice generation must preserve escape to stairs from every traversable tile, not just spawn. Known ice may lead onto covered landings; do not restore a seen-only landing restriction. Crystal aura/seal rules live in `game/biomes.js`; `giftedReels` applies temporary gems and `clearBattleStatuses` clears them. Read the follow-up in `docs/BIOMES_UPDATE.md` and run `tests/ice-crystal.test.cjs` after movement, terrain or starter-card changes.

Read `docs/BALANCE_PASS.md` before balance changes. `game/balance.js` owns shared
linear damage tiers, class critical pools, floor budgets and base species data.
Keep UI descriptions, real rolls and AI expectations in agreement; never change
art for a numeric pass. `npm run audit:balance` uses real browser combat in a
controlled gauntlet, not a claim about player campaign win rates. Preserve
previously paid reel-refund receipts and owned camp IDs when retuning prices.

Read `docs/COMBAT_IDENTITY.md` before changing current combat. It supersedes
older weighting, Punchline, Fury, stun and unlimited-shield examples.
`game/balance.js` owns caps, complementary marks, Bash budgets and retirement
refunds. All block sources must use shared capped helpers. All healing must use
shared Fury spending. Stun wards last two own completed actions on both sides;
never extend stun by repeated application. Jester bursts draw six ordinary
marks from real reels, never crit, reroll, refill anticipation or duplicate
once-per-roll equipment procs. Preserve equal-face saves and idempotent refunds.

Read `docs/CLARITY_UPDATE.md` for version-22 availability, permanent Jester
mysteries, fixed all-find loot and living terrain. `game/combat-clarity.js` owns
shared hero locks/recovery, flat Pennant and grouped real-action logs;
`game/living-dungeon.js` owns safe mud/rockfall mutation and biome-only shadow
cover/ceiling counters. A solo/all-stunned missed turn now advances enemy clocks.
Mysteries are immutable one per Jester reel; exact probabilities, AI and actual
rolls must share their unrestricted type/rank distribution. Mud placement must
prove every ordinary tile can reach stairs with all mud closed, and route state
must not reuse consumed mud. Ordinary ambushes remain command-aged; only Shadow
biome cover has a paused active-exploration clock. Run the focused clarity and
ice/crystal tests plus both visual reviews after changing these systems.

Read `docs/LIVING_PAPER.md` before changing current support/Execute formulas or
portrait motion. Ranger seals fire independently; stored Execute is a separate,
capped selected-target hit after ordinary damage and never crits twice. A whole
enemy turn grants one patience, irrespective of strikes. Mage late recovery and
well depth bonuses use shared helpers in hero-builds.js and AI forecasts.
`ui/combat-life.js` / `.css` own character life, spring-box FX and concise
artefact summaries. Keep finite FX cancellation-safe, tooltip badges intact,
slider/reduced-motion support, and illustration transforms separate from hitboxes.

Optional terrain motion is isolated in `ui/terrain-motion.css` and
`docs/TERRAIN_MOTION.md`, with its own saved Display toggle and separate commit.
Keep it cosmetic and independently reversible: animate revealed water/embers,
never tile geometry, blocking boundaries, bridge decks, fog or gameplay data.

Original score data and deterministic music arrangement live in `ui/music.js`,
embedded by the builder. `GameSound` in index.html schedules those cues through
its existing pooled music bus, gain controls and limiter; never use gameplay RNG
for composition. See `docs/BATTLE_POLISH.md` for Display layout and shared stun
reel presentation contracts and their browser checks.

The unified Event log is owned by `game/event-log.js`; read `docs/EVENT_LOG.md`
before adding records. Keep `state.logs` compatible plain strings and snapshot
explanations in bounded `logDetails` metadata. Named moments/trait changes must
survive nested combat groups; class bonuses stay inline in the action summary.
Use the shared underlined `.log-term` and viewport tooltip. Local ambient hazards
only log when seen, within two tiles and in sight. Categories prepare a future
split without introducing another log today. Logging never consumes gameplay RNG.

Read `docs/EXPEDITION_EXPANSION.md` for save-23 world and recovery rules.
`game/expedition-expansion.js` owns selected biome discoveries and shared tuning.
Keep fragile ice safe with all fragile/mud tiles closed, and preserve directed
slide/tunnel routes. Quartz radius is one; coverage is a union, effects never
multiply with overlapping sources. Molten rivers retain river/bridge topology.
Self-heal is `selfheal` on a face and `selfHeal` in effect totals; never retarget it.
Berserker Fury survives fights and decays per walked tile, not per move command.
Use shared semantic feedback inks and cancellation-safe class sketches; neither
hover, animation nor margin drawings may consume gameplay RNG.

The icon workshop is an independently reversible presentation in
`ui/icon-reel-workshop.js/.css`; read `docs/ICON_REEL_WORKSHOP.md`. Switch
`reelWorkshopLayout` to `legacy` to restore the retained `legacyEditor()` and
rebuild. Direct tier quotes must simulate shared `applyFaceEdit()` validators,
then commit atomically with actual paid receipts/refunds. Never fork prices or
let permanent class/mystery marks become ordinary editable symbols.

Read `docs/CURVE_TUNING.md` for current eligibility, encounter pacing, early
recruit receipts, exclusive nests, temperament, traits and recovery numbers.
Use `chooseFloorBiome` / `availableBiomes` for unbiased eligible themes.
A nest has one saved `nestContents` value and its mother check requires the
actual drop claim; never infer taking from a bag-count change alone.
Boss defensive palettes and caps share `enemyFacePalette` / `enemyReelRank`.
Stimulant bonuses, overflow threshold and cap must agree in rolls and tooltips.
The icon workshop no longer has a class-price page; keep prices on choices.

Read `docs/ENVIRONMENTAL_MECHANICS.md` before changing dynamic biome terrain.
`game/environment.js` owns completed-journey receipts, protected escape proofs,
root continuations and seven shared features; `ui/environment.js/.css` owns their
pencil overlays and closed-edge drawings. Room payloads remain separate from
`cell.env`; seismic swaps move all non-anchored metadata without rerolling it.
All traversal, including ice and pursuers, must use the same corridor edges.
Never melt occupied crust, depend on temporary crossings for escape, or allow an
optional Heartwood victory to mark the staircase defeated. Run the environmental,
ice/crystal and full suites plus the environmental and notebook visual reviews.
