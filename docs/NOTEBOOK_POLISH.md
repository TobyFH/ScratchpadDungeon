# Earned classes, clearer combat and notebook polish

This pass keeps save version 24 and the existing pencil artwork. It supersedes
older descriptions of free Necromancer starts, Rogue healing and +1 temperament
bonuses. Sources below are embedded by `npm run build:ui`; never edit their
generated regions in `index.html`.

## Class availability and saves

`game/progression.js` owns the earned `profile.dungeonCleared` receipt.
`recordDungeonVictory()` accepts only a winning floor-ten state and is idempotent.
The Necromancer appears as a locked achievement card in character selection and
camp, with no price or purchase action. `startNewBook()` checks the achievement;
it is never part of `CAMP_UNLOCKS` or the wandering recruit pool.

Existing legitimate floor-ten gold-deposit receipts recover the achievement.
Loading an already-won floor-ten save also records it. Ordinary progress, unlocks,
gold and settings are retained. A past win with neither a victory save nor a
deposit receipt cannot be inferred. Existing Necromancer expeditions can continue.

Living adventurers still appear to a Necromancer. A frightened introduction
requires confirmation, then the usual hostile encounter sheet requires a second
confirmation. There is no join, gift or peaceful refusal branch in this case.
The normal living-party recruitment flow is unchanged.

Rogue editable types exclude both ally healing and self-healing. Existing Rogue
healing marks and last-roll marks become poison of the same rank, retaining paid
investment receipts. Manual edits, autoplay and forecasts use the shared class
permissions. Healing supplies and support from other heroes still work.

## Numeric changes

- `game/hero-builds.js`: Aggressive adds **2** to present physical, spell and
  poison effects; Defensive adds **2** to present healing, block and stun effects.
  This is once per effect category per roll, not once per symbol. It does not
  create a missing category. Shared base tier values are unchanged.
- `game/bloodbinder.js`: planting gains **one extra Seed per roll at level 5**,
  two at level 9. The bonus is added once after critical scaling, not per face.
  Normal Bloodbinder healing gains 2.5% per level after level 4, capped at 20%.
  Fixed Seed damage/shared healing remains exactly one per consumed Seed and
  does not receive this healing multiplier. Existing nonlethal face costs stay.
- `game/balance.js`: floors **2–5** receive approximately 7% more hit pressure
  than before this pass and a 4% health budget increase, subject to existing
  integer rounding and species rules. Floor 1 and floors 6–10 are unchanged.

## Loot ownership and replacement

`game/loot-additions.js` owns new stable item IDs and supply grades. Reuse the
existing art through `icon()`; no new asset or network dependency is introduced.

| Equipment | Eligible classes | Effect |
| --- | --- | --- |
| Blood Needle | Bloodbinder | +2 Seeds on a Seed-containing roll |
| Crimson Phial | Bloodbinder, Mage | +2 normal healing, +1 spell on damaging rolls |
| Bone Whistle | Necromancer | +2 Souls on a Harvest-containing roll |
| Ossuary Charm | Necromancer | Resist 1; +2 enemy-death recovery within the existing cap |
| Fool’s Coin | Jester | +1 anticipation on a Trick-containing roll |
| Hunter’s Token | Rogue, Ranger | +1 damaging-roll power; fifth roll adds stun |
| Warding Thread | Tank, Mage, Bloodbinder | +1 block each roll; +1 normal healing |

The new supplies are Clearing salts, Bitter draught, Winter dust, Soot bomb and
Travel broth. `availableLootTypes()` respects minimum floors and earned class
availability. Necromancer gear only drops during a Necromancer expedition.
`canEquipGear()` and `equipmentScope()` support one `job` or a `jobs` array;
all equip UI and autoplay use these helpers.

Intermediate grades are Field (floor 2), Tempered (5) and Veteran (8). Existing
Fortified/Potent/Masterwork IDs and values stay compatible. New grades have
non-numeric IDs; do not create fractional IDs that break DOM selectors. Recorded
stacks never improve themselves when descending. Explicit named supply variants
retain their own effects rather than silently becoming a basic family item.
The ordinary item pool weight rises from 21 to 30; Unwritten item weight from
80 to 90. Its scalable supplies use the stronger family grade, so a new early
variant cannot dilute the Unwritten's improved mid-floor loot. Gold and artefact
weights are retained.

`lootFindCarousel()` in `ui/notebook-pages.js` still shows every find in fixed
reserved cells. Equipment, artefacts and high-grade supplies stamp down from a
large scale with gold particles, a brief settle and reward audio. Entry remains
sequential and speed-aware. Manual confirmation stays immediately available;
automatic confirmation waits for entries to settle. Never consume gameplay RNG
for these effects or move the action buttons as items arrive.

## Presentation contracts

- `ui/ui-polish.css` owns the final component overrides: target controls, paired
  encounter rows, workshop detail framing and feedback layers. Reuse notebook
  tokens rather than introducing a second skin.
- Layer order is feedback **2000**, event sheets **2800**, utility sheets **3000**.
  Speech, roll captions and tiny action numbers remain below both sheets.
- Double encounters reserve independent rows for names, health, countdown,
  statistics and passive captions. Compact screens use a single column within
  each enemy card; desktop uses portrait + information, then its full-width reel.
- `selectEnemy()` updates selection, accessibility state, Execute and Seed
  readouts in place. Do not rebuild a portrait or restart its passive animation.
- The healing strip includes portraits, HP, a selected tick and a clear green
  border. Keep Shift+1–3 shortcuts and selected-target rules intact.
- During travel, a workshop request stops at the next safe ordinary landing.
  Forced ice movement and actual event resolution finish first. Requests are
  tied to the expedition and hero ID so restarting cannot open an old editor.
- Class marks have a permanent gold border on the middle-reel face list. The
  current-face panel has padding instead of a second dotted frame. Refund copy
  is centered. Equal-odds/tutorial material belongs in the guide, not a banner.
- Utility sheets show their actual title once. There is no generic notebook
  eyebrow and no Save HTML button in Options; the underlying standalone export
  remains for backups and existing keyboard/download integration.
- Noncombat criticals call `eventCriticalFX()` on the original event machine,
  flashing gold with outcome particles and the appropriate edge ink. Skipping a
  roll's visuals still produces its short payoff. No second modal is added.

## Copy and settings

`ui/creature-voices.js` owns hero lines by class/reason and creature lines by
species/reason. Keep lines short and conversational; animal sounds are valid.
New variations do not increase speaking frequency. Use `visualPick()` only.
`ui/field-copy.js` owns varied terrain descriptions and the inert future-settings
catalogue. Its deterministic description selection never advances either game
or character-event luck. Hidden tiles must not leak their contents through copy.

`faceDescription()` is shared by live slot tooltips and the workshop.
`classAbilityDescription()` is shared by class seals and character details.
State the power, recipient and important consequence; put editing tutorials in
the guide. Do not add filler, decorative notes or unexplained metaphors.

Effects defaults to **Both**, preserving explicitly saved Icon/Beam choices.
Coming Later has three fixed groups: display/language, controls, accessibility/
saves. Its 18 controls persist as previews but **do not implement** desktop
resolution, localization, rebinding, cloud saves or the other listed features.
All functional sound, brightness and effect controls remain separate.

`MUSIC_FADES` in `ui/recorded-music.js` is the single owner of recorded-score
ramps: out **.54s**, in **.78s**, first **.42s**, jingle duck **.078s**, recovery
**.36s**. These are 20% longer; no duplicate hardcoded ramps should be added.

## Challenge temples

The existing `stronghold` event is labelled **Challenge temple** on map details
and **Temple** in the legend. `WORLD_BALANCE.strongholdChance` is **4.7% per floor
before safe-placement rejection**, giving about a third of ten-floor runs.
Valid interior centres are ranked near the spawn/stair route, improving the
chance players actually see one. `templePlacementSafe()` simulates the full
enclosure and approach, rejecting covered spawn, isolated passages and a
stair route shorter than eight moves. The approach is opened before route repair,
so a temporary blockage cannot make repair carve through the enclosure.
The optional hard encounter and its rewards are unchanged.

A seeded 1,000-run × ten-floor generation sample measured **313/1,000 runs
(31.3%)**, with 364 temples, after this change. A smaller 300-run sample on the
prior code measured 227/300 (75.7%); many were presumably left covered. These are generation
measurements, not player encounter or completion rates.

## Verification

`tests/polish-update.test.cjs` covers earned availability, hostile recruitment,
Rogue migration, Seed/heal tuning, temperament, enemy pressure, stable enemy
selection, layers, critical FX, new loot/grades, travel editing, cosmetic RNG,
speech/copy, music/preferences and layouts at 1920, 1280, 390 and 320 pixels.
Run `npm test` and `npm run review:ui`; inspect desktop and compact captures,
especially paired enemies, healing controls, new gear and future settings.
Rebuild and commit `index.html` with its sources. Keep it playable offline.
