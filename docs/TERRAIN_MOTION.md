# Optional terrain motion — isolated cosmetic pass

**Disable immediately:** Options → Display → **Animated terrain**. This is a
saved preference, independent of Character motion and Torchlight. Reduced-motion
also disables these loops. Skip cinematics leaves this ambient scenery running.

**Revert only this pass:** revert the commit named
`Add optional, independently reversible terrain motion`. It comes after the
support/Ranger/character-life commit. Reverting it removes only the new sheet,
its display preference/integration, this note and its tests. It does not remove
Ranger tuning, late recovery, treasure layout fixes or character animation.
NormalisePreferences safely ignores a saved setting after its code is reverted.

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
