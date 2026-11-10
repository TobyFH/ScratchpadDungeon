# Second targeted performance pass

This pass removes redundant layout and hover work. It changes no gameplay,
save format, artwork, particle count, effect lifetime or animation speed.
The previous map cache and purple mushroom treatment remain intact.
The resize path also ignores player positioning before intro startup has loaded
a run; rotating/resizing the browser during the film no longer reads absent state.

## Layout ownership

`ui/layout-performance.js` is embedded in the standalone HTML. Its bookkeeping
is private to presentation and is never stored in `state`.

- `fitNotebook()` still uses the original scale formula. It skips size reads
  when the viewport, fitted class and scale are unchanged and no real size
  change has been reported. `fitNotebook(true)` explicitly forces a measurement.
- One ResizeObserver watches the desk and keyboard bar's layout dimensions,
  before CSS zoom. Real content/viewport/font changes invalidate fitting and
  queue the existing UI fitting frame. Font loading also invalidates it.
  The frame calls `fitNotebook()` before dialog/text fitting, so changed keyboard
  prompts are reflected without waiting for another game action.
- `updateKeyboardBar()` retains its authored labels and DOM when unchanged.
  A changed prompt updates synchronously. ResizeObserver keeps the existing
  `--keyboard-bar-height` accurate when wrapping, fonts or the viewport change.
- `fitDialogs()` returns before reading toolbar/footer geometry when both
  interaction layers are hidden. Visible dialog fitting remains unchanged.

Do not replace actual dimension invalidation with a timer or a permanent size
assumption. Direct synchronous callers that change geometry before observer
delivery can use `fitNotebook(true)` or `notebookLayout.invalidate()`.
Do not change the scale formula or shrink content to meet a performance target.

## Hover work

Moving among SVG paths inside the same tile no longer recomputes its route and
inspection. Entering a different tile still runs the original code immediately.
Any map redraw invalidates this shortcut, so a changed route/room is inspected
again on the next internal crossing even if the same button remains mounted.
Clicking, retargeting and keyboard navigation use their original handlers.

Tooltips avoid repeated content/layout work within the same unchanged control.
Hero tooltip inputs are compared conservatively, including the party, enemy,
run bonuses, steps and clock second. Changed stats/text, a newly entered badge,
focus, hidden tooltips and explicit reposition calls still refresh immediately.
Internal pointer-out/over pairs retain the tooltip; leaving its actual control
still dismisses it, and entering a nested status badge displays that badge.
Resize handling retains the original tooltip bounds checks. No delayed hover
or throttled mouse sampling is introduced.

## Checks and measurement

`tests/layout-performance.test.cjs` checks cached reads, the original sizing
formula at seven viewport transitions, footer/font invalidation, observer
stability, hidden/visible dialogs, hover deduplication, live tooltips and
unchanged world/RNG/particles. It saves options screenshots at desktop, Deck
and phone sizes. Existing notebook, environmental and full regressions apply.

Use `node tools/profile-overworld.cjs --full --html /path/to/baseline.html
--out test-results/full-ui-profile` for the full UI fixture; omit `--full` for
the existing map-only fixture. The tool now reports inclusive helper timings
as well as browser main-thread/layout/style metrics. It does not ship in the
game or add runtime instrumentation. Run comparisons without the test suite
competing for CPU.

An isolated 1920×1080, 4× CPU comparison against `62d448d`, over 24 unchanged
full UI refreshes, measured:

| Check | Before | After |
| --- | ---: | ---: |
| Mean synchronous `render()` call | 45.3 ms | 15.6 ms |
| Browser main-thread task duration | 2.376 s | 1.908 s |
| Layout work | 498 ms | 377 ms |
| Style recalculation | 382 ms | 279 ms |
| Layout count | 217 | 193 |

Synchronous call time excludes later frame work; it is not a frame-time or FPS
claim. The main-thread metric fell about 20% in this fixture. Other machines and
scenes will vary. Both walks reached the same tile in eight steps. The frozen
map screenshots were pixel-identical (175,014 pixels); the full notebook differed
in 52 pixels out of 2,073,600 with a maximum mean channel difference below .00014.
No artwork, grain, particles or other quality settings were reduced.

The authored hover check also verifies that 20 internal path crossings cause
no additional pathfinding or unchanged-tooltip rebuilds after initial entry.

Run `npm run build:ui`, the focused layout checks, `npm test`,
`npm run review:ui` and `npm run review:environment` before publishing. Inspect
screenshots and retain reports in `test-results/performance-two-*`.
Broader party/combat rendering and text-fitting refactors are left for a later
trace-guided pass if still needed.

## New-run choice hold

`notebookLayout.hold()` keeps the current fit while the player chooses a new
adventurer. Prompt changes must not resize the expedition underneath that sheet.
`release()` invalidates fitting on close/start. A real viewport change or explicit
force still refits. The scale formula, footer observer and font invalidation are
unchanged. See [Expedition polish](EXPEDITION_POLISH.md) for the new shared panel
baselines and pixel-snapped whole-map shake.
