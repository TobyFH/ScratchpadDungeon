# Bloodbinder and stable notebook interactions

The distributable is still one offline `index.html`. Edit the owning modules,
run `npm run build:ui`, and commit the generated HTML alongside the sources.
Existing paid reel faces, camp ranks, gold, artwork and explicit settings are
preserved. New fields are normalized on load; no save reset is required.

## Bloodbinder

The permanent camp invitation costs **1,200 banked gold**. Unlocking it enables
starts and recruits, like Ranger/Berserker/Jester. Locked selection cards open
the correct purchase page. Camp keeps three equal adventurer cards per page,
including when responsive fitting runs; the fourth invitation uses another page.

`game/bloodbinder.js` owns the calculations and status lifecycle. Hero HP starts
at 32; criticals use 1.5/2/2.5/3. Legal ordinary marks are physical, spell, ally
heal, Blood Seed and Empty. There is one immutable middle Blood Exchange seal.
Blood Seed is class-exclusive, including editor/AI validation and old-face
normalization; it does not enter Jester mysteries. Generic equipment works.

### Blood Seed, Bleeding and Clotted

Each power unit first creates/extends Bleeding to **three enemy turns**. Further
power raises damage and healing equally, capped at **12 per tick**. Ordinary
critical matching can increase Seed power, not the tick a second time.

Bleeding ticks at the start of the affected enemy's whole turn, including a turn
lost to stun. A three-strike enemy ticks once, not three times. Damage bypasses
block, never consumes Vulnerable, and the healing pool is bounded by actual HP
damage dealt. One pool is distributed to the lowest injured allied HP ratios.
It never heals each ally for the entire pool, resurrects anyone, or multiplies
camp recovery once per allocated point. Actual restoration uses shared
`healHero(..., {exact:true})`, retaining Fury spending and health/stat feedback.

Expiry leaves Clotted for the longest Bleeding duration reached (at most three
own turns). Clotted reduces enemy recovery by 50%, rounded down, through shared
`enemyRecovery()`: normal healing, Second Wind and Jester mercy all use it.
An application does not lose a Clotted turn immediately when Bleeding expires.
Both statuses clear after combat and survive a mid-battle save. A lethal tick
stops that enemy acting; no DoT continues after the final opponent falls.

### Blood Exchange

Compare the target's HP fraction to the lowest living ally's HP fraction. If
the enemy has more, transfer **25% of that fraction gap**. Enemy loss is its
maximum HP times that fraction; ally recovery is the ally's maximum HP times
the actual fraction removed, after integer rounding and the cap.

Otherwise, deal damage using 25% of the difference between the healthiest ally's
HP fraction and the enemy's. Both branches cap boss HP loss at **10% of its
maximum per use**. This conservative cap covers the damage branch too.

Exchange is a separate, selected-target effect: never multiplied by criticals,
area attacks, camp/equipment damage, or Vulnerable. Ordinary accompanying marks
still act/crit normally. The denominator is captured before damage, so an enemy
changing phase/max HP cannot increase the percentage healed. Shared
`bloodExchangePlan()` supplies real combat and AI forecasts. Forecasts add this
fixed transfer after ordinary critical/bonus calculations.

Hero presets, prices/permissions, crit pools, recruitment and forecasts remain
in the existing shared modules. `ui/drawings.js` adds a hooded pencil portrait,
seed drop, exchange arrows and broken crystal; corpses use the same fallen-art
pipeline. Status badges, numbers, callouts and log explanations use maroon ink.
The class has its own synthesised cry and speech. Hostile recruits follow the
existing enemy-budget model: their Seeds become spell marks, just as enemy class
seals become ordinary marks; they do not inherit percentage transfers.

## Crystals and falling stone

Selecting a revealed adjacent crystal, or first uncovering it by walking towards
it, offers **Smash / Leave**. Declining changes nothing. Smashing changes only
that tile to traversable `brokenCrystal`, showing shards and removing that
source from every aura query. Other crystals keep their existing effects,
including overlaps. The seen wall is clickable for interaction, but remains
impassable until smashed. Mouse and keyboard share `move()`/`crystalEncounter()`.

`game/living-dungeon.js` retains ceiling countdowns. Falls now show a larger
accelerating rock, smoke/dust, and a stronger impact. Source-tile damage stays
`2 + floor(depth/3)`; within one tile (including diagonals), damage is half,
rounded down with a minimum of one. Farther tiles take none. The leading living
hero receives the hit, as before. The Unwritten can also be crushed within that
radius, leaving its existing treasure outcome without EXP. Hidden/distant
ambient drops stay out of the log; actual injury is still recorded.

## Interface and preferences

- `ui/layout-performance.js` reserves both keyboard contexts in the same grid
  cell. The inactive context is invisible/inert; switching context never changes
  footer height. Resize/font changes still update real dimensions. Unchanged
  content/context performs no new size reads or DOM replacements.
- `paintEncounterMarkup()` retains the connected Enemy heading across redraws;
  the tape label has no repeating animation or opacity transition.
- Speech gets an ink outline, shadow and stronger lettering, with a brighter
  warm-paper backing. `ui/creature-voices.js` covers every ordinary/biome species
  with appropriate entrance/attack/hurt/death words and variation; no ellipsis
  fallback. Frequency is unchanged and all variation uses cosmetic RNG.
- New/default palette is Warm; default music is **0.128**, 20% below 0.16.
  Explicit saved settings are retained. Reset settings adopts Warm.
- Audio's saved **Battle music** checkbox keeps biome music during fights when
  disabled. Other music, jingles, SFX and actual combat continue normally.
- Run Treasures typography and its reserved card rows grow together. The desktop
  artefact card is 136 source pixels, with 22/19/16px name/effect/footer text.
  Full rules remain in the tooltip/inspect sheet. Other lower frames keep their
  shared baseline. Compact workshop headers reserve more space for actual edits.

## Verification

`tests/bloodbinder-update.test.cjs` covers purchases/real locked-card navigation,
legal ranks and saves, actual critical Exchange, boss caps, exact shared healing,
Bleeding/Clotted timing, stun turns, final-kill cleanup, crystal choices, falling
damage radius, stable footer/book sizes, retained Enemy labels, warm speech,
all-species voices and workshop/audio controls at 1920, 1280, 390 and 320px.

Also run the layout, guide, camp, combat, crystal, event-log and full suites plus
both visual reviews. Captures belong under `test-results/bloodbinder-update/`.
Inspect the actual pictures: checking only button bounds misses overlapping
description text. Keep the legacy rollback workshop readable too.
