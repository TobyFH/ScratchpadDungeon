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
- [ ] Ranger Execute amount, bar, next-hit bonus and tooltip fit beneath reels at
      1920, 1280, 390 and 320px without touching EXP or expanding the card.
- [ ] Full-screen edge effects leave the centre/inputs clear, use functional
      colours, respect reduced motion and stop immediately when toggled off.
- [ ] Block colour strengthens up to twenty without capping protection; intercepted
      attacks target the shield and only HP overflow also targets the hero.
- [ ] Card-wide rolling preserves nested target/edit/equipment controls; portrait
      statistics stay readable within compact viewports and use current values.
- [ ] Options tabs preserve their title; clues linger before fading; final victory
      shows an automatic deposit receipt with amount-scaled coins and fireworks.

- [ ] Rolled symbols leave the actual contributing windows and land on the right
      recipient, including shared shields, self buffs and party heals. Icon/beam
      preferences and Skip retain clear, bounded feedback without altering RNG.
- [ ] The workshop shows face odds, explicit symbol choices, clear upgrade costs
      and downgrade refunds; the middle class seal cannot be removed or copied.
      Its controls remain readable and keyboard operable at compact sizes.
- [ ] Execute charge and points reminders fit reserved card space. Reminders
      animate paint only; portraits open the workshop and heal targets stay clear.
- [ ] Both arrival names/portraits and their separate combat destinations are
      present. Pun identities retain pencil style, stats and species IDs; the
      shared enemy protection row never pushes reels into target controls.

- [ ] Every rank-IV icon fits, including Rogue/Berserker windows; flying marks
      are readable without covering controls.
- [ ] Temperament is fixed and visible; no Mage role selector has reappeared.
      The workshop explains odds, effects, destination and point changes.
- [ ] Solo shields sit below the portrait; paired enemies have one large shared row; intent, dual/elite/boss arrivals,
      initiative, surprise, passives, Fury and Vulnerable are distinct and legible.
- [ ] Criticals settle on a large final number, new travel choices remain explicit,
      and full bags warn before a purchase takes gold.

- [ ] Workshop lettering remains readable on compact sheets; native face selection
      and Power/Replace/Weight pages expose every edit without moving the footer.
- [ ] Guide, camp and bestiary navigation remain stationary across their pages;
      utility tabs still work while a critical or confirmed event is pending.
- [ ] Portrait condition badges contain only icons and have accessible tooltips.
      One faction has one protection control; only meaningful HP overflow hits a hero.
- [ ] Treasure artwork, reel width and confirm positions survive an inline critical
      without resizing. Wells are centred; trap saves never show a zero-effect crit.
- [ ] Creature remains match their species without an upright contour ghost;
      portrait movement honours both its slider and reduced-motion preferences.

- [ ] Enemy tape fits its text and reserved row; chest/skull artwork is centred.
- [ ] Critical original/final values use one stable readout, with no calculation
      grid, pending result box, layout shift or altered rounding.
- [ ] Workshop note/footer clear every edit mode and long class description at
      desktop and compact widths; text remains readable after fitting.
- [ ] Bridge wood never fades with a visited/resolved state; water matches rivers.
- [ ] Blackouts poof in/out, poison reads POISON in purple, and drain healing
      returns only after outgoing damage arrives. Automatic reading holds and
      manual skipping both work at every speed.
