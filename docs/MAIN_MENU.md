# Pencil title sheet

The Iacta film fades to black, then reveals the main menu. The title sheet uses
the supplied menu reference: cream paper, a double pencil frame, two-line
scratch lettering, diamond rules, a prominent Continue button and a cave sketch.
It is separate from the fitted two-page gameplay notebook.

## Sources and reusable pieces

- `ui/main-menu.html`: semantic title and navigation, decorative border SVG.
- `ui/main-menu.css`: responsive grid, existing paper/ink/font tokens, shared
  `.title-button` treatment, stable hitboxes and hover/focus/pressed feedback.
- `ui/main-menu.js`: startup/navigation lifecycle. It owns no balance rules.
- `ui/assets/menu-cave.svg`: original static mountain/cave/pine pencil drawing.
- `ui/assets/menu-paper.svg`: subtle static paper grain; no runtime animation.
- `ui/assets/menu-button.svg`: two irregular pencil outlines for button borders.

`npm run build:ui` embeds all sources and drawings in `index.html`. The menu,
fonts, video and game still work in the single offline HTML. Do not hand-edit
generated regions. Drawings and hover effects never use gameplay randomness.

## Continue and persistence

`CompanyIntro.run(MainMenu.boot)` is the sole ordinary startup path. Loading
validates/migrates the existing save but does not resume interactions. Continue
is shown only when loading succeeds and the expedition is neither finished nor
waiting for its first character choice. Missing, corrupt and unsupported saves
do not offer Continue.

A fresh title uses an unsaved preview state to supply existing Options, Field
Guide, Bestiary and class/camp pages. `save()` keeps settings in their separate
storage record while the menu is visible; it never writes a preview over an
existing expedition. Queued reel purchases, travel, autoplay, autofight, stun
recovery and active exploration clocks remain suspended until Continue or a
confirmed new class choice. A pending death, item or opening encounter is
restored only by Continue. Settings changed at title override older preferences
inside the expedition on the next reload.

New Run opens the existing class chooser, including its camp upgrade tab. Back
or Escape returns to the title without replacing the current save. Selecting a
class calls the existing `newRun`, leaves the title and saves the new expedition.
Reset progress retains options and returns to a fresh title with no Continue.
Title music also remains selected while title utility pages are open.

## Input and layout contracts

The gameplay notebook and its footer are inert behind the title. Title buttons
support mouse, Tab/Shift-Tab, Enter, arrows and the existing keyboard controller
rehearsal. Utility pages retain their focus trap and restore the initiating menu
button. Animation changes only the label inside a button, never its hitbox.
Reduced motion keeps contrast/focus feedback while removing movement.

Four secondary buttons form a row on desktop and a two-by-two grid on narrow
screens. The frame, heading and cave scale within the viewport; hiding Continue
also removes its reserved row. Main-menu utility dialogs use the viewport's
available height without reserving the hidden gameplay footer. Existing in-run
fitting and dialog dimensions remain unchanged.

## Validation

`node --test tests/main-menu.test.cjs tests/company-intro.test.cjs` covers real
film playback/fallbacks, fresh/resumed/finished/corrupt saves, settings isolation,
automation suspension, pending death confirmations, class selection, reset,
focus/hover, reduced motion and offline startup. Layout captures include
1920×1080, 1671×941, 1280×800, 390×844, 320×700 and 844×390.

Existing persistence fixtures use `tests/helpers/resume-run.cjs` to explicitly
choose Continue. Menu and intro tests intentionally do not use that helper.
`npm run review:ui` includes the title followed by the existing game/dialog
captures. Inspect screenshots as well as checking geometry assertions.
