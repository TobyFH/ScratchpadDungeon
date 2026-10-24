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
version-17 migration. Mage Resonance is derived from rolled marks, never an
editable role. Temperament is fixed outside the starting choice. Berserker edits
must use `editableTypes()` and the same validators as player/autoplay edits.

Field-guide text and topic navigation live in `ui/field-guide.js`, embedded by
the same builder. Keep topics short enough to read without internal scrolling.
