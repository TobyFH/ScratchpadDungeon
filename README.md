# Scratchpad Dungeon

A hand-drawn notebook dungeon crawler in **one self-contained `index.html`**. It embeds its handwriting font, character illustrations, tile sketches, slot machines, and effects. There are no runtime dependencies or network requests.

## Play

Download `index.html` and open it in a modern browser. For devices that restrict local HTML, serve the folder:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000`. **Save HTML** downloads another complete offline game file. It contains the game, not an export of the current expedition. Progress automatically saves in browser local storage when available. Saves belong to that browser and origin; moving the file or changing servers may create a separate save. The game migrates saves from the first Scratchpad Dungeon release.

## Explore the notebook

- Start with Alden, a single fighter. Graphite covers unknown rooms and interior walls. Hover to see a tile's known type without revealing its contents.
- Scratch an unknown tile next to your uncovered route. Erasing reveals its artwork before the company slides into the room and its event occurs. Empty rooms have stone, mushroom, grass, or crack sketches.
- Click any reachable destination to follow a shortest route through **already uncovered** tiles. An unknown tile can be the destination, but never an intermediate shortcut. Walls stop travel; discoveries interrupt it. Arrow keys / WASD move one tile.
- Treasure opens a central machine that awards gold and may award tonics, bombs, wards, or personal editing points. Traps show their warning and drawn spikes, arrow, or boulder before rolling safe, danger, or block symbols.
- Wells restore **30% of maximum HP** to everyone, including fallen heroes. Rare beacons reveal exactly the eight surrounding cells, including diagonals, in two staggered outward waves. Revealing an event does not activate it.
- Rare wanderers can join as a healer and rogue. The company has at most three heroes; further wanderers provide supplies instead.
- Discovering stairs prompts a choice and unlocks a persistent button below the map. Decline to keep exploring, then use the button **from anywhere on that floor**. Stairs never automatically end an expedition.
- Defeat the Sunseed keeper on floor three, then use any discovered stairs to bring the Sunseed home. Or keep exploring to the tenth and final floor. Returning without the Sunseed retires the expedition safely; a party wipe ends it.

## Make a little luck

Every hero has a mechanical three-reel machine with an animated handle on the right page. **Any living hero may act repeatedly, in any order.** Each reel draws one of its six faces with equal odds. Fighter, healer, rogue, and enemy loadouts have different distributions.

- One, two, or three copies of a symbol represent tiers I, II, or III: swords deal damage, crosses heal, shields store block, and lightning stuns.
- Per icon, heroes gain 3 attack, 3 heal, 2 block, or 1 stun power. All results of a roll resolve together. Every three stun power (rounded up) cancels one enemy turn.
- A matching **type and tier** triggers a separate central critical multiplier machine: a pair rolls ×1.25, ×1.5, ×1.75, or ×2; a triple rolls ×2, ×2.5, ×3, or ×4. The multiplier applies to the original roll and each effect rounds up. Ordinary combat rolls stay on the page.
- Choose a healing target before spinning or drinking a tonic. Healing revives fallen heroes. Health bars, injury labels, and illustrated facial injuries show their condition. Damage and healing indicators travel to their actual targets.
- Team block persists between encounters. Each incoming hit consumes as much block as it absorbs, then damages its target for the remainder.
- The enemy's attack-frequency stat determines how many hero actions occur before its turn. Each strike has its own on-page slot roll and a randomly chosen living target. Enemy heal and block protect the enemy; enemy stun affects a hero. Pull a stunned hero's handle to spend an action recovering, or use a different hero.
- Deeper floors increase enemy health, damage, attack speed, and multi-strikes. Each enemy type has its own reel distribution. Enemy matching symbols also roll a critical multiplier.
- Spins and victories award personal EXP. Levels grant **+6 maximum HP and +4 personal editing points**. Victories grant each hero another point. Treasure can award personal points too.
- Use ✎ to edit individual faces. Changing a tier I / II / III face costs **1 / 3 / 6 points**. Upgrading costs the destination tier's price; weakening to tier I costs one point. Fill reels with cheap weak symbols to match more often, or save for strong matching faces.
- Finite consumables do not tick the enemy clock: tonics restore 16 HP, ink bombs deal `10 + 3 × floor` damage, and paper wards add 8 persistent team block.

## Set the pace

The slot windows roll vertically, slow down, and lock separately. Handles swing; symbols pulse; paper particles scatter; portraits lunge; the notebook shakes. Enemy entrances burst into a central illustration, then fly to their place on the right page. A subtle torchlight layer flickers over the notebook.

Click a rolling machine, its handle, or press **Space** to land its already-selected result. Central events also have a fast-forward control. **Skip animations** makes all effects instant, including ongoing rolls; it does not change their odds. The initial setting honors reduced-motion preferences. Escape closes ordinary dialogs or fast-forwards active scenes. M folds the log. Both ordinary dialogs and animated scenes trap keyboard focus while open.

## Browser tests

Node.js 20+ and Chromium are needed only for development:

```sh
npm ci
# If Chromium is not already available:
npx playwright install chromium
npm test
```

Tests use `/usr/bin/chromium` if present, otherwise Playwright's installed Chromium. Set `CHROMIUM_PATH` for another executable. The suite starts its own loopback server and writes screenshots and an HTML download to ignored `test-results/`.

The browser tests cover responsive layouts, embedded artwork/font, erasing before movement, hidden-information routing, walls, beacon radius and nonactivation, partial healing and revival, treasure/trap outcomes, rare recruits and the party cap, on-page machines and handles, fast-forwarding, critical multiplier rolls, repeated actions and action locking, enemy slot effects and scaling, persistent block and multi-strikes, targeted healing, personal EXP and editing costs, persistent exit discovery, generated-map connectivity, a complete expedition, defeat/restart, consumables, save migration, offline HTML playback, animated enemy entrances, trap anticipation, and enemy attack animations.

Controlled random choices and loadouts isolate calculations. The campaign integration test uses a strong loadout and extra health to exercise navigation and event transitions independently of luck; it does not replace movement, enemy, reward, or victory logic. The offline test runs the downloaded bytes with networking disabled because managed cloud Chromium restricts `file://` navigation.

## Credits

The embedded **Patrick Hand** font is by Patrick Wagesreiter and distributed under the SIL Open Font License 1.1. Its complete license is included in the HTML source. All game illustrations are inline SVG, and every effect runs locally.
