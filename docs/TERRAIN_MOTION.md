# Optional terrain motion — isolated cosmetic pass

**Disable immediately:** Options → Display → **Animated terrain**. This is a
saved preference, independent of Character motion and Torchlight. Reduced-motion
also disables these loops. Skip cinematics leaves this ambient scenery running.

**Source boundary:** the original isolated motion pass is commit `7ea1805`,
`Add optional, independently reversible terrain motion`. It introduced only this
sheet, its saved preference/integration and terrain-specific documentation/tests.
Later Display layout work retains that separate ownership.

**Undo only the later water-speed adjustment:** revert the commit named
`Quicken water currents independently`. River strokes return from 2.6s to 3.2s
and the current sheen from 2.4s to 3s; lava is unchanged. This commit contains no
music, combat, status or options-layout changes. To stop all new terrain motion
immediately, use the saved Animated terrain switch above. A complete source
removal also needs the builder entry and the Display preference removed; keep
support, Ranger and character-life sources intact.

`ui/terrain-motion.css` contains every new terrain animation. The builder embeds
it into the standalone HTML; no new asset, art path, random call, map-generation
rule, movement rule or combat calculation is introduced. Rivers have a muted
blue current and passing highlights. Lava's existing rock boundary stays still;
small warm bubbles and embers move within it. Bridge water flows underneath a
stationary traversable deck. Covered tiles expose no extra information.

The loops use CSS, small transforms/opacity and bounded background motion. Only
revealed river/lava/bridge artwork is affected. Utility pages pause motion;
reduced-motion removes it. Never animate tile containers, the coordinate board,
wall outlines, bridge decks, discovery labels or hitboxes.

After editing, run `npm run build:ui`,
`node --test tests/terrain-motion.test.cjs`, `npm run review:living` and the
normal browser regression/visual checks. Terrain tests verify option persistence,
no gameplay RNG/map mutation, reduced motion, hidden tiles and stationary
blocking borders/bridge decks. The targeted visual review includes enabled and
disabled map views at desktop and Deck sizes.
