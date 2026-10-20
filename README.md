# Scratchpad Dungeon

A little adventure in the margins: a complete dungeon crawler in **one self-contained `index.html`**. No runtime dependencies, external fonts, assets, services, build step, or credentials.

## Play

Download `index.html` and open it in a modern browser. If your browser or managed device restricts local HTML, serve the folder:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000`. The in-game **Save HTML** button downloads another complete offline copy. That copy contains the game, not an export of the current run. Progress automatically saves in browser local storage when available; saves belong to that browser and origin. Moving the file or changing servers may start a separate save.

## The adventure

- Start with Alden, a fighter. Uncover a connected, procedurally generated notebook map by clicking a destination or using arrow keys / WASD. Travel takes a shortest path and stops at discoveries.
- Find treasure, traps, healing wells, revealing beacons, and rare wanderers. Recruit Mira the healer and Wren the rogue, up to three heroes. A full company receives supplies instead.
- Any living hero may spin repeatedly in combat. Each of three personal reels chooses one of six editable faces: attack, heal, block, or stun, with three power tiers. A matching type **and tier** gives a ×1.5 pair critical or ×2.5 triple critical, rounded up per effect.
- Team block persists between encounters and absorbs incoming damage until consumed. Enemies display damage, strikes, attack frequency, and a shared countdown. Stun cancels enemy turns. Choose a healing target for both reels and tonics; healing can revive a fallen hero.
- Spins and victories grant EXP. Leveling increases maximum health by six and awards two personal editing points. Treasure and victories also grant points. Each face change or tier upgrade costs one of that hero's points.
- Stairs are optional. On depth three, defeat the Sunseed keeper below the stairs, then return home from any stairs to win. You can also retire early or continue deeper. A party wipe ends the run.
- Use **Skip animations** for instant resolution, or **Continue**, Space, or Escape to dismiss a critical popup. The game honors the initial reduced-motion preference. Field guide dialogs support keyboard focus trapping and Escape.

## Browser tests

Node.js 20+ and Chromium are needed only for development tests:

```sh
npm ci
# If Chromium is not already available:
npx playwright install chromium
npm test
```

The suite uses `/usr/bin/chromium` when available, otherwise Playwright's installed Chromium. Set `CHROMIUM_PATH` for a different executable. It starts its own loopback server, exercises gameplay in a real browser, and writes screenshots and a tested HTML download to ignored `test-results/`.

Tests cover responsive layouts, dialogs, travel, tile effects, party limits, criticals, tiers, repeated actions, enemy frequency and multi-strikes, persistent block, stun, targeted healing and revival, leveling, reel editing, connected maps, optional stairs, a complete campaign, defeat/restart, reload persistence, and the downloaded game's execution with networking disabled. Controlled loadouts isolate combat calculations and make the campaign check independent of luck. No assertions, enemies, or game mechanics are disabled.

Everything needed to play lives in `index.html`; `package.json`, its lockfile, and `tests/` are development tooling only.
