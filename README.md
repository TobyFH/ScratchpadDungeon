# Scratchpad Dungeon

A hand-drawn notebook dungeon crawler in **one self-contained `index.html`**. The handwriting font, SVG illustrations, mechanical reels, speech, and particles are embedded. No runtime dependencies or network requests are needed.

## Play

Download `index.html` and open it in a modern browser. If your device restricts local HTML, serve the folder:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000`. **Save HTML** downloads another complete offline game file, not an export of your current run. Progress saves in local browser storage when available; saves belong to that browser and origin. Earlier saves are migrated without discarding the party or its edited reels. Choose **New run** to begin with the new class loadouts and zero starting items.

## The only way is down

Choose Alden, a tank, or Wren, a fragile damage-focused rogue, and start with **zero consumables**. Discover and voluntarily descend through ten floors. On floor ten, defeat **The Last Redaction**, then choose the final descent to win. There is no early retirement or return-home victory.

Graphite hides rooms and interior walls. Hover for a tile's known type. Click to erase a reachable unknown destination, reveal its sketch, then walk into its event. Long routes use **already uncovered** tiles and go around revealed, untriggered fights whenever a safe route exists. Click a new destination during travel to reroute. Longer trips get a modest walking-speed boost. Unknown tiles cannot be shortcuts. Walls stop movement; every generated floor has a verified route to its stairs. Active events have an exclamation mark; untouched wells glow green. Empty rooms never shake the notebook. Arrow keys / WASD move a step. Empty rooms have little stone, grass, mushroom, or crack drawings too.

Discovering stairs unlocks a persistent button below the map. Decline the prompt to keep exploring, then use the button from anywhere on that floor. Nothing descends automatically.

## Encounters and discoveries

- **Fights:** confirm the illustrated enemy entrance before it shrinks into the combat column. Any living hero may act repeatedly, in any order. Successful battles award EXP, personal editing points, and a separate loot roll.
- **Treasure:** reels mostly award gold. Consumables and personal points are uncommon; artefacts are extremely rare. Take time to inspect the result, then click to pocket it. Large coin bursts and a sustained shower pour off the popup; particle counts scale with the reward and are capped for performance.
- **Traps:** a warning and drawn spikes, arrows, or boulder precede the reels. Roll safe, danger, or temporary trap guard, then confirm the result. Trap guard expires after that trap; it cannot be banked for a fight.
- **Wells:** accept or leave the fountain untouched for later. When used, each living hero receives 30% of their maximum HP plus a healing slot roll. A triple match rolls a critical multiplier on that combined amount. Green portrait pulses, floating crosses, and health numbers show who recovered. Used wells become grey; declined wells remain bright and can be revisited, including by clicking the current tile.
- **Beacons:** confirm to reveal exactly the eight surrounding cells, including diagonals. The reveal spreads outward in staggered waves; seeing an event does not activate it.
- **Adventurers:** one has a 17% chance to spawn on a floor with a solo hero, or 14% with companions, making individual meetings very rare. Preview their class, portrait, health, and introduction. Explicitly accept or decline. Three heroes is the maximum; full parties can only wish the visitor safe travels.
- **Shops:** a shop has an independent **30% spawn chance per floor**. It sells one tonic, bomb, ward, full-team heal, and stairs map, each with limited stock and prices increasing with depth. Full healing affects living heroes only. The map reveals stairs without teleporting or descending.

Events wait for a confirmation button at every speed, including Skip. Escape and fast-forward never confirm them. Critical popups are the exception: their results linger, shake, and close automatically.

## Class machines and combat

Each hero has three six-face reels, including blank entries. Blanks have no effect and cannot crit. Faces have class-specific weights, shown as percentages in the editor; changing a face preserves its chance.

- **Tank:** mostly damage and shared protection. Its default chance of a heal face is under 4% per reel.
- **Healer:** over 70% healing faces, with little direct damage.
- **Rogue:** mostly damage and stuns; 26 starting HP, very little protection, and no default healing faces.

One, two, or three copies of a symbol mean tiers I, II, or III. Per icon, heroes gain 3 attack, 3 healing, 1 block, or 1 stun power. All effects resolve together. A successful stun cancels one enemy attack turn.

**Only three identical symbols of the same type and tier crit.** A pair never does. The separate critical machine rolls ×2, ×2.5, ×3, or ×4; effects round up. It shows the original amount × multiplier = final amount. This applies to combat, treasure, healing fountains, and traps. Ordinary hero and enemy rolls stay on the page. Lethal hits remain visible for a moment before the battle-loot popup appears.

Healing and tonics affect the selected living target. Portrait injuries, health bars, speech, green flashes, beams, and damage values show the actual recipients.

The prominent **TEAM BLOCK** counter protects every hero. Each incoming hit consumes block point for point before damaging its target. Block clears after victory or defeat and resets at the next encounter. Wards can only be used during combat. An equipped Ember Seal creates fresh opening block for each fight rather than carrying unused block forward.

Floor-one enemies attack every two hero actions. Deeper enemies gain HP, damage, speed, and multi-strikes. Every strike rolls its own machine and targets a living hero. Enemy healing and shields protect the enemy. Enemy stun affects a hero; pulling that hero's handle spends their missed go without advancing or resetting the enemy countdown. Recovery protects them from immediate re-stunning, guaranteeing a real action before another stun can stick. Any positive armour can block a stun: it consumes up to six armour per stun power, or all remaining armour if there is less. Enemy armour can block stuns the same way.

**EXP is awarded only on successful battles**, never for spinning or losing. Leveling grants +6 maximum HP and +4 personal editing points; victory adds another personal point per hero. Use ✎ to change faces: tier I / II / III prices are **1 / 3 / 6 points**. An upgrade costs its destination tier's price; weakening costs one point. Cheap consistent symbols crit more often than mixed powerful ones.

Finite items do not tick the enemy clock: tonics restore 16 HP, bombs deal `10 + 3 × floor` damage, and wards add five shared block for the current battle.

## Permanent companions and memorials

A hero reaching zero HP dies permanently. Death is saved immediately, including if the page is reloaded before confirmation. A mandatory death notice appears; if someone survives, a separate burial screen records the cause, floor and location, where the companion was found, time and steps with the party, level, battles, kills, damage, protection, healing, and EXP earned. The survivor then continues with the smaller party. The **Names remembered** button reopens those records.

Wells, tonics, shops, level-ups, and later victories cannot resurrect the dead. If the last hero dies, confirm their death and begin a new expedition. Only survivors receive victory EXP and points.

## Rare artefacts

Chests and battle spoils share a weighted loot table: 94% coin faces, 3.5% personal-point faces, 2.1% consumable faces combined, and **0.4% artefact faces** per reel. Three reels resolve per loot roll. These are face odds, not a guarantee that a chest contains a particular item.

Artefacts go into a collection, with **one equipped slot** beneath the map. The first find equips automatically; inspect and swap freely between actions or equip a new find directly from its loot result. Only the equipped artefact grants its passive bonus. Power increases with the floor of discovery:

- **Fang of the Margin:** extra damage on attack rolls.
- **The Glass Tear:** extra healing on heal rolls.
- **Iron Pennant:** extra shared block on shield rolls.
- **Lucky Farthing:** more gold from chests and battle loot.
- **Ember Seal:** fresh shared block at the start of every fight.

## Pace and game feel

The always-visible main toolbar offers **1×, 2×, 3×, 5×, and Skip cinematics**. It remains accessible while a scene is open, so animations can always be reenabled. Popups contain no animation toggle.

Click a rolling machine or its handle, or press Space, to land the already-selected result. Handle buttons have stationary 46px hitboxes while only their artwork swings. Skip bypasses reel travel and cinematic delays but retains short impact shakes, paper and coin particles, speech, healing pulses, and results. Critical popups still appear at Skip speed, immediately show the multiplier and calculation, and hold automatically long enough to read. Travel scales at half the animation-speed increase: 1× / 2× / 3× / 5× animations produce 1× / 1.5× / 2× / 3× walking; Skip uses 3× walking. Reserved spaces for party members, results, captions, and stage content keep the notebook from shifting as those elements change. The OS reduced-motion preference limits shaking.

Machines burst through paper on arrival; reels slow down and lock separately; characters walk with alternating boots and a jaunty bounce. Tanks, healers, rogues, rats, wraiths, skeletons, and blotlings have their own battle cries and reactions. Idle party chatter is infrequent and occurs only outside combat and dialogs; battle callouts also have cooldowns. A subtle torchlight overlay flickers across the notebook.

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

Coverage includes desktop/mobile and stable layouts, explicit event confirmations, critical math and automatic holds at Skip speed, critical treasure/fountain/trap rolls, persistent pace controls, stationary handle hitboxes, rerouting during travel, safe visible-only paths, movement-speed scaling, declined fountains, permanent death and burial, saved deaths across reloads, survivor-only healing and EXP, beacon radius, class weights and blanks, enemy difficulty, shared armour and stun costs, rare loot and coin showers, recruit choices and cap, shop frequency and transactions, artefact passives, speech cooldowns, clipped trap art, a complete ten-floor campaign, 1,000 connected generated maps, save migration, and offline downloads.

The complete-campaign integration check uses a controlled attack loadout and extra health to exercise navigation, loot confirmations, enemy turns, and progression independently of luck. It does not replace movement, events, enemy AI, rewards, or victory logic. Other tests isolate actual combat calculations and failure paths. The offline test executes the downloaded bytes with networking disabled because managed cloud Chromium restricts `file://` navigation.

## Credits

The embedded **Patrick Hand** font is by Patrick Wagesreiter, distributed under the SIL Open Font License 1.1. The complete license is in the HTML source. Illustrations are inline SVG; all effects run locally.
