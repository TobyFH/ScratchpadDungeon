# Iacta Games startup film

`ui/assets/video/iacta-games-intro.mp4` is the original user-supplied company
intro, unmodified: five seconds, 1920×1080, H.264, no audio track. The user
provided it for this game; no separate licence statement accompanied the upload.
It adds no third-party service or runtime dependency.

## Playback and startup

`ui/company-intro.html`, `.css` and `.js` own this presentation. The builder
embeds the film as a `data:video/mp4` URL into the generated COMPANY FILM region
and the controller into COMPANY STARTUP. The standalone `index.html`, its saved
HTML backup and file:// playback therefore require no video request or server.
Replace the MP4 at the same path and run `npm run build:ui` to update it.

The intro runs once per page load, including when resuming a save. It does not
repeat for New run, a floor change, or utility-page navigation. There is no new
save flag, balance change, sound effect, or gameplay random draw.

The startup callback opens the title menu only after the video has finished
(or been skipped). It validates a saved expedition or creates an unsaved preview;
the player explicitly chooses Continue or New Run. While it is playing, the notebook is hidden and
inert, input is captured, and exploration, environmental updates and both auto
drivers are gated. Backgrounding the tab pauses the video; returning resumes it.

On completion, the last frame fades to black over 320ms. Startup then runs
behind the black layer, which dissolves over 420ms into the pencil title sheet.
Restored confirmations wait for Continue, then retain their callbacks and focus.
See `MAIN_MENU.md` for the menu's independent persistence and input contracts.

The visible Skip intro button, Enter, Space, Escape or any controller button can
skip. A single guarded completion promise prevents repeated input from creating
multiple previews or clicking the newly exposed menu. Reduced-motion users
bypass the cinematic and fades. Unsupported codecs, rejected playback and media
errors continue to the game; a ten-second watchdog also prevents a stalled
player from trapping startup. The original has no sound, so playback is muted
and does not depend on an audio-unlock gesture.

## Verification

`node --test tests/company-intro.test.cjs` exercises real browser decoding,
natural completion, repeated skip input, keyboard/controller skipping,
playback rejection/error/stall, background pause, reduced motion, save restoration, and offline
Deck/phone dimensions. It produces screenshots under
`test-results/company-intro/`. The managed browser blocks file:// navigation;
offline checks load the exact HTML bytes with browser networking disabled.
Other game tests and visual fixtures explicitly
await `CompanyIntro.skip(true)` after navigation; persistence fixtures then
explicitly choose Continue through `tests/helpers/resume-run.cjs`. Skipping only
bypasses cinematic timing, then uses the same real startup callback. It is not a runtime URL flag
or an alternative game initialization path.

Run `npm test`, `npm run check:ui` and `npm run review:ui` before shipping.
Test at least one normal, unskipped intro after replacing the film. Preserve
`object-fit: contain` so other aspect ratios never crop the company mark.
