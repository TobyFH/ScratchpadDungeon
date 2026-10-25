# Campfire lessons, luck and the Jester

The standalone `index.html` is built from the existing presentation and game
modules. Run `npm run build:ui` after editing a source module; never edit a
marked generated region. No runtime asset server or external library is needed.

## New sources

| Source | Responsibility |
| --- | --- |
| `game/auto-builds.js` | Persistent automated build preferences, diminishing returns, support coverage, minimum offensive capability and paid solo respec |
| `game/character-events.js` | Ten rare personal moments, saved luck stream, cooldowns, receipts and optional trait associations |
| `game/exploration-rules.js` | Move-command ambush age, legacy bridge repair, lava proximity glow, directed tunnel feedback and reserved well results |
| `game/jester.js` | Anticipation/Punchline, temporary reel gifts/blackouts, six Wildcards and critical dispatch |
| `ui/reward-audio.js` | Replaceable synthesised reward/critical cues and varied shake profiles |

The camp catalogue and transactions remain in `game/progression.js`. Hero
presets remain in `game/hero-builds.js`; edits, weighting and refunds stay in
`game/reel-upgrades.js`. All automated edits use those same validators and prices.

## Campfire Lessons

There are four camp categories: **Adventurers**, **Campfire Lessons**,
**Challenges** and **Oddities**. There is no Provisions page. Lessons and
Challenges use stationary previous/next controls; four choices fit a desktop
leaf, two fit a compact leaf. Three adventurer unlock cards have equal geometry.

Eight lesson families each have five purchased ranks. Ownership is permanent;
`profile.activeTraining[family]` selects an integer from zero to the highest
owned rank. The minus/plus controls never purchase anything or refund ownership.
A new expedition receives only the selected rank per family. Buying a new rank
advances the active rank when the previous highest rank was active; an explicitly
lower selected rank remains selected. Omitted legacy selections default to the
highest owned rank. Bonuses use that rank, never the sum of lower purchases.

| Family | Each active rank adds |
| --- | --- |
| `vitality` | 10% base hero HP |
| `power` | 5% blade/magic roll damage |
| `experience` | 5% earned EXP, with fractional carry |
| `purse` | 50 starting gold |
| `recovery` | 1 HP to each positive healing effect |
| `warding` | 1 opening shared block per battle |
| `fellowship` | 5% companion likelihood, multiplicative with the normal pity curve |
| `fortune` | 3% chest/battle-spoil gold |

Existing prices for Vitality and the first three Power/Experience ranks remain.
The complete catalogue owns costs and prerequisites. Tier selection, purchases,
class invitations and enabled modifiers affect **future runs**, not an existing
run's `runRules` snapshot.

### Compatibility

The camp key/profile version remain compatible. Bank balance, deposit ledger,
class invitations and owned training survive. Retired Provisions purchases map
once to fully owned predecessor chains:

- `provisions` → `purse3` (150 starting gold).
- `hearty` → `vitality1` (10% base HP).
- `company` → `fellowship5` (25% companion likelihood).
- `springs` → `recovery3` (+3 HP per healing effect).

Disabled old purchases stay inactive. Existing permanent training is not disabled
by a disabled old purchase that maps to the same family. Old expedition snapshots
may retain their legacy rule IDs until that run ends. Previously edited wheels,
hero wounds and equipment are preserved. All migration writes are a single
validated profile write; existing Ranger retirement refunds remain idempotent.

The eight untiered challenges are Iron margins, Never alone, Dry ink, Restless
pages, Both ends sharpened, Glass courage, Gilded foes and Quick tempers. New
tradeoffs: Glass courage reduces starting HP by 15% and adds 10% blade/magic
power; Gilded foes adds 15% enemy HP and 25% battle-spoil gold; Quick tempers
shortens enemy frequency by one, minimum one, and adds 15% EXP. Oddities alter
world discoveries/routes: an extra chest plus trap, an extra beacon, more shops,
or a 50% tunnel-pair spawn chance. Their stable IDs and exact copy are catalogued.

## Reels and automated builds

Temperament changes **starting marks**, not the numeric strength of a rolled
mark. The former flat +1 temperament roll modifiers are removed. Tank base HP
rises from 44 to 48. Rank powers and critical rules otherwise remain shared.
Fresh presets use six equal-weight ordinary marks and one permanent middle seal;
existing edited faces/weights are retained. Class-specific edit palettes prevent
new marks outside that class's supported powers. Berserker now also permits
stimulants; Jester permits every ordinary type, including Blood Price.

Autoplay gives each hero a saved preference: Assault, Bulwark, Balanced, Venom,
Mender, Enchanter or Trickster. It is an AI editing preference, **not a selectable
Mage role or a combat-stat multiplier**. Support coverage and diminishing returns
keep it from spending every point on identical damage/healing faces. Every build
retains offensive capability. A lone support-only survivor can downgrade high
support marks for normal refunds and pay to inscribe real damage. This recovery
also works during Autofight when Autoplay is enabled; Autofight alone never
silently rewrites the player's wheels. If no legal affordable repair exists,
existing no-progress handling still pauses with an explanation.

Each successful hero critical grants one base EXP to its actor, including a
Flurry critical. The usual EXP modifiers/carry apply. Event/enemy criticals do
not award a hero EXP. This is an explicit exception to victory-only EXP.

## Jester

The Jester's invitation costs 1,400 banked gold. It unlocks starts and wandering
companions, with a 30-HP base. Its icon, cry and corpse retain the shared pencil
illustration contracts.

Current Jester rules are in [Punchline update](PUNCHLINE_UPDATE.md). It now uses
ordinary matching criticals, without backfire or doubled multipliers. Trick
marks build six anticipation for one temporary +1-tier Punchline roll. This
supersedes the original version-19 distinct-kind Jackpot/encore rules.

Wildcard chooses one of six equally likely tricks:

1. Black out one enemy reel until that enemy next rolls it.
2. Give one ally a stronger reel for two of that ally's rolls. Empty marks become
   rank-I primary attacks; other ordinary marks gain one rank, capped normally.
3. Roll an enemy's machine: its damage hits itself and its healing helps the party.
4. A pie fight damages every enemy and lightly hurts each ally, staying above 0 HP.
5. Scatter stronger healing to allies and a tiny amount to enemies.
6. Strike an enemy with a sharp card and heal a random ally.

Gifts never edit purchased reels. Gift/blackout visuals and exact hover details
are temporary and clear with all other combat statuses. Reversed rolls use the
on-page enemy machine; actor statistics receive actual damage/healing credit.

## Ten rare personal moments

The dedicated saved xorshift luck stream is seeded from the expedition ID, so
rendering, audio, animations and world RNG mocks cannot reroll these moments.
A fight permits at most two combat moments, with each hero/event receipted once
per encounter. Travel moments share an eight-command cooldown. Only one hero
receives each moment. A triggered moment has a 12% chance to leave its related
trait, respecting the existing trait-replacement cooldown.

| Combat moment | Eligible effect | Chance per eligible check |
| --- | --- | ---: |
| Heroic | A lethal wound from above 1 HP leaves the hero at 1 HP | 3.5% |
| Unshaken | Ignore an incoming unblocked stun | 5.5% |
| Last-second parry | Halve a direct incoming hit | 3.5% |
| Rally | A badly wounded actor mends one wounded companion | 3% |
| Inspired | Strengthen one positive rolled effect by 20%, minimum 1 | 2.5% |

| Travel moment | Effect | Chance per eligible check |
| --- | --- | ---: |
| A keen eye | Find a few loose coins in a newly explored empty room | 1.2% |
| Second breath | Recover a little missing HP on the road | 1.2% |
| Sure footing | Halve trap/rockfall/ruin damage | 5.5% |
| A lesson learned | Gain one personal point in a newly explored room | 0.8% |
| Listen closely | Reveal one adjacent hidden discovery without activating it | 1.2% |

Moments use bounded callouts, appropriate particles/audio, a journal entry and
receipts in `state.characterEvents`; they do not add another confirmation popup.

## Exploration and feedback

Run version 19 replaces elapsed-time ambush aging with `moveCommands`. Accepting
a different valid destination counts once; redirecting a walk counts again.
Traversing a long route is one command. Invalid/no-op clicks do not count.
Previously revealed traversable tiles become ready after 12 commands since the
player was last within one tile. Proximity resets a tile's command stamp before
readiness; once ready it stays so until entered or cleared by a nearby ambush
victory. Entry into an empty/resolved ready tile retains the 12% encounter check.
No fog overlay appears, no clock advances while waiting, and no idle save timer
is needed. Migrating old runs resets their timer-based readiness once.

Bridges never receive generated stairs/shops/discoveries or minor body/rockfall
events. Ordinary empty-room moments and ambushes can still occur. Legacy bridge
discoveries move to reachable free floor tiles without destroying crossings or
live fights. River/bridge art is unchanged.

Stone blocks lava illumination as it blocks beacon light; revealing a stone wall
cannot wake lava behind it. A subtle distance-sensitive lava edge glow uses the
ambient-lighting toggle. All impassable terrain shares an inset graphite frame.
Paired tunnel travel draws an animated route from the real source to destination,
then places the token and arrival poof. Skip/reduced motion retain a brief cue.

Fountains reserve their artwork, reel, inline-critical and three recipient rows
before calculation. Result text changes within those rows and includes the same
uncapped trait/lesson healing offer used by actual recovery. Round sits beside
Combat and is hidden outside battle. Block starts slightly blue at zero and
strengthens to blue-silver through twenty, without capping the stored count;
both factions use the same colour curve.

Criticals keep the existing cue plus a quiet themed accent. The later update removes the extra coin-rush and gold-critical cues. Sequential item finds pulse
and chime in the fixed reward browser; automatic confirmation waits for that
sequence. Manual navigation/confirmation remains immediate. Shake profiles
separate rumble, recoil/impact, vertical jolt, reel settling and celebration;
all obey the existing shake control and reduced-motion setting.

## Resetting progress

Options → Play → Reset progress opens an explicit confirmation. It removes only
`scratchpad-dungeon-*` progress keys, retaining `scratchpad-dungeon-settings` and
unrelated local storage. Camp, run, bestiary and memorials reset; volume, pace,
palette, lighting, motion and other preferences remain. Reset is unavailable
while a journey/roll/event is pending; finish it before resetting. Storage errors
report failure and attempt to restore the original progress records. Save HTML
still backs up the game file, not browser-local progression.

## Verification

`tests/campfire-update.test.cjs` exercises selected/owned rank persistence,
legacy migration and banking receipts, progress-reset confirmation, new palettes,
command-aged ambushes and real redirection, bridge generation/connectivity, lava
occlusion/glow, tunnel travel, real normal-critical/Punchline outcomes, all six
Wildcards, rare-event receipts/traits, solo respec, compact card boundaries,
bulleted guide topics, fountain geometry sequential themed audio feedback, decimal/critical multiplier fit and complete
healing-offer totals.
Existing tests isolate the rare luck stream unless testing it deliberately.
Run the entire suite and browser capture tool; inspect both large and compact
screens, not just the test totals.
