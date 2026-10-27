# Event log

Combat and exploration share one **Event log**. Newest entries come first, with
at most 60 retained entries. The existing M shortcut and Focus log button remain.
Only the entries scroll; the notebook geometry and gameplay rules are unchanged.

Underlined, lightly highlighted names have explanations on hover or keyboard
focus. Gold uses the existing muted gold pencil wash; other names use the shared
focus token. Descriptions use the existing viewport tooltip, not an extra box in
the journal. Escape dismisses it, and resizing keeps it inside the viewport.

## Ownership and adding an event

`game/event-log.js` owns recording, escaped rendering, vocabulary, saved metadata,
combat-summary integration and local environmental relevance. The builder embeds
it in `index.html`; run `npm run build:ui` after editing. Presentation is in the
Event-log block of `ui/notebook.css`.

Existing `log(text)` calls continue to work. Vocabulary comes from the shared
character events, hero traits, enemy passives, class combinations, class abilities,
travel events and item definitions, plus short exploration/status explanations.
Whole names match without underlining parts of unrelated words. Longest matches
win. Custom explanations override generic descriptions:

```js
log(`${hero.name} gains ${trait.name}.`, {
  category: "trait",
  important: true,
  terms: [{name: trait.name, description: trait.description + " Earned: " + reason}],
});
```

Use `important: true` for a named event that must survive nested grouped actions
(e.g. a rare personal moment, trait gain, status recovery or enemy passive).
Individual hit/healing lines still collapse into one truthful action summary.
Class combinations use `inline: true, label: bonus.name` to put their name and explanation in that
summary without another line. Never add logging to forecast, render, or AI-query
paths; record actual occurrences only. Logging must not consume gameplay RNG.

Exploration records include personal moments (all ten), trait gains, room/beacon/
mushroom/lava discoveries, loot/gold, wells, travel choices and their outcomes,
shops, equipment, tunnels, recruitment, deaths and other existing journal events.
Class combinations, unique abilities, criticals, statuses and enemy passives have
explanations. A rare moment records its title, actor and outcome; a trait keeps its
effect and original earned reason rather than whatever the hero has later.

## Saves and a possible future split

`state.logs` remains an array of plain strings, compatible with old saves, tests,
exports and existing tools. `state.logDetails` is its parallel, bounded metadata
array: `{id, text, category, context, label, terms, important}`. Each annotation has UTF-16 offsets,
a text description and a whitelisted presentation kind. Text equality guards
against stale metadata if a legacy tool replaces a log. The renderer escapes all
text/attributes, validates offsets and ignores unknown CSS/category values.

Explanations are snapshotted when logged. They survive reloads and do not change
when a trait is replaced, gear swapped, a character dies or a class levels up.
Legacy strings receive vocabulary annotations on display without requiring a save
version bump. Records use `combat`, `exploration`, `personal`, `trait` or `loot`
categories, plus a separate combat/exploration context for personal moments and
loot; a later split can filter or add views over the same records. No second
log/filter UI exists yet. Loot can come from either combat or exploration.

An unchanged render preserves entry nodes/hover. New records preserve a reader's
scroll position and focused term where possible, falling back to the log if the
old entry ages out. Tooltips never inject saved HTML.

## Local environmental events

`relevantLogTile(i)` requires a revealed tile within Chebyshev distance two of the
party and a clear line of sight. Ordinary stalactite drops and newly blocked
rockfall passages obey this gate. Distant/hidden/occluded ticking does not reveal
terrain or fill the log. A direct rockfall encounter or the Unwritten's death
remains a meaningful expedition event and is recorded. No terrain clocks, damage,
loot or generation probabilities changed.

## Verification

`node --test tests/event-log.test.cjs` exercises real browser events, grouped
nested moments, saved descriptions, legacy strings, injection/whole-name safety,
local ceiling relevance, bounded history, focus/scroll, no logging RNG and
hover/focus geometry in all palettes at 1920, 1280, 390 and 320px. Screenshots go
to ignored `test-results/event-log/`. Run the full suite and `npm run review:ui`
for integration and notebook review.
