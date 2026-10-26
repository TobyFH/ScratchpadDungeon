# Battle sound and interface follow-up

No save migration, combat rule, enemy budget, purchased reel or art asset changes.

## Music

`ui/music.js` owns both original MIDI scores and `musicVoices(scene, step)`.
The offline builder embeds it; the existing `GameSound.background()` scheduler
dispatches cues through the same music gain, pooled voice limit and master
limiter. Exploration keeps its previous score, timings, instruments and gains.

Battle eighth notes now last .24 seconds (125 BPM). A low triangle ostinato,
sub-bass at chord changes, pitched sine kick, filtered noise snare/brush and
shorter lead notes create a more urgent, bass-forward arrangement. Short notes
keep the normal pool available for creature calls and uploaded SFX. Noise
filtering is explicitly opt-in (`noiseFilter`) so existing effects do not change.
No recording, external service, network request or gameplay random draw is used.
Music, master volume, mute and hidden-tab suspension retain their existing roles.
`GameSound.stats.musicParts` records successfully scheduled instrument groups.

## Display layout

Display uses `.settings-columns` with two `.settings-column` stacks. Sliders
and palette live on the left; three visual-effect toggles and preview/fullscreen
buttons live on the right. Each stack sizes its own children. All controls fit
the existing reserved `.settings-panel`; no extra scrollbar, clipped text or
footer overlap conceals a sizing error. Checkbox descriptions align with their
text, rather than underneath the checkbox. Native labels, IDs, actual setting
handlers and keyboard access remain intact.

## Stunned reels

`machineLockMarkup()` in `game/combat-clarity.js` is shared by hero locks and
`enemyReelLockMarkup()`. The same paper veil, gold stun glyph, explicit reason
and dimmed/blurred windows apply to both sides. `syncEnemyReelLock()` runs during
full and status-only enemy updates, including stun recovery. It never replaces
the actual windows, consumes randomness, advances a turn or changes stun rules.
Dead enemies have no stun veil; paired enemies show it only on affected foes.

## Combo names

`CLASS_COMBOS` and `complementaryEffects()` in `game/balance.js` remain the source
of truth. These existing bonuses have not been retuned:

- **Venom Edge:** a Rogue rolling physical plus poison or stun gains +1 physical
  damage for that roll. It does not itself add poison or a lasting status.
- **Spellweave:** a Mage rolling spell/poison plus heal/block/ally stimulant gains
  +1 spell damage. Add +1 rolled healing if a heal mark is present; otherwise add
  +1 rolled block if block is present. Both recovery bonuses are not granted on
  the same roll. Ally stimulant alone supplies no additional healing/block.

## Checks

`tests/battle-polish.test.cjs` checks actual control and text bounds across
1920×1080, 1280×800, 390px and 320px in all three palettes; saved Display handlers;
solo/paired stun application, redraw, recovery and death; exact combo bonuses;
and real low-frequency music output, pooling, mute and zero cosmetic RNG.
Captures and signal measurements are written to `test-results/battle-polish/`.
Run the full browser suite and `npm run review:ui` before release; review the
screenshots in addition to checking assertions. Terrain stays separately owned
by `ui/terrain-motion.css` and its existing saved toggle/reduced-motion rules.
