# Scratchpad Dungeon

A hand-drawn notebook dungeon crawler in **one self-contained `index.html`**. Its handwriting font, illustrations, reels and effects are embedded. The game needs no network connection or runtime dependencies.

## Play

Download `index.html` and open it in a modern browser, or serve this folder:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000`. **Save HTML** downloads a complete offline copy of the game. Progress stays in this browser's local storage; the HTML download does not export a saved expedition. Older saves preserve edited faces and migrate to one middle-reel class seal. Surplus inventory types wait for explicit keep, use or discard decisions.

The notebook opens with a choice of **Tank, Rogue or Mage**, with locked Ranger and Berserker cards that open
their camp unlocks. A new expedition turns to fresh pages. Start with one hero and no items; keep at most three heroes. Every staircase has an elite guardian. Defeat it to descend when you choose. **Defeating the tenth guardian wins immediately**, with a celebration and a scrollable record of every survivor, fallen companion and retired adventurer.

## Camp and banked gold

After clearing floors 1–9, optionally bank **25%, 50%, 75% or 100%** of carried gold.
The remainder stays available for this expedition; banked gold survives deaths
and new runs. Each ordinary floor permits one deposit. **Winning floor 10
automatically banks everything carried, including the final reward**, with no
percentage choices. Its coin shower scales with the actual amount transferred.
**Upgrades** in the starting menu spends this pool on **55 purchases** across
Adventurers, Campfire Lessons, Challenges and Oddities. Eight lesson families
have five ranks each; buy ranks permanently, then choose the active rank with
minus/plus controls. Health reaches +50%, roll power and EXP +25%; the other
families improve starting gold, recovery, opening block, recruitment and loot.
Eight untiered challenges and four oddities are optional and apply next run.
Autoplay banks 25% on ordinary floor clears and never purchases camp unlocks.

Ranger's invitation (900 gold), Berserker's oath (750) and Jester's invitation
(1,400) unlock starts and wandering companions. Existing edited heroes are kept.
Gold income is unchanged, but shops and camp purchases now require meaningful
savings: a first-floor tonic costs 92 and a solo full heal 150.
There are no separate Ranger upgrades; previously purchased enhancements are refunded
to camp once. Ranger's **Execute** builds patience while other heroes act or it
rolls support. Its next damaging roll consumes the bar for bonus damage that
grows with the target's missing health. The meter shows the current target's
bonus. Other camp choices
change starting supplies/health, encounters, shops, wells, beacons and difficulty.
See [Camp progression](docs/CAMP_PROGRESSION.md) for prices, exact effects and
save/backup details. Camp progress uses browser local storage independently of
the run; downloading the HTML does not export either save.

## Explore

**Autoplay** in the top toolbar spends personal points on useful reel edits,
equips matching gear and the best owned passive, and weighs visible treasure,
companions, beacons, shops and reachable stairs. It saves active wells until the
party is hurt enough to benefit, then can return to them. After defeating a floor's
guardian it uses reachable, unused wells before descending if anyone is wounded.
It uses useful supplies,
shops within its budget, handles full-bag swaps and can replace a companion when
that improves level or role coverage. Unknown tiles never disclose their contents
to its planner; it can interpret the same sound/glimmer hints the player sees.
It assesses average level, expected damage and wounds before
heading for a guardian, preferring exploration or reachable supplies when behind.
It can seek ordinary fights for experience and eventually commits when no useful
preparation remains.

Enable **Autofight** alongside it for a hands-free attempt. Both modes briefly
linger on confirmations so their animations and contents can be watched; an
extra arrival pause leaves time to see enemy traits and party openings. Reading
holds scale with animation speed, using 5× for Skip, and manual clicks stay immediate. Autofight estimates
what each hero's actual reels can deliver, balancing damage, healing,
team protection, stun, poison and buffs. It selects targets and useful items,
including the ink bomb's confirmed roll. Repeated support turns give way to
offence; if no wheel or available offensive supply can hurt a foe, Autofight
pauses with an explanation rather than spinning forever. These are practical heuristics, not a
perfect player or a guaranteed win. Both modes use normal validated actions,
prices, enemy clocks, event choices and rolls. Autoplay leaves the final summary
open.
Options, the field guide and editors pause exploration. Disabling Autoplay
stops walking after the current step; Autofight remains an independent setting.
Without Autofight, Autoplay waits at combat. It leaves the final victory or
defeat summary open. Both toggles persist through reloads and new runs; the
starting class still needs to be chosen.

Click a reachable pencil-covered tile to erase it and walk into its discovery. Click a distant revealed tile to follow a shortest route across known ground. Routes avoid untouched fights and traps when possible. Click another valid destination while walking or erasing to redirect the party. Known wells, shops and ruins are ignored when merely passing through. Once its guardian is defeated, a staircase also permits uninterrupted passage; selecting it opens the descent menu again.

Walls, connected underground rivers and lower-floor lava block movement.
Wooden bridges show faded water beneath their planks. Rare paired tunnels offer
optional travel between distant entrances. Every floor randomises its layout and events. Stairs are reachable and at least eight steps from camp; generation can carve a route and bridge a river when necessary. Most floors have no river; a second river is very rare. Connected cave rooms reveal together without activating their contents.

- **Fights:** any living hero can act repeatedly. Ordinary double encounters rise from 2% on floor 1 to 7%, 13% and 18% on floors 2–4, then gain only one percentage point per floor, reaching 24% on floor 10. Each foe has an independent attack clock. Rare elite variants retain their species and gain an Ironbound, Frenzied or Venomous modifier, with an animated aura. Five additional species appear in successive floor pairs: Candle Gnawer, Blind Bellkeeper, Thorn Widow, Gutter Oracle and Page Eater.
- **Treasure:** roll gold, occasional supplies or equipment, personal points and rare artefacts. A rare chest is a mimic. Items pulse in the reward panel before claiming; coin showers scale with the gold awarded.
- **Traps:** a warning and illustrated spikes, arrows or boulder precede a danger check. Early damage is restrained. Confirm the outcome before it resolves.
- **Wells:** use one now or leave it active for later. Each hero starts with 15% maximum HP plus half a healing roll, with both amounts growing gently by floor. Fountain criticals multiply the complete offered amount by 1.25–1.75. Portrait effects show actual healing.
- **Beacons:** reveal adjacent cells in staggered waves. Sometimes another one to five cells in the next ring are lit. Stone blocks sight, including closed diagonal corners; rivers do not. Revealed events remain untriggered.
- **Wanderers:** preview a companion's class, level, health and introduction before accepting. Discovery odds rise after missed floors, with a small solo and early-floor bonus. Newcomers match the rounded average party level and arrive with some level-earned points spent on upgrades. With a full party, accepting opens a replacement choice. Companions who leave alive remain in the final records.
- **Shops:** a 40% chance per floor. Buy limited supplies, a full-party heal or a map marking the stairs. Buying a map never opens a descent prompt.
- **Ruins and strongholds:** optional mechanisms balance trap damage against loot. Rare walled strongholds hold a dangerous champion with rich spoils and a guaranteed stronger artefact.
- **Travel discoveries:** rare rockfalls roll a danger check; a forgotten traveller may have a satchel worth searching. Such discoveries can occasionally hold something valuable. Quiet movement itself never shakes the book.

Old passages can hide an ambush after **one minute of exploration time** away from the party's immediate neighbourhood. Battles, popups, menus and hidden browser tabs pause that clock. There is **no visible fog overlay**. Entering an aged, resolved tile has a 12% encounter chance. Ambushes arrive in a smoke poof with a banner; victory clears adjacent ambush age without revealing or activating anything.

From floor three, revealing enough walkable tiles can awaken **The Unwritten** far from the party. It advances one tile for every player step, including each step of a long route, aims to intercept, favours revealed paths and can disappear into an unexplored tile. It arrives with a small smoke/scratch burst and sound. Its mark is visible only on revealed ground. Contact starts a fight. Its health and strike strength have increased slightly. A revealed, untriggered
trap kills it and leaves a treasure tile, without direct gold or EXP.

Five further creatures join the encounter pools: **Tallow moth** (floors 1–3),
**Rust mite** (2–5), **Spore pilgrim** (3–6), **Mirror hound** (5–8) and
**Ash colossus** (8–10). Their reels, durability and later-floor passives differ:
from a fragile fluttering moth to a heavily armoured rubble giant.

## Reels and combat

Enemy strike strength stays in a tighter range (up to 125% of base damage,
before buffs), rather than multiplying high-tier damage disproportionately.
Enemy triple matches roll ×1.25 (50%), ×1.5 (25%) or ×1.75 (25%); hero and
event criticals retain ×2 / ×2.5 / ×3 / ×4. Top-tier final-guardian wheels,
frequent attacks and three strikes remain. Hover poison, rage, stimulant, stun,
Execute, elite and passive badges for current effects. Round/team block fade and
reset between fights. A final killing blow ends poison checks immediately.
The floor-six Graphite Gaoler can pencil out individual hero reels until those
heroes roll them clean. Rare later encounters can include a fallen companion
returned as a zombie; their memorial remains.

Heroes have six equally likely ordinary faces on each outer reel and seven on the
middle, including its **single permanent class seal**. Empty faces have no effect
and never crit. Click a portrait to open the reel workshop: choose a reel, a face,
then upgrade, downgrade for a refund, or explicitly select a new symbol. All faces
have equal odds. Weighting purchases are retired and old paid weights refund
personal points once. The workshop lists current face chances and every possible
critical combination. Compact screens use a face selector and fixed Power and
Replace pages. Downgrades remove one tier and refund half its paid price (at
least one point). Class seals cannot be removed or copied. Rank-up prices are
3 / 6 / 10 before class affinities; a Tank pays 6 to upgrade healing I → II,
a Mage 3. Every normal power supports tier IV.

Each hero has **Aggressive** or **Defensive** temperament, selecting a different
level-one mark palette without changing a rolled mark's power. Rebuild either
way. Choose it for your first hero; wanderers vary. It is separate from class
and any earned trait.

| Class     | Starting style                                         | Middle-reel ability                                           |
| --------- | ------------------------------------------------------ | ------------------------------------------------------------- |
| Tank      | 50 HP; blades and team protection                      | Shield Bash grants block, then spends it on a bounded strike                        |
| Rogue     | 26 HP; damage and poison                               | Flurry rolls three extra attacks                              |
| Mage      | 28 HP; build healing, shields, poison or spell damage  | Resonance echoes the rolled marks across the appropriate team |
| Berserker | 38 HP; unlock at camp; blades, healing and Blood Price | Bloodrush heals; charged Fury adds damage and lifesteal       |
| Jester    | 30 HP; unlock at camp; Trick and mixed marks | Wildcard plays a random trick; anticipation fires a six-mark burst |
| Ranger    | 30 HP; unlock at camp                                  | Execute rewards patience and finishing wounded enemies        |

Former Healers migrate to Mages with their existing stats and edited wheels.
There is no Mage role selector: builds follow the marks on their reels. See
[Combat builds](docs/COMBAT_BUILDS.md) for exact rules, migration and source files.

Physical and spell tiers deal 1 / 2 / 3 / 4 base damage per face. Healing and block tiers offer 2 / 4 / 6 / 8 HP or protection. Stun tiers contribute 1 / 2 / 3 / 4 power. **Three identical type-and-tier symbols crit** for ordinary classes; a middle class seal can complete two matching meaningful symbols while also casting its ability. A pair alone never crits. Jesters follow these same critical rules. Trick marks build six anticipation for a burst of six ordinary reel marks, with no reroll or additional critical. Hero critical pools differ by class (shown in the workshop); other event criticals use ×2, ×2.5, ×3 or ×4; wells use ×1.25–×1.75, with the original value pulsing into the amplified total.

Normal combat rolls stay on the right page. Criticals get a multiplier popup that lingers automatically; **Strike now** skips its result hold. Treasure, fountain and other event criticals stay inside their original panel and still require confirmation. Criticals show the original value while spinning, then pulse the same readout to
the final number; no calculation box appears. Critical damage lands as the
original hit followed by a separate bonus hit, each with its own selected icon/beam feedback, number and impact. Flurries likewise produce separate hits. Criticals and tier III / IV attacks hit every enemy. Click a hero card's name, statistics or blank space to spin; portraits open upgrades, and equipment/editor buttons keep their own actions. A focused card also spins with Enter or Space. Hover a portrait for compact battle statistics during combat and lifetime statistics outside it; status badges keep their own tooltips. A points reminder opens the workshop when points accumulate. Healing targets retain their dedicated buttons and Shift+1–3 shortcuts.

A single-target healing roll or tonic aimed at a full-health, unstunned hero redirects to
the living wounded hero with the **lowest raw HP**, not the lowest percentage.
A partially wounded selection stays selected even if some healing is wasted.
Party heals, wells and floor recovery retain their individual per-hero amounts.

**Enemy team block** is now shared too, with a fixed visible shield/count. **Unbroken page** blocks the next enemy’s complete turn, including all strikes, while preserving normal block. **Party team block** is a shared consumable pool, depleted point for point by damage and cleared after combat. Intercepted enemy attacks strike the team shield; any HP overflow also fires at the wounded hero. A fully absorbed hit shows a shield on its recipient. Its blue-silver tint deepens from 0 to 20 block; party protection caps at 20, or 30 with a living Tank; enemy caps are 20, or 30 with a living boss. Weak stuns are stopped by any positive armour; stronger stuns consume more and can penetrate it. Stun costs at most one missed go. Background recovery takes at most two checks;
recovery grants protection against re-stuns for two own completed actions. Missed hero attempts
never advance or reset enemy clocks. Enemy attack frequency determines how many player actions occur between attacks; difficult enemies can make multiple separately rolled strikes.

Enemy damage now grows faster with depth. Attack and magic faces advance on
floors 4 and 8; species keep their usual mix of powers. The final guardian acts
every two player actions (one when Frenzied) with **three independently rolled strikes**, tier-IV
attack/magic faces and tier-III support faces, with no dud entries. New
encounters use this curve; migrations preserve hero wounds and edited reels.

| Attack strength | Floor 1 | Floor 5 | Floor 10 |
| -------------- | ------- | ------- | -------- |
| Ordinary enemy | 3       | 7       | 12       |
| Stair guardian | 4       | 8       | 14       |

Berserkers begin with Healing I and II on every reel. Bloodrush heals the caster
and fills Fury; capacity starts at 24 and grows by three per level. Each four
Fury adds damage and 4.5% lifesteal, with a level-scaled cap. Actual healing spends
some Fury. Real unblocked damage
lands before healing marks return from the enemy and restore HP.

**Poison** has purple POISON callouts and does not trigger Vulnerable. Healing
also leaves Vulnerable for the next actual hit. Poison holds at most three remaining turns. Repeated doses increase its armour-piercing tick damage rather than building a long duration, with visible ticks and kill credit. **Self stimulant** boosts its caster; **Ally stimulant** boosts the companion used most this fight, or self when alone. Both last at most three recipient actions; extra duration becomes potency. Both increase damage and protection and show a glow. Rage, Execute, Fury, poison, stun, Vulnerable and opening buffs end with combat. Level-ups add 6 maximum HP and 4 personal editing points, with portrait and machine effects. EXP comes from successful battles plus one base EXP for each hero critical; surviving heroes also gain one editing point per victory.

The **Autofight** checkbox (Autoresolve in Options) chooses heroes, targets and occasional useful emergency supplies. It preserves the selected animation speed and all combat feedback. Enemy entrances confirm automatically; other choices wait for the player unless Autoplay is also enabled. Untick it to take over between actions.

## Supplies and equipment

The satchel holds **three item types**, with matching items stacked. Inspect to use or discard. If full, swap out a stack, use an item immediately when applicable, or leave the find. Pending choices survive reloads. Items do not advance enemy countdowns.

Consumables: Healing Tonic, Ink Bomb, Paper Ward, Antidote, Field Bandage, Mending Salve, Ember Draught, Sharpening Oil, Frost Vial, Cinder Flask, Venom Ink, Surveyor's Chalk and Trail Ration. Ink Bombs roll damage and poison on a slot machine; matching results crit.

Consumable power is fixed by its item ID: an old Cinder Flask always deals 10
spell damage, regardless of the floor where it is used. Tonic, bandage, salve,
ward, cinder flask, ink bomb and venom vial also have **Fortified** (floor 4+),
**Potent** (7+) and **Masterwork** (10) variants. Deeper loot and new shop stock
use the appropriate variant. Matching IDs stack; stronger variants are separate
item types. Descriptions show the acquired strength; old saves keep base items.

Species now have different health multipliers and weighted reels: wraiths favour
magic and stun, widows poison, slimes healing and shields, bellkeepers armour and
stun, and demons attacks and stimulants. Strong enemies and some elites gain a
labelled passive: **Armoured** resists each hit, **Second wind** heals once below
30% HP, **Summoner** calls a lesser ally every third turn into a free second foe
slot, and **Fractures** becomes a weaker fragment once. Summons cannot summon.
The last guardian retains three strikes with top-tier attack and support faces.

Clearing a staircase guardian adds a confirmed celebration with that floor's
victories, steps, revealed tiles, net gold, damage, healing, EXP, supplies used and
elapsed time. Records are stored once per floor. Net gold includes purchases;
legacy saves start the first available snapshot when loaded.

Each hero also has one personal equipment slot. **Drag equipment from the bag onto a matching hero**, or click it and choose a recipient with keyboard-accessible buttons. Equipping consumes one item; replaced equipment returns through the normal bag/overflow rules.

| Equipment       | Class  | Bonus                                                |
| --------------- | ------ | ---------------------------------------------------- |
| Iron Signet     | Tank   | +2 damage on damaging rolls                          |
| Bulwark Badge   | Tank   | +3 opening team block, resist 1 damage per hit       |
| Glass Rosary    | Mage   | +2 healing on healing rolls                          |
| Mercy Bell      | Mage   | Every roll heals each ally by 1 and adds 1 block     |
| Silent Boots    | Rogue  | +1 damage; every fourth roll stuns                   |
| Serpent Pin     | Rogue  | Damaging rolls poison                                |
| Star Lens       | Mage   | +2 spell damage on damaging rolls                    |
| Storm Quill     | Mage   | +1 spell damage; every third roll grants ally stimulant |
| Notched Longbow | Ranger | +2 damage on damaging rolls                          |
| Scout Cloak     | Ranger | Resist 1 damage; +2 opening team block               |

Rare run artefacts use a separate collection and one shared passive slot beneath the map. Their power grows with depth. Attack, healing, block, gold and opening-guard artefacts grant bonuses only while equipped. **Revive Stones** stay ready without occupying that slot: choose to consume one when a hero falls to restore 75% HP. Otherwise death is permanent. Survivors confirm a burial recording cause, origin, time and statistics. The last death leads directly from acknowledgement to the expedition's complete fallen roster.

## Notebook controls and presentation

The notebook fits **1920×1080** and other desktop resolutions; tablets and phones stack its pages. The larger field log sits beside the three-pocket inventory. Only the log and final adventurer roster scroll internally. Side tabs open **Options**, **Field Guide** and **Bestiary**, even over a live
event. These pages suspend and restore that event. The bestiary starts unknown;
meeting an enemy records its sketch, name, observed stats, lore and playable cry
across runs. Its separate storage key is documented in
[Expedition update](docs/EXPEDITION_UPDATE.md).

Animation modes are **1×, 2×, 3×, 5× and Skip cinematics**. The toolbar remains usable while popups are open. Skip lands reels immediately while preserving shakes, particles, damage and healing feedback. Movement scales at half the animation speed increase, with Skip using the fastest walking speed and long routes receiving a modest additional boost. Animation speed, palette, Autofight and Autoplay persist across runs and reloads.

Paper tears, slowing reels, animated handles with fixed hitboxes, jaunty walking, injury portraits, health bars, targeted numbers, level-up bursts and critical impacts accompany actions. Headings animate inside reserved spaces. Torchlight flickers more visibly at the screen edges, respecting the ambient-effects option. Empty-tile footsteps are quiet; encounters, criticals and substantial rewards have distinct stronger cues. The short line under the map describes the current room or terrain without revealing hidden events. Idle chatter is infrequent and staggered; obsolete discovery callouts fade on a floor change.

The bottom bar displays keyboard and mouse prompts. Tab / Shift+Tab and Enter reach every control.

| Key             | Action                                       |
| --------------- | -------------------------------------------- |
| WASD / arrows   | Move                                         |
| 1 / 2 / 3       | Spin a hero's reels                          |
| Shift+1 / 2 / 3 | Select healing target                        |
| [ / ]           | Cycle damage target                          |
| E               | Edit selected hero's reels                   |
| P / B / V       | Use tonic / bomb / ward                      |
| X / R           | Reached stairs / revisit current event       |
| O / F / Y / M   | Options / field guide / bestiary / focus log |
| T / C           | Cycle pace / palette                         |
| N / G           | New run / download HTML                      |
| Space           | Land rolling reels or skip critical hold     |

## Sound, lighting and options

The Options tab now has **Play / Audio / Display / Coming later** pages.
Working controls include master, effects, music and ambience volume, mute,
brightness, shake strength, portrait motion strength, torchlight, full screen effects, fullscreen, pace,
palette and automation.
Settings persist across fresh runs and reloads. **Skip critical roll visuals**
still rolls and applies the same multiplier, with normal damage and event results;
it only removes the critical machine, popup/inline animation and wait.

Audio combines synthesised cues, an original 64-step minor-key melody with
plucked tones, bass and soft chord layers, plus quiet ambient noise. Every enemy
type and hero class has a distinct short creature call; enemies call on appearance
and death, and heroes on death. Calls use the effects volume; music and ambience
retain their own sliders. The five supplied WAV recordings replace tile erasing,
smoke puffs, reel ticks, ordinary reel locks and large single-reel locks.
A click or key unlocks sound; hidden tabs pause it. All recordings are embedded;
no external audio files or network service are needed. See
[Audio assets](docs/AUDIO_ASSETS.md) for replacement and testing. Torch flicker covers the screen and
can be disabled independently of gameplay particles. **Display → Full screen
effects** separately controls coloured edge pulses for wounds, poison, healing,
traps, gold and criticals. It keeps the centre clear and respects reduced motion;
disabling it immediately stops any current edge effect. Portrait movement has a separate 0–150% slider for idle speech, attacks, flinches
and deaths. At zero shake, impact
numbers/particles remain but nothing is shaken.

Resolution, language, desktop display mode and graphics quality are selectable,
saved **preview controls**. They do not yet resize, translate or change the game.
Browser fullscreen works separately from the future desktop-mode selector.
The Options heading animates when opening the menu, not when changing its tabs.
Discovery callouts hold at full opacity for a few seconds and fade gradually
over nine seconds; the hint remains in the journal and on its still-hidden tile.
Floor-clear sheets launch paper-like fireworks; the tenth-floor celebration
uses a substantially larger series of bursts while its records stay open.

## Learned traits

Adventurers can earn **15 minor traits** from battles, traps, wells and beacons.
Meeting a requirement gives a 30% chance of a trait; each shared experience can
award only one eligible party member, chosen at random.
There is only one active trait per hero; later experiences can replace it
without a prompt. Hover the portrait badge for its effect and origin. Heroic,
Hardy, Stoic, Merciful, Venomous, Focused, Wary, Invigorated and Bookish are
positive; Scarred, Haunted and Scorched are negative; Cowardly, Reckless and
Stubborn trade an advantage for a drawback. Traits persist between fights,
while ordinary combat statuses still clear. Full trigger/effect details are in
[GAMEPLAY_SYSTEMS.md](GAMEPLAY_SYSTEMS.md).

## Development and browser tests

The pencil presentation has editable sources in `ui/`; the playable distribution
is still the single `index.html`. Read [UI_STYLE_GUIDE.md](UI_STYLE_GUIDE.md),
[UI_COMPONENT_RULES.md](UI_COMPONENT_RULES.md) and
[STYLE_CHECKLIST.md](STYLE_CHECKLIST.md) before changing its visual language.

```sh
npm run build:ui   # embed edited CSS, SVG artwork and assets into index.html
npm run check:ui   # verify checked-in HTML matches the editable sources
npm run review:ui  # generate visual-review screenshots and an HTML backup
```

The build uses Node's standard library and embeds fonts, textures and torn-paper sheets directly. No
build step or network access is required to play a downloaded copy. Commit the
generated HTML with its source changes. `npm test` checks freshness first, then
runs gameplay and visual-system browser tests. Review output goes into ignored
`test-results/ui-review/`; it includes the default, warm and dark palettes,
1920×1080 and 1280×800 combat, a stacked mobile page, menus and a treasure crit.
Additional fixtures show purple poison, critical health, enemy passives, stronger supplies, blue rivers and desktop/mobile floor-clear summaries. Additional captures cover every options page, trait badges, worn gear, all camp categories, banking, Ranger Execute on a full party at compact sizes, five new enemy sketches, screen-edge feedback, shield strength/interception, live portrait statistics and the automatic victory deposit/fireworks. Those are review fixtures, not new gameplay rules.

```sh
npm ci
# Only if Chromium is unavailable:
npx playwright install chromium
npm test
```

Tests use `/usr/bin/chromium` when present or Playwright's browser; `CHROMIUM_PATH` selects another executable. They start a loopback server and put screenshots and downloaded HTML in ignored `test-results/`.

Coverage includes camp transactions/unlocks and interrupted saves, Ranger charge, optional run modifiers, conservative enemy criticals, status tooltips and full ten-floor progression, stair bosses and immediate victory, class selection and page animations, equipment drag/effects/swaps, autoresolve, pursuers, floor-specific species and elite odds, hidden command-aged ambush readiness, rockfalls and bodies, beacon sight lines, save migration, inventory decisions, permanent death, revives, critical and multi-hit calculations, map generation and connectivity, mobile/desktop layout and offline downloads. The campaign integration test uses controlled attack faces and extra health to exercise real navigation, encounters, rewards and progression independently of luck. Separate tests verify ordinary combat and failure paths. The offline test executes downloaded bytes with networking disabled because managed Chromium restricts `file://` navigation.

## Credits

The embedded **Patrick Hand** font is by Patrick Wagesreiter, under the SIL Open Font License 1.1. Its full license is in the HTML source. All illustrations and effects run locally.

Graphite headings use **Cabin Sketch** by the Cabin Project Authors. Creature
names use **Caveat** by the Caveat Project Authors (original
design by Pablo Impallari), also under the SIL Open Font License 1.1. These fonts
and their licences are in `ui/assets/fonts/` and embedded in the HTML.
Candle Gnawer now uses the same sparse pencil paths as other enemies. The older
`ui/assets/illustrations/candle-gnawer.png` remains an unused reference.
Pencil frames, tape, edge wear, graphite textures and vector drawings are local project
assets; no external image, font or paid service is needed at runtime.

## Gameplay maintenance

See [GAMEPLAY_SYSTEMS.md](GAMEPLAY_SYSTEMS.md) for the shared enemy profiles,
class prices, fixed supply definitions, automation decisions and save migration
contracts. Keep manual and automatic actions on the same validation paths.

The toolbar **Effects** dropdown chooses rolled-symbol projectiles, beams or both.
Marks leave their reel windows on arcing flights, pulse and burst on the affected
target. Totals have smaller offset component values that rise and fade.
**Pun-nishing Mode** in Options swaps names/art for stationery puns without
changing enemy stats; the final boss becomes **THE FULL STOP**. Declining a
companion may lead to a farewell, a gift or a fight. Early solo companion odds
are slightly higher; deeper traps are a little stronger.

## Tactical update

See [Battle tactics and exploration](docs/BATTLE_TACTICS.md) for fixed temperaments,
natural Mage Resonance, Berserker Fury/Blood Price, initiative and surprise
openings, focused enemy intent, stronger stuns, Vulnerable, healing cleanses and
stacking poison. The Unwritten is tougher, especially mid-dungeon, and guarantees
a better item reel from floor four. Shops, rivers and artefacts are slightly more
common. Lower-floor lava lights its orthogonal neighbours without activating
discoveries. Three additional optional travel events and generic equipment use
the existing bag and confirmation systems; full-bag purchases warn before payment.

The [Campfire update](docs/CAMPFIRE_UPDATE.md) adds eight five-tier improvements
with selectable active ranks, eight optional challenges, the unlockable Jester,
rare personal moments and archetype-guided Autoplay. Temperament now changes
starting marks rather than their numeric power. Ambushes age by move commands,
not waiting time. Options can reset progression while preserving settings.

See [Punchline and support update](docs/PUNCHLINE_UPDATE.md) for version-20 buff stacking, Tank Shield Bash, Jester, class-aware AI and tunnel-only crossings.

See [Biomes and class identity](docs/BIOMES_UPDATE.md) for version-21 named cave,
overgrown, mushroom, lava and ice floors, directed sliding routes, nine themed
creatures including the self-destructing Powder imp, class-focused automatic
builds, charge-aware Autofight and the latest small balance adjustments.

### Readable powers and campaign balance

Physical and spell marks now deal 1–4 base damage by rank, with class-specific
critical pools, distinct upgrade affinities and explicit ten-floor enemy budgets.
Camp lessons provide a stronger progression advantage. See
[the balance pass](docs/BALANCE_PASS.md) for exact values, class build guidance,
save compatibility and the limitations of the seeded browser combat audit.
Run `npm run audit:balance` to reproduce a controlled comparison of camp ranks.

### Combat identity and bounded resources

See [Combat identity](docs/COMBAT_IDENTITY.md) for the current rules: Fury from
wounds and spent by all healing, six-mark Jester bursts, short stuns followed
by Steady protection, capped shared block and stimulant potency, complementary
class marks and the removal/refund of paid hero weighting. The workshop and
field guide explain these changes. Existing pencil art and enemy floor budgets
are retained.
