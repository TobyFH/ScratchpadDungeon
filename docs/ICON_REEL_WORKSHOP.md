# Icon reel workshop: isolated, reversible presentation

The default workshop shows clickable symbol cards, with their costs underneath,
and four rank buttons showing the **whole** point cost or refund to that rank.
There is no destination dropdown, separate Swap button, or sequential
Upgrade/Downgrade button. Selecting an affordable symbol or rank applies it.
Blank faces require an explicit symbol before ranking; no guessed inscription.
Class and mystery marks remain permanent and use the same reserved geometry.

## Revert only this redesign

In `ui/icon-reel-workshop.js`, change:

```js
let reelWorkshopLayout = "icons";
```

to `"legacy"`, then run `npm run build:ui`. That restores the exact prior renderer
retained as `legacyEditor()` in `game/reel-upgrades.js`. It does not undo the heal
split, new biome mechanics, prices, AI, balance or saves. The presentation has no
save migration. Its CSS is scoped to `.icon-workshop`; the fallback never gets
those styles. The default layout can be restored by changing that one value back.
The redesign is also committed independently of the main biome/combat expansion.

## Ownership and transactions

- `ui/icon-reel-workshop.js`: default renderer, navigation, full-rank quotes and
  the layout switch. `quoteFaceTier()` copies the hero's faces and investment
  receipts, then runs each rank change through the existing `applyFaceEdit()`.
- `ui/icon-reel-workshop.css`: scoped notebook layout, icon/card rows and desktop/
  compact sizing. Five symbol columns on desktop, three on phones; classes have
  different legal palettes, with reserved rows based on their actual count.
- `game/reel-upgrades.js`: unchanged shared price/refund, inscription, swap and
  class/mystery validation, plus the retained renderer. Automation uses those
  same validators; it gains no cheaper or free edit path.

A direct rank change is quoted first. An unaffordable target cannot apply a
partial change. The selected face, its paid investment receipts, points and last
preview are committed together. Downward quotes sum the original per-rank
refunds; no new refund multiplier or balance rule is introduced. Normal swap
costs are shown for the current rank. Empty inscription keeps its existing extra
cost. Every face still has equal roll probability.

Desktop shows a face list; narrow screens retain the compact face selector to
choose *which existing face* to edit. The removed dropdown was the replacement
symbol chooser. Real type icons, readable names, costs and descriptions are all
visible in the new replacement grid. Hover/focus descriptions use the shared
notebook tooltip; point changes get a reserved receipt line. Inactive pages use
`aria-hidden` and `inert`, reserving their real size in one grid; the legacy
`[hidden]` rule intentionally removes elements and cannot reserve that space.
Critical combinations paginate six per sheet rather than overflowing. Keyboard reel and
face navigation, native face selection, Tab and Enter remain usable.

## Verification and retained fixtures

`tests/icon-workshop.test.cjs` exercises default icon controls, sequential-price
parity, real refunds, atomic affordability, class/mystery locks, explicit blank
inscription, the fallback switch, and every class at 1920, 1280, 390 and 320px.
It captures the actual default screens under `test-results/icon-workshop/`.

Existing tests that click the old dropdown/operation controls explicitly choose
`reelWorkshopLayout = "legacy"`; they continue to test the requested rollback
rather than being silently deleted. The general review also retains those old
workshop fixtures; default-workshop captures come from the new focused suite.
Both presentations still share all actual edit validations and save data.
