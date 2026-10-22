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
