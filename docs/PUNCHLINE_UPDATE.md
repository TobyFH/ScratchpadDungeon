# Punchline, support marks and tunnel crossings

This update uses expedition save version **20**. Camp ownership, banked gold,
settings and edited reels survive. The standalone HTML still has no runtime
network dependencies. Edit the source modules, then run `npm run build:ui`.

## Combat marks

`stimulant` is now **Self stimulant**, available to Tank, Rogue and Berserker.
It always targets its caster, independently of the healing selector. `rally`
is **Ally stimulant**, available to Mage, Ranger and Jester. It targets the
living companion with the most rolls **during the current battle**, excluding
the caster. Ties favour expected damage; with no living ally it targets self.
Existing support-class stimulant faces become the corresponding ally mark,
retaining rank, weight and purchase receipts. Storm Quill also uses Ally stimulant
for its every-third-roll effect. Consumables still target normally.

`applyStimulant` in `game/battle-tactics.js` is authoritative for all buffs:

- Add the incoming power to remaining duration, capped at **three recipient
  actions**. Another companion acting does not consume the buff.
- Power becomes `max(previous power, incoming power) + overflow duration`.
  Additional applications at the duration cap therefore increase potency.
- Damage bonus is `1 + floor(power/3)`; resistance is `1 + floor(power/5)`.
- The application action does not consume its own newly applied duration.
- Old durations above three convert their excess into power once on load.
- All buffs clear when combat ends. Exact remaining power/duration is hoverable.

Tank's permanent class mark is **Shield Bash**. It adds `2 + floor((level - 1) / 3)` team block, then
bashes the selected enemy for the existing shield count plus this roll's new
block. Ordinary critical multiplication applies once to each base effect.
Against enemy block, each point of bash power strips two block. Power remaining
after shield absorption deals ordinary HP damage; HP damage is never doubled.
A partial shield point rounds absorption up to whole bash power. Bash uses the
shared enemy block pool, normal resistance/Vulnerable rules, explicit shield
flights and ordinary combat statistics. It no longer generates Rage.

## Jester

Jester uses the same **matching type-and-rank triples** and ×2/×2.5/×3/×4
multipliers as every other hero. The middle class seal still completes matching
outer marks. Different kinds do not crit; matching triples do not backfire.
There is no special Jackpot or doubled multiplier.

New `trick` faces add their rank to **anticipation**, whose threshold is six.
A qualifying roll grants one free **Punchline** before enemy clocks advance.
The Punchline rolls the hero's actual weighted machine with every ordinary,
non-empty mark temporarily one rank higher, capped at IV. Empty/class faces
keep their normal semantics. Purchased faces and weights are never edited.
Punchline Trick results do not refill anticipation, so free rolls cannot chain.
If the caster falls before the bonus, no Punchline occurs and the paid action still advances enemy clocks. Excess charge from a normal roll carries up to five. The meter clears after
combat, persists during an ongoing saved fight, and is shown below the reels.

The permanent **Wildcard** mark retains six random, generally helpful tricks.
Punchline adds a restrained glowing/shaking machine, confetti, callout and cue;
skip/reduced-motion and shake magnitude still apply. The workshop's odds page
now shows normal critical probabilities. Initial Jester palettes include Trick;
existing Jesters can buy it through the usual replacement/upgrade controls.

## Automated builds and identity

Autoplay retains class-appropriate archetypes. Rogue and Berserker no longer
choose Enchanter. Self buffs have a low marginal value, no mandatory coverage
quota, and a face-density limit. Ally-support builds may carry a little more,
but reliable damage remains a separate goal from average roll power. Each reel
needs a reasonable damage chance, particularly for a solo survivor. A Mage with
two damage-focused companions places more value on healing, shields and stun.

Older automated stimulant-heavy builds are repaired using the same paid swaps
and partial downgrade refunds as the workshop. There are no free respecs or
invented points. Autoplay alone authorises these edits; Autofight alone does not
rewrite player builds. `game/auto-builds.js` owns scoring and repairs.

New recruits independently roll **50% Aggressive / 50% Defensive**, separate
from the chosen starter temperament. No streak smoothing forces a particular
outcome. Trait hover always gets mechanical effects from `HERO_TRAITS` and the
earning reason from its recorded event. Legacy missing/effect-only reasons are
labelled as unrecorded, never fabricated or displayed as a causal event.

## Terrain and travel

`floorNeighbors` and `tunnelDestination` in `game/world-events.js` define the
traversal graph. A tunnel counts only if both unobstructed ends reference each
other. Generation, reachability, staircase repair, load repair and lava safety
all use that graph. This permits intact river or rare stone barriers when the
tunnel supplies a crossing. Disconnected, unlinked regions remain impassable.
Stairs remain at least eight graph moves from spawn. Bridges stay empty terrain.

Known tunnel pairs are also valid edges in long-move routes. Crossing pauses
for the normal optional tunnel prompt; accepting continues toward the original
goal. Declining stops the journey. Unknown portals are never secret shortcuts.
Autoplay can investigate an unexplored tunnel end and accepts a known crossing
when it is part of its current route. The Unwritten continues to walk; its
spawn-distance calculation deliberately excludes tunnel edges.

Surprise/Ambush text is an additional animated overlay in a reserved roster
area. The centring wrapper never animates its transform, so title fitting and
portrait arrival cannot shift its horizontal position. The extra coin-rush and
gold-critical audio from the prior update is removed; the main critical cue,
existing coin cue, and sequential item-find chimes remain.

## Verification

`tests/punchline-update.test.cjs` exercises real buff targeting, duration and
migration; paid AI repairs and party needs; Jester criticals and a bounded boosted
roll; Shield Bash's HP/shield distinction; random temperaments and trait causes;
hundreds of connected maps including tunnel-only crossings; actual long-move
teleport prompts and save reload; and stable compact surprise placement.
Run `npm test` and `npm run review:ui`. Inspect the new Punchline, guide,
workshop, tunnel-crossing and surprise captures at large and compact sizes.

Current version-21 biomes, class repair preferences and small balance changes
are documented in [Biome update](BIOMES_UPDATE.md).
