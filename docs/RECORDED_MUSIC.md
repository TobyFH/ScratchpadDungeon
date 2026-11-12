# Recorded score, clear guide and quartz zones

The user's eight uploaded recordings replace normal synthesised music playback.
The five previous uploaded SFX, synthesised creature cries and ambience remain.
There are no new gameplay rules, balance changes or save migrations.

## Music ownership and assets

`ui/recorded-music.js` owns `MUSIC_RECORDINGS`, `BIOME_MUSIC`, `musicSelection()`
and `createRecordedMusic()`. The builder replaces `@asset(...)` references with
embedded MP3 data URLs in the new RECORDED MUSIC region. `index.html` stays one
offline playable/downloadable file. Original user WAVs and replacement steps are
in [`ui/assets/audio/music/README.md`](../ui/assets/audio/music/README.md).

The scene selector uses Title for starting-character selection and camp upgrades,
Battle for every active fight, and the assigned exploration recording otherwise.
Overgrowth uses Peaceful; Cavern/Frozen use Chill; Mushroom/Crystal use Mysterious;
Labyrinth/Shaky/Shadow/Lava use Ominous. Utility sheets retain the underlying
scene. Ordinary dungeon shops retain the floor's music. Floors of the same biome
still fade and restart: the selection key includes run ID and floor number.

Two native looping media decks feed separate per-track gains into one background
duck gain, then the existing Music bus, master and limiter. They are independent
of the bounded SFX voice pool. Reuse those two decks; never create a new permanent
media element on each render or decode all long recordings into AudioBuffers.
Only scene/floor changes schedule fades. `MUSIC_FADES` centralizes durations,
increased by 20% in the notebook polish pass. The previous deck fades out over .54s,
and the next fades up over .78s when actual decoded playback starts (.42s for the
first track). Rapid changes cancel obsolete retirement timers and playback work.

`GameSound.stinger('victory'|'failure')` uses a single separate, non-looping media
voice connected directly to the Music bus. The background continues underneath,
ducking to 14% over .078s and returning over .36s when the jingle finishes or fails.
This also ducks a floor/battle transition occurring during the jingle. Repeated
outcome calls are bounded and deduplicated by run/floor/outcome. No ordinary
enemy kill plays the floor jingle. Floor ten uses the same victory jingle once.

The Music slider and master mute affect both score and jingles, but the SFX slider
does not. Audio begins after browser user activation. Hidden tabs pause native
media and the AudioContext; resume continues their positions. A recording error
is reported once, and the existing deterministic `ui/music.js` score is used for
that failed looping track. Unsupported music never prevents gameplay. Diagnostics
are available via `GameSound.music.status` and `GameSound.stats.musicTrack`.
The old `musicNotes`/`musicParts` counters now measure **fallback synthesis only**.
Neither native playback nor fallback calls gameplay RNG.

## Motion settings

New/default preferences use 150% for Shake magnitude and Character motion (the
previous slider maximum). Both now range from 0% to 300%; brightness keeps its
50–150% range. Existing explicitly saved values are preserved, including zero.
Reset options adopts the new defaults. Finite class gestures share the larger
range instead of silently capping at the old maximum. Existing reduced-motion,
fast-forward, zero-motion and stable map geometry contracts remain in force.

## Reading and map presentation

`ui/field-guide.js` retains six illustrated, stationary-navigation pages and old
topic aliases. The copy explains actions, consequences and broad class roles in
plain language, rather than depending on unexplained ability names or metaphors.
The longest page reserves the reading area, so changing topics never moves the
navigation. Detailed live numbers still belong in the existing tooltips/workshop.

`renderCrystalPulses()` keeps its existing call/cache hook, but now paints a single
**union** of the affected cells around revealed crystals. It uses the same radius,
wall occlusion and distance rules as before. The blue fill never disappears or
expands, overlapping crystals never darken it, and only exterior edges get an
outline. The gentle fill-opacity animation respects Animated terrain, utility
pause and reduced-motion. The old `.quartz-pulse` class remains a compatibility
hook; the new `.quartz-zone` and `.quartz-boundary` describe their actual roles.
No tile is revealed, affected twice, moved or made traversable by the drawing.

The shared desktop lower row is now 270 source pixels and its map-description
reservation 66, owned by `--ui-bottom-panels-height`/`--ui-map-caption-height` in
`ui/notebook.css`. Both notebook pages still align. Dungeon progress copy is
larger, gold has stronger type, and the artefact row is separated below it.
Compact map descriptions also move up slightly. There are no new scroll areas.

## Verification

`tests/recorded-music.test.cjs` exercises real decoding/signal output for all six
looping recordings, both actual jingles and duck recovery, scene selection,
same-biome floor fades, bounded pools during rapid changes, mute/volume,
suspension, failed-media fallback, persistent motion settings, quartz union and
occlusion, and all six guide pages at 1920, 1280, 390 and 320px. Captures and
measurements go to `test-results/recorded-music/`.

Existing SFX, battle audio, layout, map-cache and full browser suites also apply.
Run `npm run build:ui`, `npm test` and `npm run review:ui`; inspect desktop and
compact captures, including long tile descriptions and long artefact names.

Direct `file://` navigation is blocked by this environment's managed-browser
policy. The exact standalone bytes are also exercised with browser networking
disabled and no audio requests, in addition to the existing saved-HTML tests.
