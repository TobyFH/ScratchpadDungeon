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

The current economy, equal-face reels, paid weighting and new exploration rules
are documented in `docs/EXPEDITION_UPDATE.md`; read it before changing them.
`game/economy.js` owns shop spending curves and permanent training lookup;
`game/encounter-journal.js` owns bestiary IDs/receipts, lore and zombie selection;
`ui/notebook-pages.js` owns utility suspension, portrait motion and fixed loot
browsing. All are embedded by the builder. New hero faces start at weight one;
only validated paid weighting changes odds. Class marks remain unique/permanent.
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
`game/jester.js` owns ordinary Jester critical dispatch, anticipation, one boosted
Punchline per action and six Wildcards; `game/exploration-rules.js` owns command-aged ambushes and
reserved fountain rows. All are embedded sources. Ambush age must never resume
using wall-clock time. Bridges have no discoveries. Future UI should preserve
bulleted guide pages, equal unlock cards and stationary paginated camp controls.

Read `docs/PUNCHLINE_UPDATE.md` for current version-20 rules. Self/ally stimulants are distinct validated face types with a shared three-action overflow model. Floor connectivity must count reciprocal tunnel edges; never force physical bridge repairs across valid portal routes. Punchline uses temporary tier-adjusted copies, never edits purchased reels, never doubles critical multipliers and never chains itself.

Read `docs/BIOMES_UPDATE.md` for current version-21 rules. `game/biomes.js` owns named themes, directed ice movement and bounded mushroom reveals; `game/biome-enemies.js` owns themed species and the self-destruct lifecycle. Generation must preserve a real slide/tunnel stair route. Keep all class tuning in shared hero helpers; Blood Price and Trick are class-exclusive. Fury capacity scales by level and actual lifesteal spends charge. Autoplay repairs class identity through paid validators. Gold critical lock callbacks update one reserved payoff without a later delay.
