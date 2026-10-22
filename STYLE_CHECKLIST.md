# UI review checklist

- [ ] It resembles the supplied pencil-notebook reference: cream paper, graphite,
      purposeful uneven lines, expressive sketches and clean hierarchy.
- [ ] It uses `ui/notebook.css` tokens and shared component primitives.
- [ ] Icons/illustrations use `ui/drawings.js`, remain recognisable at small sizes,
      and show injury/death clearly where relevant.
- [ ] It contains no random filler text, fake notes/lore, meaningless scribbles
      or drawings that could be mistaken for game content.
- [ ] Hatching describes a material or covered tile; it doesn't clutter empty space.
- [ ] Colour communicates health, damage, danger, value, focus or an existing
      meaningful status. Default, warm and dark palettes remain readable.
- [ ] Headers feel hand-lettered; body text, HP and outcomes remain easy to read.
      Text itself is never filtered/distressed.
- [ ] Hero HP numbers and shaded bars are above reels; EXP clears the full lever
      hitbox, and the edit row fits inside each fixed card.
- [ ] Tape labels, graphite frames, masonry and edge wear use shared assets;
      paper wear stays outside gameplay information.
- [ ] Expanded dropdown text/backgrounds are readable in every palette, including
      the animation-speed controls in the toolbar and options page.
- [ ] Buttons have clear hover/focus cues; side tabs grow without rotating;
      handles keep their generous stationary hitboxes.
- [ ] All three hero rows and bag pockets fit; transient content doesn't shift
      controls; only the log and final roster scroll inside the interface.
- [ ] Map token alignment, active-event badges, walls, rivers and stairs are clear.
- [ ] All options pages, worn equipment labels, trait tooltips, dead/non-flashing
      bars, torn-paper sheets, Masterwork supply labels/effects, paired enemies, floor-clear
      summaries, popup choices and compact layouts were checked.
- [ ] Changes don't consume gameplay RNG, modify outcomes, timings or balance.
- [ ] `npm run build:ui` and `npm test` pass; `npm run review:ui` screenshots were
      visually compared with the reference, not merely generated.
- [ ] The generated `index.html` still runs and downloads without external assets.
- [ ] Camp cards and four banking choices fit without internal scrolling; costs,
      ownership, next-run toggles and the camp balance are easy to distinguish.
- [ ] Status tooltips show actual effects within the viewport, and quiet travel
      does not flash treasure/inspection controls or active combat counters.
- [ ] Ranger Aim amount, bar, next-hit bonus and tooltip fit beneath reels at
      1920, 1280, 390 and 320px without touching EXP or expanding the card.
- [ ] Full-screen edge effects leave the centre/inputs clear, use functional
      colours, respect reduced motion and stop immediately when toggled off.
- [ ] Block colour strengthens up to twenty without capping protection; intercepted
      attacks target the shield and only HP overflow also targets the hero.
- [ ] Card-wide rolling preserves nested target/edit/equipment controls; portrait
      statistics stay readable within compact viewports and use current values.
- [ ] Options tabs preserve their title; clues linger before fading; final victory
      shows an automatic deposit receipt with amount-scaled coins and fireworks.
