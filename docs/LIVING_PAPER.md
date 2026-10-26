# Support, Execute and living pencil presentation

The game still ships as one offline `index.html`. Rebuild embedded sources with
`npm run build:ui`. No save format, artwork asset, class unlock or encounter
budget changes are required for this update.

## Support scaling

`SUPPORT_SCALING` in `game/hero-builds.js` owns the numbers. The old Healer is
already merged into Mage: no separate class or speciality selector returns.
Mage rolled healing and healing Resonance gain 2.5% per level after four,
capped at 15%. Round the additional recovery once, before ordinary criticals.
Other classes and raw healing marks retain their base values. Shared Fury
spending and healing target rescue rules remain in force. AI uses the same
class factor when estimating recovery.

Fountains keep their previous values on floors 1–4. Each later floor adds a
further .3 percentage points of base maximum HP and 1.2 percentage points of
rolled healing. Floor ten is now 21.3% maximum HP plus 73.4% of the rolled heal,
up from 19.5% plus 66.2%. Player-facing percentages remain rounded. These are
fountain bonuses, independent of the caster's class and level.

## Ranger: charge, attack, repeat

`RANGER_EXECUTE` and its shared helpers in `game/hero-builds.js` are authoritative:

- Patience caps at six. Other party actions and Ranger support actions add two.
  Each completed enemy turn adds one, including a missed stunned enemy turn;
  multiple strikes in that turn do not add multiple charges.
- Any Ranger attack spends stored patience. The additional Execute hit uses the
  target's missing HP at roll planning, not after the first hit. It lands after
  ordinary hits and is aimed only at the selected target.
- The permanent seal fires its own physical shot, even with empty patience:
  `2 + floor((level − 1) / 3)`. This shot participates in ordinary criticals.
- Stored bonus is `ceil((4 + .8 × level) × charge/6 × (.55 + 1.6 × missingHP))`.
  The seal multiplies that bonus by 2.5 **once**. Cap stored bonus at
  `12 + 3 × level`, before application. Stored damage never receives another
  critical, camp power or area multiplier. Armour still absorbs it normally.
- At level ten, maximum-rank physical / seal / physical with a ×4 critical,
  full patience and no equipment deals 52 ordinary damage plus 17 Execute
  against a healthy 205-HP final guardian: 69 total. Against the same guardian
  at half HP the stored bonus is 41. This is a meaningful finishing burst,
  without turning the patience/seal/critical combination into a squared bonus.
- The meter highlights the ordinary-hit bonus while charging and the seal
  bonus at full patience; its tooltip states both values. The
  full-bar seal has its own cue, pullback, flash, paper burst and damage number.
  Shared real-roll and AI formulas recognise seal-only solo Rangers as offence.

This is a bounded numeric check, not a claim about live campaign win rates.
Gear, traits, camp lessons and party composition still influence a run.

## Cosmetic source ownership

`ui/combat-life.js` / `ui/combat-life.css` own status motes, species idle movement,
Execute presentation, the spring-loaded Jester and compact artefact summaries.
`ui/notebook-pages.js` retains the shared per-action portrait movement controller.
`ui/combat-feedback.js` invokes the larger passive pose. `ui/reward-audio.js`
owns new temporary synthesised cues through the existing pooled SFX bus.

- Poison bubbles and a moving purple wash, and stimulant sparks/breathing light,
  sit behind the existing hoverable condition badges. They never intercept input.
- Idle enemies float, skitter, sway or breathe according to species. CSS uses
  individual translate/rotate/scale properties, preserving fragment transforms.
  Only illustration contents move; portrait buttons, health bars and targets stay
  fixed. Dead creatures do not idle. Heavy attacks pull back before lunging;
  passive abilities use a separate crouch/release pose. Status/intent redraws
  preserve a finite gesture's keyframes and elapsed time, so the new drawing
  does not cancel a just-triggered trait animation.
- The portrait-motion slider scales the motion, including zero to stop it.
  Reduced-motion stops ambient portrait/status loops. Side pages pause loops.
  These motions never roll gameplay RNG.
- When one paid Jester roll both fills anticipation and lands Wildcard, a drawn
  toy box opens at the middle reel and launches a grinning spring head at a
  living target. This precedes the existing six-mark Punchline, adding no damage,
  extra turn or extra Wildcard. Skip/reduced motion retain bounded paper bursts
  and impact shakes. The spring freezes during utility pages and cleans up on
  restart, fast-forward or cancellation.
- Run Treasures uses a fixed illustration/text row with a short effect summary.
  Full rules remain in its hover/focus tooltip and inspect sheet. Names, effects
  and footer remain within the frame on narrow screens; no clipping or scrolling.

Terrain animation is deliberately a separate presentation-only change in
`ui/terrain-motion.css`; see its companion documentation when enabled. It can
be disabled independently and its commit can be reverted without removing any
of the balance or character presentation above.

## Verification

`tests/living-paper.test.cjs` checks actual HP restoration, seal-only solo
attacks, capped critical Execute, charge by whole turns, Jester trigger conditions,
no cosmetic RNG, cancellation, status controls, and artefact text bounds at
1920, 1280, 390 and 320 pixels. Existing build/combat/identity/guide tests remain.
`tools/review-living-paper.cjs` creates targeted animation and compact-layout
captures plus the numeric Execute matrix. Run the full `npm test` and
`npm run review:ui` before release; inspect the captures, not only the pass counts.
