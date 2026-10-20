# Scratchpad Dungeon

A hand-drawn notebook dungeon crawler in **one self-contained `index.html`**. The handwriting font, SVG illustrations, mechanical reels, speech, and particles are embedded. No runtime dependencies or network requests are needed.

## Play

Download `index.html` and open it in a modern browser. If your device restricts local HTML, serve the folder:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000`. **Save HTML** downloads another complete offline game file, not an export of your current run. Progress saves in local browser storage when available; saves belong to that browser and origin. Earlier saves are migrated without discarding the party or its edited reels. Choose **New run** to begin with the new class loadouts and zero starting items.

## The only way is down

Start with Alden, a tank, and **zero consumables**. Discover and voluntarily descend through ten floors. On floor ten, defeat **The Last Redaction**, then choose the final descent to win. There is no early retirement or return-home victory.

Graphite hides rooms and interior walls. Hover for a tile's known type. Click to erase a reachable unknown destination, reveal its sketch, then walk into its event. Long routes take a shortest path through **already uncovered** tiles; unknown tiles cannot be shortcuts. Walls stop movement. Arrow keys / WASD move a step. Empty rooms have little stone, grass, mushroom, or crack drawings too.

Discovering stairs unlocks a persistent button below the map. Decline the prompt to keep exploring, then use the button from anywhere on that floor. Nothing descends automatically.

## Encounters and discoveries

- **Fights:** confirm the illustrated enemy entrance before it shrinks into the combat column. Any living hero may act repeatedly, in any order. Successful battles award EXP, personal editing points, and a separate loot roll.
- **Treasure:** reels mostly award gold. Consumables and personal points are uncommon; artefacts are extremely rare. Take time to inspect the result, then click to pocket it. Coin particles scale with the gold awarded, capped for performance.
- **Traps:** a warning and drawn spikes, arrows, or boulder precede the reels. Roll safe, danger, or temporary trap guard, then confirm the result. Trap guard expires after that trap; it cannot be banked for a fight.
- **Wells:** confirm to restore 30% of maximum HP to everyone, including fallen heroes. Green portrait pulses, floating crosses, and health numbers show who recovered.
- **Beacons:** confirm to reveal exactly the eight surrounding cells, including diagonals. The reveal spreads outward in staggered waves; seeing an event does not activate it.
- **Adventurers:** one has a 16% chance to spawn on a floor, making individual meetings very rare. Preview their class, portrait, health, and introduction. Explicitly accept or decline. Three heroes is the maximum; full parties can only wish the visitor safe travels.
- **Shops:** a shop has an independent **30% spawn chance per floor**. It sells one tonic, bomb, ward, full-team heal, and stairs map, each with limited stock and prices increasing with depth. Full healing revives fallen heroes. The map reveals stairs without teleporting or descending.

Events wait for a confirmation button at every speed, including Skip. Escape and fast-forward never confirm them. Critical popups are the exception: their results linger, shake, and close automatically.

## Class machines and combat

Each hero has three six-face reels. Faces have class-specific weights, shown as percentages in the editor; changing a face preserves its chance.

- **Tank:** mostly damage and shared protection. Its default chance of a heal face is under 4% per reel.
- **Healer:** over 70% healing faces, with little direct damage.
- **Rogue:** mostly damage and stuns; no default healing faces.

One, two, or three copies of a symbol mean tiers I, II, or III. Per icon, heroes gain 3 attack, 3 healing, 2 block, or 1 stun power. All effects resolve together. Every three stun power, rounded up, cancels an enemy turn.

**Only three identical symbols of the same type and tier crit.** A pair never does. The separate critical machine rolls ×2, ×2.5, ×3, or ×4; effects round up. Ordinary hero and enemy rolls stay on the page.

Healing and tonics affect the selected target and can revive them. Portrait injuries, health bars, speech, green flashes, beams, and damage values show the actual recipients.

The prominent **TEAM BLOCK** counter protects every hero. Each incoming hit consumes block point for point before damaging its target. Block clears after victory or defeat and resets at the next encounter. Wards can only be used during combat. An equipped Ember Seal creates fresh opening block for each fight rather than carrying unused block forward.

Floor-one enemies attack every two hero actions. Deeper enemies gain HP, damage, speed, and multi-strikes. Every strike rolls its own machine and targets a living hero. Enemy healing and shields protect the enemy. Enemy stun affects a hero; pull that hero's handle to spend an action recovering, or choose someone else. Recovery protects them from immediate re-stunning, guaranteeing a real action before another stun can stick.

**EXP is awarded only on successful battles**, never for spinning or losing. Leveling grants +6 maximum HP and +4 personal editing points; victory adds another personal point per hero. Use ✎ to change faces: tier I / II / III prices are **1 / 3 / 6 points**. An upgrade costs its destination tier's price; weakening costs one point. Cheap consistent symbols crit more often than mixed powerful ones.

Finite items do not tick the enemy clock: tonics restore 16 HP, bombs deal `10 + 3 × floor` damage, and wards add eight shared block for the current battle.

## Rare artefacts

Chests and battle spoils share a weighted loot table: 94% coin faces, 3.5% personal-point faces, 2.1% consumable faces combined, and **0.4% artefact faces** per reel. Three reels resolve per loot roll. These are face odds, not a guarantee that a chest contains a particular item.

Artefacts go into a collection, with **one equipped slot** beneath the map. The first find equips automatically; inspect and swap freely between actions or equip a new find directly from its loot result. Only the equipped artefact grants its passive bonus. Power increases with the floor of discovery:

- **Fang of the Margin:** extra damage on attack rolls.
- **The Glass Tear:** extra healing on heal rolls.
- **Iron Pennant:** extra shared block on shield rolls.
- **Lucky Farthing:** more gold from chests and battle loot.
- **Ember Seal:** fresh shared block at the start of every fight.

## Pace and game feel

The always-visible main toolbar offers **1×, 2×, 5×, and Skip cinematics**. It remains accessible while a scene is open, so animations can always be reenabled. Popups contain no animation toggle.

Click a rolling machine or its handle, or press Space, to land the already-selected result. Handle buttons have stationary 46px hitboxes while only their artwork swings. Skip bypasses reel travel and cinematic delays but retains short impact shakes, paper and coin particles, speech, healing pulses, and results. Critical results still get a short automatic hold. The OS reduced-motion preference limits shaking.

Machines burst through paper on arrival; reels slow down and lock separately; characters walk with alternating boots and a jaunty bounce. Tanks, healers, rogues, rats, wraiths, skeletons, and blotlings have their own battle cries and reactions. Idle party chatter occurs only outside combat and dialogs. A subtle torchlight overlay flickers across the notebook.

M folds the log. Escape closes ordinary dialogs or fast-forwards an active scene. Dialogs and scenes support keyboard focus trapping.

## Browser tests

Node.js 20+ and Chromium are needed only for development:

```sh
npm ci
# If Chromium is not already available:
npx playwright install chromium
npm test
```

The suite uses `/usr/bin/chromium` if present, otherwise Playwright's installed Chromium. Set `CHROMIUM_PATH` for another executable. It starts a loopback server and writes screenshots and the downloaded game to ignored `test-results/`.

Coverage includes desktop/mobile layouts, mandatory event confirmations at Skip speed, automatic critical holds, persistent pace controls, stationary handle hitboxes, hidden-information routing, wells and healing feedback, beacon radius, class weights, stronger enemies, shared block lifecycle, victory-only XP, rare loot and coin particle counts, recruit choices and cap, shop frequency and transactions, artefact drops/scaling/swapping/passives, speech, clipped boulder art, ten-floor victory conditions, connected maps, save migration, offline downloads, and stun recovery.

The complete-campaign integration check uses a controlled attack loadout and extra health to exercise navigation, loot confirmations, enemy turns, and progression independently of luck. It does not replace movement, events, enemy AI, rewards, or victory logic. Other tests isolate actual combat calculations and failure paths. The offline test executes the downloaded bytes with networking disabled because managed cloud Chromium restricts `file://` navigation.

## Credits

The embedded **Patrick Hand** font is by Patrick Wagesreiter, distributed under the SIL Open Font License 1.1. The complete license is in the HTML source. Illustrations are inline SVG; all effects run locally.
