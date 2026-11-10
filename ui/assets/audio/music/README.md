# Uploaded music recordings

These eight recordings were supplied by the user for Scratchpad Dungeon.
No separate author credit or licence statement accompanied them. Do not label
them public domain, royalty free, or assign a third-party licence without evidence.

Original WAVs are retained, unchanged, under `source/`. The adjacent MP3s are
distribution copies encoded with FFmpeg/libmp3lame, quality 3, without source
metadata. Only MP3 bytes are embedded in `index.html`: no runtime fetching,
network, paid service, or external decoder is required.

| Stable ID | Original / distribution stem | Use |
| --- | --- | --- |
| `title` | `TitleMusic` | Starting character menu and camp upgrades |
| `peaceful` | `PeacefulCave` | Overgrowth exploration |
| `chill` | `ChillCave` | Cavern and Frozen cave exploration |
| `mysterious` | `MysteriousCave` | Mushroom and Crystal cave exploration |
| `ominous` | `OminiousCave` | Labyrinth, Shaky, Shadow and Lava exploration |
| `battle` | `BattleMusic_01` | All battles, including bosses and ambushes |
| `victory` | `VictoryJingle` | Floor guardian victory / final victory, once |
| `failure` | `FailureJingle` | Party defeat, once |

`OminiousCave` intentionally retains the uploaded filename. Runtime IDs use
`ominous`. Full tracks loop; jingles never loop. Music and jingles share the Music
slider and master/mute controls. Unrelated SFX, cries and ambience are unchanged.

Replace a WAV, then encode its corresponding MP3 (requires local FFmpeg):

```sh
ffmpeg -v error -y -i ui/assets/audio/music/source/TitleMusic.wav \
  -codec:a libmp3lame -q:a 3 -map_metadata -1 \
  ui/assets/audio/music/TitleMusic.mp3
npm run build:ui
```

Repeat for any changed recording. Do not commit an MP3 without its matching
replacement WAV and updated attribution here. `ui/recorded-music.js` owns IDs,
biome assignments and mix trims. Read `docs/RECORDED_MUSIC.md` before changing
playback, fades, suspension or fallback.
