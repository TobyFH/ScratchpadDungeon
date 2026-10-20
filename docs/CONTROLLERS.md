# Input and controller testing

`src/production/input.js` maps physical inputs to actions. Gameplay receives actions through a narrow bridge; gamepad code does not simulate a second battle loop or alter roll odds. Keyboard/mouse shortcuts remain available. Input prompts switch when a controller button/stick or mouse/keyboard is used. Standard Gamepad API layouts, including Steam Input's emulated standard controller, are supported. Nonstandard raw devices should be configured through Steam Input.

| Default controller input | Action                                                                 |
| ------------------------ | ---------------------------------------------------------------------- |
| Left stick / D-pad       | Move focus; focus a map tile and choose it to travel                   |
| A / Cross                | Choose, use, confirm; cycle a focused dropdown                         |
| B / Circle               | Back, or fast-forward a roll; event rewards still require confirmation |
| X / Square               | Spin selected hero                                                     |
| Y / Triangle             | Open satchel                                                           |
| LB / RB                  | Previous/next hero; previous/next focusable control inside a menu      |
| LT / RT                  | Previous/next enemy target                                             |
| View / Share             | Field guide                                                            |
| Menu / Options           | Pause / resume                                                         |
| Left stick click         | Focus current map tile                                                 |
| Right stick click        | Options                                                                |
| Right stick vertical     | Scroll field notes or the final adventurer roster                      |

Options → Controller exposes radial deadzone, Xbox/Deck/PlayStation/Nintendo prompts and all sixteen button assignments. Assigning an occupied button swaps the two actions, keeping every action reachable. Left/right adjusts focused sliders and dropdowns. Settings persist independently of new runs. Focus is restored when party/map DOM updates, and remains inside active menus. The on-screen keyboard supports text fields if a text-entry interaction is introduced; current gameplay does not require typing.

Pause is available even during a roll or event. It suspends movement/action delays, autoresolve and exploration age. Options and the guide work from pause. Return through Back or Menu. Disconnecting a controller returns prompts to keyboard; reconnect and press a control to resume controller prompts.

## Automated checks

`npm run test:production` uses standard-layout mock Gamepad API devices through the actual polling/action pipeline. It checks startup/class selection, map selection, targeting/spins, inventory, options, deadzones, rebinding, prompt switching, pause and the virtual keyboard. The existing game suite independently verifies combat, event decisions, editing, equipment, shops, saves and the complete campaign. View screenshots in `test-results/` after a run.

## Hardware checklist

Test with keyboard/mouse unplugged, using both a standard controller and a Steam Deck in Gaming Mode:

- Start cold, choose each class, load a save, start a new run, and cancel the new-run menu.
- Focus a covered tile, choose a long destination, redirect movement, and revisit optional events.
- Spin different heroes repeatedly, change enemy/healing targets, skip an active reel and critical, and handle deaths/revive/burial/end-of-run decisions.
- Use, discard and replace bag items; equip class gear; edit every reel column; buy shop stock; choose/reject/replace recruits; swap artefacts; descend.
- Navigate all options, change/revert bindings, adjust volume, read the guide, pause during a roll and resume. Confirm focus remains visible after each transition.
- Disconnect/reconnect, test stick drift/deadzone and held-stick repeat. Check glyphs against the actual device's physical layout.
- Confirm notes and final-roster scrolling, and virtual text entry if a future field requires it.

Mock input cannot verify physical layouts, Steam Input routing, overlay interception or device firmware. Record those results before release.
