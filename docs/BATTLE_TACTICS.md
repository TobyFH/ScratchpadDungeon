# Battle tactics and exploration

The distributable remains the offline `index.html`. The builder embeds sources;
never edit a generated region directly. Hero identity lives in
`game/hero-builds.js`, the workshop in `game/reel-upgrades.js`, temporary combat
rules in `game/battle-tactics.js`, and travel discoveries/lighting in
`game/world-events.js`. Feedback stays in `ui/combat-feedback.js`; paint belongs
in `ui/notebook.css`, artwork in `ui/drawings.js`.

## Identity and wheels

Aggressive (`offence`) and Defensive (`defence`) are permanent temperaments.
Only the starting screen offers a choice; recruits receive one randomly.
Aggressive adds one to meaningful damage, poison and stun effects. Defensive adds
one to healing, block and stimulants. Blank results never gain an effect.
Temperament appears once as an icon on the portrait, with hover details; the
workshop spells out its name and bonuses.
It is separate from the single earned character trait.

A Mage has no role selection or saved speciality. Resonance examines the ordinary
marks in the current roll: magic, healing, shields and poison are compared by
actual tier power. Temperament gives the relevant categories a 12% tie preference.
If no matching power was rolled, the edited, weighted wheel supplies the fallback.
Magic Resonance adds `4 + floor(level/2)` magic against the enemy team; healing
adds `3 + ceil(level/2)` HP per ally and clears all allied stuns; shields add
`4 + floor(level/3)` shared block; poison adds `2 + floor(level/3)` poison power
against all enemies. There is no hidden editable Mage role.

Berserker starts at 38 HP. Its allowed ordinary marks are blades, healing,
**Blood Price** and blanks. All edit paths, recruitment upgrades and save
normalisation enforce this list. Blood Price pays up to two HP per rank, leaving
at least one HP, and grants three extra Fury per rank. Actual HP wounds add
`ceil(damage * 1.5)` Fury, including Blood Price. Fury caps at twenty and each four
adds one blade damage; it remains until battle ends. **Bloodrush** adds four Fury
and two blade damage alongside the other rolled marks. Opening bonuses and
criticals can increase the positive effects. HP damage absorbed by block does
not feed Fury. Blood Price criticals multiply its extra Fury, never its HP cost.
The reserved caption beneath its machine contains the Fury bar. Starting reels
now contain Blade I/II, Healing I/II, Blood Price I and Empty (all equally likely).
Bloodrush additionally restores `4 + floor((level-1)/3)` HP to its **caster**,
independently of the selected healing recipient. Criticals scale that positive
heal normally. Existing edited/saved reels are preserved; fresh recruits/starts
use the new preset.

Every four Fury also grants 4% lifesteal, capped at 20%. A damaging roll offers
`ceil(actualEnemyHPDamage * rate)` healing, clamped by missing HP and adjusted by
normal healing-received traits. Fully blocked damage grants none. Fury is not
spent. Outgoing damage icon/beam promises must finish before healing marks travel
from the damaged enemy portraits back to the Berserker; HP recovery occurs when
those return marks arrive. Multiple victims contribute to one rounded offer.
This works in Icons, Beams and Both, respects utility-page suspension and never
changes damage based on a particle's position. Autoplay scores caster-only
recovery separately from healing a selected ally and accounts for self-damage.

Tank, Rogue and Mage are base classes; Ranger and Berserker require camp unlocks.
Each hero has exactly one permanent middle-reel class mark. Its odds cannot be
copied by editing. Manual play and autoplay use the same prices, refunds,
restrictions and weighted effects. The workshop explains every face, its chance,
what it does, the result of upgrading/downgrading, and an explicit replacement.

## Openings and intent

`TACTICS` owns the opening probabilities. Initiative has an 18% solo chance,
26% with two living heroes and 34% with three. One ready hero receives +25% to
positive roll effects if chosen for the first actual party roll. Choosing another
hero forfeits it; a stunned missed action is not an actual roll.

A fight activated from a previously covered tile has an 18% chance of surprise.
Each living hero then has a 48% chance of being surprised, with at least one
caught. A ready hero must make the first party roll; afterwards all surprise
restrictions clear. If everyone is surprised, each enemy takes one real opening
turn, with normal reels, effects and death processing, before the party acts.
Already revealed encounters, including beacon/room discoveries, do not generate
this fresh-tile surprise. Aged-passage ambushes retain their existing rules.

Enemy intent stores an actual target ID and a broad goal, chosen once on entry
and again after its turn. Low HP encourages recovery, a vulnerable party member
encourages a finishing attack, and relevant wheels can seek stun/poison/block.
Damaging rolls follow that target while it lives. The caption is a forecast,
not a guarantee of the random reel result. Rendering does not reroll intent.

Solo enemy protection sits below its portrait. Paired fights display one larger
shared protection row above the enemy roster. There is one authoritative `state.enemyBlock`, with
compatibility accessors, never two independently maintained pools.

## Status interactions

Stun consumes up to six block per power. With no block it applies normally;
rank-I power remains stopped by any positive block. Greater power has a growing
penetration chance, especially when the available block is small. The precise
formula is centralised in `stunResolution`. A stunned hero misses each attempted action without advancing or resetting enemy
clocks. A stunned enemy misses its scheduled turn. Recovery checks on missed
attempts and after actual combat rolls rise through 25%, 55%, 90%, then 100%
(mean 2.12 checks). The applying roll cannot immediately remove its own stun.
Healing can still cleanse it early.

A successful stun can leave **Vulnerable** with chance `min(.65,.25+.055*power)`.
A magic hit can do so with chance `min(.45,.18+.035*power)`. Vulnerable increases
the next actual HP hit after the applying action by 25%, then is consumed. Fully
blocked hits do not consume it. Both sides obey these rules. It does not amplify
the hit which applied it, or another segment of that same critical/flurry.

A heal can clear its recipient's stun with chance
`offeredHealing / (offeredHealing + sharedBlock + 4)`. A full-HP stunned target
remains a valid heal recipient. Healing Resonance guarantees cleansing every
living ally, including those whose HP is full.

Poison ticks have purple POISON labels/particles and red damage values. They
bypass block and do not consume or amplify Vulnerable; healing never consumes
Vulnerable either. The next real hit retains that status.

Poison has at most three remaining turns. Reapplications fill those turns and
bank excess duration potency; each three surplus points adds one tick damage,
up to eight. Strong venom items retain their acquired base tick damage. Damage
and duration are shown together. Poison, stun, vulnerability, Fury, Rage,
stimulants, patience, surprise, initiative and pencil blackouts all clear at battle end. Poison cannot
tick once either faction has no living members, including after a fatal critical
or Execute.

## Difficulty, rewards and discoveries

Early base damage gains `round(min(3, depth-1) * .6)`: +0/+1/+1/+2 through
floors one to four, then +2, retaining the existing later slope and clocks.
The Unwritten additionally gains 45% HP and 30% damage on floors four to seven,
and 16% HP/15% damage elsewhere. It has at least two strikes from floor eight.
These multipliers are applied once in `enemyBalance`, including save migration.

From floor four its first loot reel guarantees equipment, a strong supply or
Unbroken page. Consumable quality is evaluated three floors deeper; its other
reels also have a larger item share. This remains an actual visible loot roll.

`WORLD_BALANCE` raises normal shop chance to 36% (66% with Markets), river-bearing
floor chance to 41%, rare double rivers to 1.5%, and artefact weight from 18 to 22. Lava can appear from floor five, on 35% of floors, with a small chance of a
second puddle. Lava blocks movement; placement preserves connected walkable
areas and the distant stair route. Discovering any tile in its orthogonal cross
reveals that whole cross, including the lava, without activating its events.
Connected overlapping light crosses propagate. Covered lava has no identifying
DOM paint or event information.

Rare travel discoveries keep the same 2.5% check and twelve-step cooldown, but
now include a coin press, a cartographer trade and a cracked offering bowl as
well as bodies/rockfalls. Optional choices require confirmation. Risk rolls
show gold and possible damage before resolving; a safe offering bowl can very
rarely produce an artefact. A paid full-bag trade warns before deducting gold.

Three generic equipment pieces fit every class. Class-bound gear states its
restriction in bag, find, shop and equipment views. A full-bag shop purchase
asks for confirmation before gold or stock changes; cancellation preserves both.
Matching item types still stack without needing another pocket.

## New encounter and travel rules

The floor-six guardian is **The Graphite Gaoler**. Its arrival covers up to
`living heroes + 1` randomly chosen available reels; every third actual turn can
cover more. Covered windows roll EMPTY, cannot contribute an effect or critical,
then erase when their own hero rolls. A rare ordinary Gaoler can appear on floors
6–10 with the same passive. Its blackout and every other combat status clear at
battle end. Enemy badges pulse after the appearance sketch reaches its page;
Vulnerable, healing, summoning, fracture and blackout have distinct callouts.

Paired tunnels appear on 14% of generated floors; 8% of those attempt two pairs.
Pairs are reciprocal, connected and at least three Manhattan tiles apart, and
replace no existing discovery or barrier. Use/leave is explicit. Travel reveals
and visits the far entrance without recursively triggering it. Known entrances
can be passed through normally.

An earlier-floor fallen companion has a 4.5% chance to return on a later ordinary
encounter, at most once per memorial. This is a hostile zombie, not resurrection;
the original grave and statistics remain. The Unwritten dies when stepping onto
a **revealed, live trap**; it is removed and that tile becomes treasure. There is
no immediate gold, EXP or victory award; later visiting the chest rolls loot.

Healthy Autoplay now prefers a visible, estimated low-risk battle to known
stairs even when no longer underlevelled. Risk uses current party HP, actual
weighted damage expectations and the ordinary floor curve, without consulting
unrevealed contents.

## Presentation and verification

Flying icons are larger and their normal flight is 520ms at 1x, easing along a
shallow arc; other animation speeds scale it and Skip retains a brief impact.
Every tier, including IV, shares a constrained reel-window layout. Criticals
show the original value in one reserved readout while the multiplier spins,
then pulse that same node to the final damage/heal/gold number. No calculation
grid or result box is inserted. Effect-by-effect rounding and base/final values
remain in `state.lastCritical`, not extra on-screen blocks. The advance button remains enabled. Class marks, initiative,
passive activations, boss/elite tags and the second foe's entrance have distinct
bounded callouts. Reduced motion and existing FX/audio preferences apply.

Version 18 retains the version-17 migrations that remove saved Mage speciality without changing edited faces, HP,
points or equipment. It bounds migrated poison and transient statuses, preserves
opening restrictions, and updates existing pursuer strength once while retaining
its remaining HP fraction. Opening confirmations can resume after reload. Version 18 additionally equalises
old authored hero face weights, retains paid new weights, normalises blackout and
stun-age fields, and repairs the lava-safe stair route.

Run `npm run build:ui`, `npm test` and `npm run review:ui`. The tactics browser
suite covers both sides of the interactions and actual choices; older numeric
fixtures isolate temperament/opening/vulnerability where necessary. Review
workshops, paired shields, large numbers, tier-IV faces, lava and status labels
at 1920x1080, 1280x800 and compact sizes. The topic-based field guide in
`ui/field-guide.js` must remain readable at each size. The HTML must remain self-contained,
including all five supplied recordings.

## Watching automation

`game/automation-pacing.js` owns automatic confirmation timing. Encounter choices
wait 1,500 ms (1,800 for duals), normal results/choices 1,100 ms, shop purchases
700 ms, and memorials 1,500 ms at 1×. Times divide by the square root of the
selected animation speed, with a 320 ms minimum; Skip uses 5× as its reference.
Timing begins when the relevant button becomes available. Manual clicks are
never gated. Options/guide/bestiary suspension also pauses this reading clock.

An automated encounter pauses a further 680 ms (with the same scaling/minimum)
after portraits/statuses arrive. A fully surprised party also gets that moment
after the warning and before the enemies' opening actions. These are presentation
holds, not extra combat actions or changes to countdowns/RNG. Keep both drivers
on the shared `automaticConfirmReady()` gate; do not restore immediate `.click()`
calls in one driver. Different sequential confirmations receive their own hold.
