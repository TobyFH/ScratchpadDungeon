# Rogue Flurry: shadow backstab

`ui/class-moments.js` and `ui/class-moments.css` own this cosmetic sequence.
Rebuild their embedded regions with `npm run build:ui`; the resulting
`index.html` remains entirely self-contained. No external art or audio is needed.

## Trigger and presentation

The existing combat dispatcher calls `classSignatureFX` when a Rogue lands its
permanent middle-reel **Flurry** seal. Ordinary attacks and Venom Edge do not
trigger this signature. Flurry still rolls and resolves its three extra attacks
through the original combat pipeline, including its existing critical rules.

The Rogue's current pencil portrait fades into a graphite shadow, reappears on
the far side of the selected enemy, makes three quick dagger slashes, then
returns rapidly to its portrait. A faint afterimage keeps its origin readable.
The enemy's actual silhouette masks the travelling illustration so it appears
behind the creature. A pointed dagger, curved red/paper cuts and three small
impact bursts replace the previous rectangular blade glyphs.

Only an illustration moves. The hero card, portrait button, condition badges,
health strips and all target hitboxes keep their positions and interactions.
The sequence applies no damage, statuses, bonuses, rolls or gameplay randomness.
Real damage segments follow after the effect's promise, as before.

## Lifetime and accessibility

- One finite animation-frame loop drives the overlay. All mask/art IDs are
  unique; no viewport-wide blur or drop-shadow filter is introduced.
- Animation speed shortens the sequence through the shared pace setting.
  Portrait motion scales its lean/lunge; zero motion and reduced-motion use
  immediate impact feedback instead of a travelling portrait.
- Utility pages and background tabs pause elapsed animation time. The overlay
  hides while a utility page is open, keeping settings readable.
- Skip and fast-forward retain bounded impact particles and the shared shake
  setting. They do not leave the hero invisible.
- A changed run, animation version, dead/removed target or resized viewport
  cancels the overlay. Cleanup restores every portrait hidden by the effect,
  including portraits replaced by a UI refresh while Options is open.

Keep all future changes cosmetic. Do not move damage calculations into this
effect, consume gameplay RNG, move clickable portrait containers or introduce
unlabelled damage numbers before the actual combat result.

## Validation

`node --test tests/rogue-backstab.test.cjs` covers the real Flurry dispatch,
selected-target identity in a paired fight, three impact cues, zero cosmetic RNG,
unchanged HP, stationary portrait geometry, utility suspension, reduced motion,
fast-forward and cancellation. It also captures the effect at desktop, 1280×800,
390px and 320px widths, including dark/warm palettes, under
`test-results/rogue-backstab/`.

Run `npm test` and `npm run review:ui` before release. Inspect the targeted
screenshots as well as the general notebook review.
