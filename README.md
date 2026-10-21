# Scratchpad Dungeon

A hand-drawn notebook dungeon crawler in **one self-contained `index.html`**. Its handwriting font, illustrations, reels and effects are embedded. The game needs no network connection or runtime dependencies.

## Play

Download `index.html` and open it in a modern browser, or serve this folder:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000`. **Save HTML** downloads a complete offline copy of the game. Progress stays in this browser's local storage; the HTML download does not export a saved expedition. Older saves preserve edited faces and migrate to one middle-reel class seal. Surplus inventory types wait for explicit keep, use or discard decisions.

The notebook opens with a choice of **Tank, Healer, Rogue or Mage**. A new expedition turns to fresh pages. Start with one hero and no items; keep at most three heroes. Every staircase has an elite guardian. Defeat it to descend when you choose. **Defeating the tenth guardian wins immediately**, with a celebration and a scrollable record of every survivor, fallen companion and retired adventurer.

## Explore

Click a reachable pencil-covered tile to erase it and walk into its discovery. Click a distant revealed tile to follow a shortest route across known ground. Routes avoid untouched fights and traps when possible. Click another valid destination while walking or erasing to redirect the party. Known wells, shops and ruins are ignored when merely passing through. Once its guardian is defeated, a staircase also permits uninterrupted passage; selecting it opens the descent menu again.

Walls and connected underground rivers block movement. Wooden bridges cross rivers. Every floor randomises its layout and events. Stairs are reachable and at least eight steps from camp; generation can carve a route and bridge a river when necessary. Most floors have no river; a second river is very rare. Connected cave rooms reveal together without activating their contents.

- **Fights:** any living hero can act repeatedly. Deeper floors increasingly contain two enemies with independent attack clocks. Rare elite variants retain their species and gain an Ironbound, Frenzied or Venomous modifier, with an animated aura. Five additional species appear in successive floor pairs: Candle Gnawer, Blind Bellkeeper, Thorn Widow, Gutter Oracle and Page Eater.
- **Treasure:** roll gold, occasional supplies or equipment, personal points and rare artefacts. A rare chest is a mimic. Items pulse in the reward panel before claiming; coin showers scale with the gold awarded.
- **Traps:** a warning and illustrated spikes, arrows or boulder precede a danger check. Early damage is restrained. Confirm the outcome before it resolves.
- **Wells:** use one now or leave it active for later. Each hero receives 30% maximum HP plus a healing roll; criticals multiply the complete offered amount. Portrait effects show actual healing.
- **Beacons:** reveal adjacent cells in staggered waves. Sometimes another one to five cells in the next ring are lit. Stone blocks sight, including closed diagonal corners; rivers do not. Revealed events remain untriggered.
- **Wanderers:** preview a companion's class, level, health and introduction before accepting. Discovery odds rise after missed floors, with a small solo and early-floor bonus. Newcomers match the rounded average party level and arrive with some level-earned points spent on upgrades. With a full party, accepting opens a replacement choice. Companions who leave alive remain in the final records.
- **Shops:** a 30% chance per floor. Buy limited supplies, a full-party heal or a map marking the stairs. Buying a map never opens a descent prompt.
- **Ruins and strongholds:** optional mechanisms balance trap damage against loot. Rare walled strongholds hold a dangerous champion with rich spoils and a guaranteed stronger artefact.
- **Travel discoveries:** rare rockfalls roll a danger check; a forgotten traveller may have a satchel worth searching. Such discoveries can occasionally hold something valuable. Quiet movement itself never shakes the book.

Old passages can hide an ambush after **one minute of exploration time** away from the party's immediate neighbourhood. Battles, popups, menus and hidden browser tabs pause that clock. There is **no visible fog overlay**. Entering an aged, resolved tile has a 12% encounter chance. Ambushes arrive in a smoke poof with a banner; victory clears adjacent ambush age without revealing or activating anything.

From floor three, revealing enough walkable tiles can awaken **The Unwritten** far from the party. It advances slowly when the player moves, aims to intercept, favours revealed paths and can disappear into an unexplored tile. Its mark is visible only on revealed ground. Contact starts a fight.

## Reels and combat

Heroes have six ordinary weighted faces on each outer reel and seven faces on the middle reel, including its **single class seal**. Each reel starts with a permanent EMPTY face. Empty faces have no effect and never crit. Personal points can inscribe over them for **3 points**. Other tier prices are 1 / 4 / 9 / 16 points; tier IV is available for blade and magic attacks. Edits preserve face weights, which the editor displays.

| Class  | Style                                                  | Middle-reel ability                                                                 |
| ------ | ------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Tank   | 44 HP; damage and shared protection; very rare healing | **Rage:** lasting damage and a little protection, shown with a fist and a red pulse |
| Healer | 32 HP; strongly favours healing                        | **Sanctuary:** heal all allies and raise team block                                 |
| Rogue  | 26 HP; damage and poison, little protection            | **Flurry:** roll three extra attacks and deliver three separate quick hits          |
| Mage   | 28 HP; magic, poison and stimulants                    | **Nova:** magic against every enemy                                                 |

Blade and magic tiers deal 2 / 4 / 7 / 11 damage per face. Healing tiers offer 2 / 4 / 6 HP. Block and stun tiers contribute 1 / 2 / 3 power. **Three identical type-and-tier symbols crit**; a middle class seal can complete two matching meaningful symbols while also casting its ability. A pair alone never crits. Critical multipliers are ×2, ×2.5, ×3 or ×4, with displayed before-and-after calculations.

Normal combat rolls stay on the right page. Criticals get a multiplier popup that lingers automatically; **Strike now** skips its result hold. Treasure, fountain and other event criticals stay inside their original panel and still require confirmation. Critical damage lands as the original hit followed by a separate bonus hit, each with its own beam, number and impact. Flurries likewise produce separate hits. Criticals and tier III / IV attacks hit every enemy. Click portraits to choose damage and healing targets.

**Team block** is a shared consumable pool, depleted point for point by damage and cleared after combat. A fully absorbed hit shows a shield on its recipient. Any positive armour blocks a stun but consumes up to six armour per power. A stunned hero misses one go without advancing or resetting enemy clocks. Enemy attack frequency determines how many player actions occur between attacks; difficult enemies can make multiple separately rolled strikes.

**Poison** deals one armour-piercing damage per completed action for a limited duration, with visible status ticks and kill credit. **Stimulants** increase damage and protection and show a fiery glow. Rage, poison and buffs end with combat. Level-ups add 6 maximum HP and 4 personal editing points, with portrait and machine effects. EXP comes only from successful battles; surviving heroes also gain one editing point per victory.

The **Autoresolve** checkbox chooses heroes, targets and occasional useful emergency supplies. It preserves the selected animation speed and all combat feedback. Enemy entrances confirm automatically; loot, recruits, death decisions and other choices still wait for the player. Untick it to take over between actions.

## Supplies and equipment

The satchel holds **three item types**, with matching items stacked. Inspect to use or discard. If full, swap out a stack, use an item immediately when applicable, or leave the find. Pending choices survive reloads. Items do not advance enemy countdowns.

Consumables: Healing Tonic, Ink Bomb, Paper Ward, Antidote, Field Bandage, Mending Salve, Ember Draught, Sharpening Oil, Frost Vial, Cinder Flask, Venom Ink, Surveyor's Chalk and Trail Ration. Ink Bombs roll damage and poison on a slot machine; matching results crit.

Each hero also has one personal equipment slot. **Drag equipment from the bag onto a matching hero**, or click it and choose a recipient with keyboard-accessible buttons. Equipping consumes one item; replaced equipment returns through the normal bag/overflow rules.

| Equipment     | Class  | Bonus                                                |
| ------------- | ------ | ---------------------------------------------------- |
| Iron Signet   | Tank   | +2 damage on damaging rolls                          |
| Bulwark Badge | Tank   | +3 opening team block, resist 1 damage per hit       |
| Glass Rosary  | Healer | +2 healing on healing rolls                          |
| Mercy Bell    | Healer | Every roll heals each ally by 1 and adds 1 block     |
| Silent Boots  | Rogue  | +1 damage; every fourth roll stuns                   |
| Serpent Pin   | Rogue  | Damaging rolls poison                                |
| Star Lens     | Mage   | +2 magic damage on damaging rolls                    |
| Storm Quill   | Mage   | +1 magic damage; every third roll grants a stimulant |

Rare run artefacts use a separate collection and one shared passive slot beneath the map. Their power grows with depth. Attack, healing, block, gold and opening-guard artefacts grant bonuses only while equipped. **Revive Stones** stay ready without occupying that slot: choose to consume one when a hero falls to restore 75% HP. Otherwise death is permanent. Survivors confirm a burial recording cause, origin, time and statistics. The last death leads directly from acknowledgement to the expedition's complete fallen roster.

## Notebook controls and presentation

The notebook fits **1920×1080** and other desktop resolutions; tablets and phones stack its pages. The larger field log sits beside the three-pocket inventory. Only the log and final adventurer roster scroll internally. Side tabs open functional **Options** and **Field Guide** pages.

Animation modes are **1×, 2×, 3×, 5× and Skip cinematics**. The toolbar remains usable while popups are open. Skip lands reels immediately while preserving shakes, particles, damage and healing feedback. Movement scales at half the animation speed increase, with Skip using the fastest walking speed and long routes receiving a modest additional boost. Animation speed, palette and autoresolve persist across runs and reloads.

Paper tears, slowing reels, animated handles with fixed hitboxes, jaunty walking, injury portraits, health bars, targeted numbers, level-up bursts and critical impacts accompany actions. Headings animate inside reserved spaces. Torchlight flickers across the pages. Idle chatter is infrequent and staggered; obsolete discovery callouts fade on a floor change.

The bottom bar displays keyboard and mouse prompts. Tab / Shift+Tab and Enter reach every control.

| Key             | Action                                   |
| --------------- | ---------------------------------------- |
| WASD / arrows   | Move                                     |
| 1 / 2 / 3       | Spin a hero's reels                      |
| Shift+1 / 2 / 3 | Select healing target                    |
| [ / ]           | Cycle damage target                      |
| E               | Edit selected hero's reels               |
| P / B / V       | Use tonic / bomb / ward                  |
| X / R           | Reached stairs / revisit current event   |
| F / M           | Field guide / focus log                  |
| T / C           | Cycle pace / palette                     |
| N / G           | New run / download HTML                  |
| Space           | Land rolling reels or skip critical hold |

## Development and browser tests

```sh
npm ci
# Only if Chromium is unavailable:
npx playwright install chromium
npm test
```

Tests use `/usr/bin/chromium` when present or Playwright's browser; `CHROMIUM_PATH` selects another executable. They start a loopback server and put screenshots and downloaded HTML in ignored `test-results/`.

Coverage includes full ten-floor progression, stair bosses and immediate victory, class selection and page animations, equipment drag/effects/swaps, autoresolve, pursuers, floor-specific species and elite odds, hidden exploration-only ambush timers, rockfalls and bodies, beacon sight lines, save migration, inventory decisions, permanent death, revives, critical and multi-hit calculations, map generation and connectivity, mobile/desktop layout and offline downloads. The campaign integration test uses controlled attack faces and extra health to exercise real navigation, encounters, rewards and progression independently of luck. Separate tests verify ordinary combat and failure paths. The offline test executes downloaded bytes with networking disabled because managed Chromium restricts `file://` navigation.

## Credits

The embedded **Patrick Hand** font is by Patrick Wagesreiter, under the SIL Open Font License 1.1. Its full license is in the HTML source. All illustrations and effects run locally.
