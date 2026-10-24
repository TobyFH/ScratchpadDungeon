# Hero builds and readable combat

The runtime is still one self-contained HTML. `tools/build-ui.cjs` embeds these
source modules; edit the sources and regenerate rather than editing marked HTML:

| Source                           | Responsibility                                                             |
| -------------------------------- | -------------------------------------------------------------------------- |
| `game/hero-builds.js`            | Temperaments, natural Resonance, Fury, Execute, shared enemy block helpers |
| `game/reel-upgrades.js`          | Prices, refunds, edit validation and the reel workshop                     |
| `game/economy.js`                | Shared shop prices and permanent training lookup                           |
| `game/encounter-journal.js`      | Persistent creature records and returned adventurers                       |
| `game/automation-pacing.js`      | Shared reading/arrival holds for both automatic drivers                    |
| `ui/notebook-pages.js`           | Suspended utility pages, portrait motion and fixed loot browsing           |
| `game/encounter-presentation.js` | Cosmetic pun identities, paired arrivals and declined-recruit outcomes     |
| `ui/combat-feedback.js`          | Rolled-symbol flights, beam selection and split numeric feedback           |
| `ui/drawings.js`                 | All ordinary and pun pencil illustrations                                  |

## Builds

New adventurers have **Aggressive** or **Defensive** temperament, independently of
class and earned trait. Starting heroes let the player choose; wanderers receive
one randomly. Aggressive adds one to a damaging roll (blade or magic), poison power
and stun power when present. Defensive adds one to healing (targeted or party),
team block and stimulant power when present. Blanks never gain an effect. These
bonuses apply before critical multipliers and are included in Autofight estimates.

Tank, Rogue and Mage are initially available; Ranger and Berserker require
permanent camp unlocks. Mage
replaces the old Healer. Mages have no chosen speciality or role stat. Resonance
follows the actual healing, shield, poison or spell marks rolled, with the
weighted wheel as a fallback. Healing Resonance also clears every ally's stun.
See [Battle tactics](BATTLE_TACTICS.md) for the formulas, fixed Aggressive/Defensive
temperaments, Berserker Fury, openings and status interactions.

Ranger **Execute** stores patience, from zero to six. Each party action on which
that Ranger does not attack adds two; its own nondamaging seal roll adds three.
A missed stunned action counts as waiting but still leaves enemy clocks intact.
The next damaging Ranger roll consumes charge. Against the selected enemy:

`ceil((3 + .75*level) * charge/6 * (.5 + 2.5*missingHealthFraction) * sealBoost)`

`sealBoost` is 1.35 when its seal also lands, otherwise 1. The bonus is added
before critical multiplication. The existing caption meter shows patience and
the bonus against the current target. Selecting a different enemy refreshes it.
Charge clears after combat. Inventory use is not a new party action.

## Workshop and points

Click a portrait or its points reminder to open the workshop; hero card/name/HP
and reel controls still spin. Dedicated target controls and Shift+1–3 select a
healing recipient. In combat, portrait hover shows battle information; outside
combat it retains lifetime statistics. A reminder appears at
`points >= max(6, level * 3)` and never moves its clickable hitbox.

The workshop selects one reel and one weighted face at a time. Its edit and
critical pages reserve their shared maximum content height, so the note and Done
button cannot overlap long descriptions. Compact headers omit repeated context
while retaining the actual effect and editing controls. All seven
shared powers, plus Berserker Blood Price, support tier IV. Upgrade costs retain class affinities; Mage
healing, shields, magic and poison share its favourable affinity. Empty-face
inscription costs three for the class/temperament's primary type. Symbol swaps
have an explicit destination dropdown and show their price before committing.

Downgrade removes **one tier** and refunds half that tier's actual paid price,
rounded down, with a minimum of one point. `face.investments[tier]` records paid
upgrade costs. Initial/legacy faces without a receipt use their class's tier
price. Swapping pays for the destination and resets the applicable receipt.
A complete upgrade/downgrade cycle always loses points, so repeated edits cannot
farm points. All fresh faces start at weight one, including the class mark.
Weight purchases add one draw weight for 4/8/12 points (class mark 6/12/18), up
to weight four; symbol/power edits preserve that purchased weight. Weighting has
no downgrade refund. The Critical odds page enumerates exact type-and-rank
combinations, including the middle class wildcard. See
[Expedition update](EXPEDITION_UPDATE.md#reels-equal-faces-and-paid-weighting)
for the formula. On compact screens, a native face selector and fixed Power,
Replace and Weight pages keep text and controls legible without internal scrolling.
Exactly one class seal is mandatory on the
middle reel: it cannot be upgraded, downgraded, swapped away or copied by any
manual or automated edit. Autoplay evaluates explicit legal swaps and upgrades
through the same validator and prices.

## Protection and encounters

`state.enemyBlock` is the sole enemy block pool. Every living enemy can add to it
and damage to either enemy consumes it. Legacy `e.block` accessors alias this
value (without duplicating it in saves) for compatibility; gameplay writers must use `setEnemyBlock` /
`gainEnemyBlock`, never write individual fields. Piercing poison bypasses it;
stun consumes up to six block per power; greater power can pierce protection.
Solo protection sits below its portrait. Paired fights have one larger protection
row above both portraits; it represents the same shared count.
Intercepted attacks hit that shield, with a separate flight/beam for HP overflow.

The **Unbroken page** consumable blocks every damage hit during the next actual
enemy's complete turn, including every strike/critical segment. The enemy still
rolls normally. Existing party block is not spent. Protection expires in a
`finally` block after that enemy's turn; a second enemy's separate turn is not
protected. A stunned enemy which never takes a turn does not consume it. It can
appear in ordinary loot and shop stock and uses the existing three-pocket bag.

Declining a wanderer has a 16% chance of a real hostile encounter, a 22% chance of
a confirmed gold gift (`4 + 2*floor`), otherwise a farewell. Refusing a replacement
can have the same consequences. Acceptance still allows choosing a retiring
party member when all three slots are occupied; retirees remain in final records.
Every arrival names and illustrates the whole encounter, and each portrait flies
to its own combat position on confirmation. Animation skipping keeps the final
positions/effects without waiting for travel.

Wells now offer `ceil(maxHP * .15) + ceil(rolledHealing * .5)`. Triple matches
multiply the entire offered amount by 1.25/1.25/1.5/1.75, preserving visible
uncapped base/final offers even when missing HP is lower. The critical readout
transforms its original number to the total; it does not insert a calculation box. Traps use
`0.5 + floor * .2` power per danger tier. Solo companion discovery gains an
additional 4.5/3/1.5 percentage points on floors 1/2/3; later-floor pity remains.
Aged explored tiles still use the existing invisible ambush clock, which pauses
in combat/popups. There is no visible fog and no change to ambush probability.

## Presentation preferences

**Effects** in the toolbar and Options selects rolled icons (default), beams or
both. Icons leave the contributing reel windows, ease along a shallow arc, pulse
at their recipient and burst. The target is resolved again on arrival so an
instant-speed rerender does not swallow the impact. Skip/reduced motion use brief
feedback. Damage/healing retains a clear total; smaller offset values distribute
that applied amount across contributing faces and rise/fade independently.
These are visual divisions, never extra damage or healing.

**Pun-nishing Mode** in Options changes names and pencil art only. Species IDs,
HP, damage, reels, clocks, passives, drops and gameplay RNG stay unchanged. The
pursuer becomes The Progress Eraser; the tenth guardian is THE FULL STOP, an
angry dot. The catalogue owns stable cosmetic IDs for all species and bosses.
Normal and pun species have distinct synthesised cries. Cries take priority over
a background/older voice when the shared twenty-voice pool is full, so large FX
bursts cannot silently drop an entrance or death. Mute/SFX volume still apply.

Version 18 preserves points, wounds, edited symbols/ranks, equipment and history.
Legacy Healers still become Mages retaining their healing faces; old Mage role
fields disappear. Exactly one middle seal is retained/restored, stray seals become
blanks, and shared enemy block is consolidated. Pre-18 authored hero weights reset
to one, so existing heroes also receive equal initial face odds. Paid version-18
weights survive reloads. Lava is made impassable and the staircase route is
repaired if necessary. New preferences are validated and persist across runs.

Run `npm test` and `npm run review:ui`. `tests/combat-builds.test.cjs` exercises
actual browser interactions, refunds/invariants, migration, Resonance effects, Execute,
shared block, immunity, paired arrivals, pun presentation, voice saturation,
projectiles, numeric feedback and compact workshop layout. Older mechanical
fixtures use neutral temperament to isolate their base-value assertions; the
new build tests exercise both real temperaments directly.
