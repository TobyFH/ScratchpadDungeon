# The Living Sketchbook sound system

The active SFX direction is pencil, paper, book and small physical mechanisms.
There are **32 offline PCM mixes mapped to 45 stable game cues**. Quiet movement
is deliberately much softer than combat; criticals add a layered scrape, paper
flicks and a low impact. Music and recognisable species/class cries retain their
existing identities. No gameplay balance, roll probabilities or animation timing
is changed by audio.

## Sources and permissions

All newly downloaded recordings come from Kenney's **CC0 1.0** collections:

| Collection | Original page | Pinned distribution inspected |
| --- | --- | --- |
| Interface Sounds | <https://kenney.nl/assets/interface-sounds> | [Calinou's distribution](https://github.com/Calinou/kenney-interface-sounds/tree/4596a49eaf5a533948d49a47467f606bcdea70ff) |
| RPG Audio | <https://kenney.nl/assets/rpg-audio> | [Boyquotes' distribution](https://github.com/Boyquotes/kenney-rpg-audio-for-godot/tree/22eb79bb843bbcadcaa6ed119353a33265ffad11) |
| Impact Sounds | <https://kenney.nl/assets/impact-sounds> | [Boyquotes' distribution](https://github.com/Boyquotes/kenney-impact-sounds-for-godot/tree/999dd1684873f8b020a3aa5b26e713da21688924) |

The mirrors' licence files were inspected and copied under `audio/licenses/`.
`audio/manifest.json` records each pinned upstream path, source URL, SHA-256,
collection, licence evidence and local file. CC0 permits commercial use,
adaptation and redistribution without mandatory attribution; Kenney is credited
here and in the embedded `SFX_CREDITS` regardless. No paid service or account was
used. Several original websites were inaccessible from the execution environment;
these accessible pinned distributions supplied both files and licence evidence.

The five original uploaded WAVs remain **byte-for-byte unchanged** in
`ui/assets/audio/`. The erase mix includes a trimmed, mixed portion of the
user-provided eraser recording. No public licence was supplied for those uploads:
**do not describe them, or the erase derivative, as CC0**. Their authorised use
is this game; see `audio/licenses/USER_RECORDINGS.txt`. The four unused uploads
are explicitly catalogued as archives, rather than mistaken for active assets.

New mixes are modifications: layers are cropped, pitched, filtered, levelled and
faded. Some impacts include a small original generated sine thump. Recipes name
these additions explicitly; they are not presented as third-party recordings.

## Source of truth and file ownership

- `audio/manifest.json`: source provenance, archive status, recipes, output hashes,
  cue-to-sample mapping, gain trims, cooldowns, playback rate and priority.
- `ui/assets/audio/sources/`: selected unmodified downloaded originals.
- `ui/assets/audio/living-sketchbook/`: checked-in, mono 24 kHz/16-bit WAV mixes.
- `tools/build-sfx.py`: deterministic offline rendering from the recipes.
- `tools/audio-bank.cjs`: catalogue, licence/hash, reference, WAV level/format,
  missing-file and unused-file validation. Both CLI and UI builder use it.
  Recipe fingerprints include source hashes and DSP parameters, so a changed
  layer cannot silently leave an older waveform in the distributable.
- `ui/audio-samples.js`: catalogue template. `tools/build-ui.cjs` fills its
  generated definitions, embedding each active WAV **once** into `index.html`.
- `ui/audio-engine.js`: decoding, sample selection, volume buses, voice pool,
  synthesis fallback, creature calls and score scheduling.
- `ui/music.js`: existing exploration/battle score data and arrangement.
- `ui/reward-audio.js` / the base `SOUND_CUES` in `index.html`: deliberately simple
  synthesis fallbacks if a recording cannot be decoded. They do not override a
  decoded catalogue cue.

Never edit generated HTML data URIs. The distributable makes no network request
for fonts, sounds, credits or music and still works as a single offline HTML.

## Cue families

| Events | Materials and presentation |
| --- | --- |
| `erase`, `step`, `click` | Eraser/graphite texture, very quiet short strokes, dry pencil-tip clicks |
| `lever`, `tick`, `lock`, `lockBig` | Belt mechanism, short dry teeth, book/paper clacks; a heavier large-reel landing |
| `hit`, `shield`, `heal`, `death` | Padded book impacts, dense interception, fresh-page/plucked repair, soft final thud |
| `encounter`, `pursuer`, `poof` | Unfolding/creaking pages and cloth-paper bursts |
| `critical`, typed critical cues, `executeFull` | A layered scratch and impact, followed by the relevant material accent |
| `coin`, `reward`, `itemFind`, `victory` | Restrained coin handling, warm plucks and paper flicks; no continuous coin-rush loop |
| Jester, stun, slide, rockfall, tunnel cues | Small spring-like mechanisms, snapping scratches, dragging paper, low impacts and page-fold swishes |
| `bookOpen`, `pageTurn` | Notebook opening and alternative full page turns |

Exact mappings and mix trims are in the manifest, rather than duplicated here.
Existing reveal, smoke, partial reel turn and final-lock hooks keep their timing.
Skip omits intermediate ticks but retains the landing. Suppressing critical roll
visuals retains the critical result cue. Revisited tiles do not play erasing.

## Playback rules

The first click/key interaction unlocks Web Audio. Each unique mix decodes once;
failed assets report once via the console and `GameSound.stats.sampleErrors`.
A failed variant can use a decoded sibling, otherwise its existing synthetic cue
plays immediately. Past sounds are never queued to play late after decoding.

Movement, hit, tick and page-turn alternatives cycle deterministically, separately
per cue, only after successful playback. Audio never uses gameplay `Math.random()`.
Every sample shares master/SFX sliders, mute and hidden-tab suspension. Music and
ambience retain separate buses. All sources share the twenty-voice pool; important
criticals/arrivals and creature cries can replace a lower-priority voice. Source,
gain and filter nodes are disconnected on completion or eviction.

`GameSound.stats.samplePlays` counts logical cues; `sampleAssets` counts actual
mixed files; `lastSample` identifies the last cue and variation. `samplesReady`
counts **unique mixes**, not cue aliases or archived originals.

## Replacing and regenerating

1. Obtain an appropriately licensed source and save its untouched bytes under
   `ui/assets/audio/sources/`. Add its collection/source entry and retain the
   licence/evidence. Review a new source's rights before entering a new hash.
   The current validator accepts CC0 and the existing user-authorised uploads;
   review and explicitly support any different licence before importing it.
2. Edit/add its mix recipe and cue mappings in `audio/manifest.json`. Do not
   silently overwrite the original user uploads.
3. For waveform edits, install **Python 3 and ffmpeg**, then run
   `npm run build:sfx`. This renders WAVs, updates their metadata/hashes and embeds
   the result. FFmpeg is a development dependency only; it is not needed to play
   the game or perform normal UI builds with the checked-in WAVs.
4. For mapping/gain/cooldown-only edits, run `npm run build:ui`; no rendering is
   necessary. Normal Node builds/checks require no audio Python packages.
5. Run `npm run check:audio`, focused audio tests and the full browser suite.
   Unlisted files, unused mixes/sources, changed licence evidence, stale renders,
   missing references, silent/clipping mixes and unexpected formats fail builds.
6. Run `npm run review:sfx` and listen to the generated offline audition page and
   short WAV montage under `test-results/living-sketchbook/`. Check quiet travel,
   slow and skipped reels, a paired fight, healing, a critical, a reward and mute.
   Numeric signal tests cannot certify subjective sound quality.

The audition sheet embeds its own font licences and exact game recordings. Its
volume and Stop controls affect both individual cues and the montage. It has no
external runtime requests and does not edit game saves.
