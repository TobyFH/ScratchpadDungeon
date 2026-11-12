// Functional UI copy and saved previews only; no gameplay randomness.
const ROOM_FLAVOUR = Object.freeze({
  combat: [
    "Steel rings against stone.",
    "Shadows leap as weapons are raised.",
    "The party closes ranks around the torch.",
  ],
  empty: [
    "Dust lifts beneath your boots.",
    "The passage is quiet for a moment.",
    "A faint draught cools the stone.",
    "Your footsteps carry through the cave.",
    "Small stones shift underfoot.",
    "Torchlight reaches into empty alcoves.",
  ],
  well: [
    "Cool water gathers in a stone basin.",
    "Clear drops ripple across the pool.",
    "The air is cooler beside the fountain.",
  ],
  wellSpent: [
    "Only a few drops remain in the basin.",
    "The dry fountain smells of wet stone.",
    "An empty basin rests beneath the wall.",
  ],
  treasure: [
    "A metal clasp catches the torchlight.",
    "Dust gathers around a locked chest.",
    "A few bright coins show through a broken seam.",
  ],
  treasureSpent: [
    "An open chest rests against the wall.",
    "The empty coffer creaks in the draught.",
    "Only dust remains beneath the open lid.",
  ],
  shop: [
    "A lamp burns over the merchant’s counter.",
    "Bottles and bundles crowd a little stall.",
    "The merchant checks a carefully packed satchel.",
  ],
  stairs: [
    "Heavy footsteps echo from the stairwell.",
    "Cold air rises past the guarded steps.",
    "A broad shadow waits at the head of the stairs.",
  ],
  stairsClear: [
    "A cold draught climbs the unguarded stairs.",
    "The steps lead down beyond the light.",
    "The passage below is quiet.",
  ],
  beacon: [
    "A pale glow surrounds the carved stone.",
    "The beacon hums softly in the dark.",
    "Light spills from a narrow stone lantern.",
  ],
  beaconSpent: [
    "The stone lantern has gone dark.",
    "A little warmth remains in the beacon.",
    "The beacon’s grooves are cold again.",
  ],
  ruin: [
    "Broken pillars surround worn carvings.",
    "Dust settles in the cracks of an old shrine.",
    "The roof has fallen across a ruined arch.",
  ],
  ruinSpent: [
    "Disturbed dust marks the searched ruins.",
    "The broken shrine has nothing left to offer.",
    "Old carvings disappear into the rubble.",
  ],
  trap: [
    "Deep scratches score the flagstones.",
    "A rusty mechanism sits beneath the stone.",
    "Fine wires glint close to the floor.",
  ],
  trapSpent: [
    "The sprung mechanism lies still.",
    "Bent spikes protrude from a broken plate.",
    "The passage bears the marks of an old trap.",
  ],
  recruit: [
    "Fresh footprints cross the dust.",
    "Someone has sheltered beside the wall.",
    "A small campfire has only just gone out.",
  ],
  recruitSpent: [
    "Another set of tracks leads away.",
    "A few embers remain beside the wall.",
    "An abandoned bedroll lies in the dust.",
  ],
  stronghold: [
    "Thick walls enclose a challenge temple.",
    "An iron gate guards a weathered shrine.",
    "A guardian waits inside the walled temple.",
  ],
  strongholdSpent: [
    "The temple gate stands open and silent.",
    "Broken weapons lie inside the shrine.",
    "Dust settles around the fallen guardian.",
  ],
  tunnel: [
    "Cold air passes through a narrow opening.",
    "The tunnel curves beyond sight.",
    "A faint echo answers from the far end.",
  ],
  bridge: [
    "The boards creak over running water.",
    "Water rushes beneath the bridge.",
    "The handrail is worn smooth by old travellers.",
  ],
  lavaBridge: [
    "Heat rises through gaps in the bridge.",
    "Molten rock flows beneath the planks.",
    "The crossing trembles above the lava.",
  ],
  river: [
    "Water murmurs along the stone channel.",
    "A current pulls through the dark.",
    "Torchlight breaks across running water.",
  ],
  lava: [
    "Heat shimmers over the molten rock.",
    "Embers drift up from the lava.",
    "A low bubbling rises from the orange glow.",
  ],
  crystal: [
    "Blue light gathers inside the quartz.",
    "The crystal gives a soft, clear hum.",
    "A cold glow runs along the crystal’s edges.",
  ],
  brokenCrystal: [
    "Blue fragments crunch beneath your boots.",
    "Shattered quartz lies dark on the floor.",
    "The crystal’s hum has fallen silent.",
  ],
  ice: [
    "Frost sparkles across slick stone.",
    "Your breath clouds in the frozen passage.",
    "Ice creaks somewhere beneath the floor.",
  ],
  brittleIce: [
    "Cracks branch across the thin ice.",
    "The ice groans under the party’s weight.",
    "Dark water shows beneath the brittle crust.",
  ],
  hole: [
    "Broken ice rims a deep, empty hole.",
    "Loose stone falls into the opening.",
    "The hole drops away beyond the light.",
  ],
  mushroom: [
    "Pale caps grow between the stones.",
    "Soft fungal light fills the passage.",
    "Mushroom stalks brush against your boots.",
  ],
  poisonMushroom: [
    "Purple spores cling to the damp stone.",
    "A bitter smell rises from the violet caps.",
    "Purple mushrooms crowd the path.",
  ],
  explodingMushroom: [
    "Red caps swell with trapped spores.",
    "The swollen mushrooms quiver nearby.",
    "A red cap hisses at the edge of the path.",
  ],
  overgrown: [
    "Roots press between the old stones.",
    "Leaves brush the torch as you pass.",
    "Vines hang low across the passage.",
  ],
  mudslide: [
    "Water trickles over sloping mud.",
    "Loose earth shifts along the slope.",
    "A slick trail drops into the dark.",
  ],
  mudwall: [
    "Collapsed mud fills the old passage.",
    "Wet earth presses against broken stone.",
    "The slide has sealed this way shut.",
  ],
  stalactite: [
    "Loose grit falls from the ceiling.",
    "A long crack runs through the hanging stone.",
    "The roof creaks above the party.",
  ],
  corpse: [
    "The party falls quiet beside the dead.",
    "Old weapons lie beside the fallen.",
    "Footsteps slow around the remains.",
  ],
  room: [
    "The passage opens into a low cave.",
    "Each footstep echoes around the chamber.",
    "The ceiling rises beyond the torchlight.",
  ],
  fruit: [
    "Ripe fruit hangs among the roots.",
    "A few bright berries grow beside the path.",
    "Leaves shelter a small patch of fruit.",
  ],
  fairy: [
    "A ring of pale caps glows in the dark.",
    "The air is still inside the mushroom ring.",
    "Tiny lights drift above the fairy ring.",
  ],
  geode: [
    "A split geode glows from within.",
    "Light catches in a hollow crystal shell.",
    "The stone rings softly when touched.",
  ],
  prism: [
    "A thin band of light crosses the stone.",
    "The prism scatters the torchlight.",
    "Coloured reflections reach along the passage.",
  ],
  rubble: [
    "Broken stone is piled against the wall.",
    "Something glints beneath the rubble.",
    "Old debris fills a shallow recess.",
  ],
  shadowDuel: [
    "A second shadow waits across the floor.",
    "Your reflection moves a moment too late.",
    "A dark figure stands perfectly still.",
  ],
  door: [
    "A narrow seam cuts through the wall.",
    "An old doorway has been bricked over.",
    "The mortar is loose around a hidden door.",
  ],
  plate: [
    "A worn plate rests between the stones.",
    "Deep grooves lead away from the pressure plate.",
    "The plate shifts slightly underfoot.",
  ],
  nest: [
    "Feathers and old cloth line a broad nest.",
    "Claw marks surround the nesting hollow.",
    "The nest smells of warm straw and fur.",
  ],
  gate: [
    "A heavy gate blocks the passage.",
    "Iron bars catch the torchlight.",
    "A chain runs from the gate into the wall.",
  ],
  openGate: [
    "The raised gate leaves a clear passage.",
    "Iron bars hang above the open way.",
    "The old gate’s chains have fallen slack.",
  ],
  shadow: [
    "The torchlight seems to stop at the walls.",
    "Long shadows fill the side passages.",
    "A faint whisper carries through the dark.",
  ],
  maze: [
    "Similar passages branch in every direction.",
    "The walls turn sharply beyond the light.",
    "Old corridors double back on themselves.",
  ],
  unstable: [
    "Fine dust falls from the cracked ceiling.",
    "A deep creak travels through the rock.",
    "Loose stones rattle beneath the party’s feet.",
  ],
});
function roomFlavour() {
  const c = state.map[state.position];
  let key = state.enemy ? "combat" : c.event || c.feature;
  if (!c.event && c.feature && ROOM_FLAVOUR[c.feature + "Spent"])
    key = c.feature + "Spent";
  if (key === "stairs" && state.floorBossDefeated) key = "stairsClear";
  if (!key || !ROOM_FLAVOUR[key])
    key = c.corpses?.length
      ? "corpse"
      : c.lavaRiver && c.terrain === "bridge"
        ? "lavaBridge"
        : ROOM_FLAVOUR[c.terrain]
          ? c.terrain
          : c.room
            ? "room"
            : floorBiome();
  if (!ROOM_FLAVOUR[key]) key = "empty";
  const bank = ROOM_FLAVOUR[key],
    variant =
      (c.doodle || 0) + state.depth + Math.floor((c.lastVisitedStep || 0) / 3);
  return bank[Math.abs(variant) % bank.length];
}
const FUTURE_OPTIONS = Object.freeze([
  {
    id: "video",
    name: "Display & language",
    fields: [
      {
        key: "resolution",
        label: "Resolution",
        default: "auto",
        choices: [
          ["auto", "Fit window"],
          ["1920x1080", "1920 × 1080"],
          ["1280x800", "1280 × 800"],
          ["1280x720", "1280 × 720"],
        ],
      },
      {
        key: "language",
        label: "Language",
        default: "en",
        choices: [
          ["en", "English"],
          ["fr", "Français"],
          ["de", "Deutsch"],
          ["es", "Español"],
          ["ja", "日本語"],
        ],
      },
      {
        key: "displayMode",
        label: "Display mode",
        default: "windowed",
        choices: [
          ["windowed", "Windowed"],
          ["borderless", "Borderless"],
          ["fullscreen", "Fullscreen"],
        ],
      },
      {
        key: "quality",
        label: "Graphics quality",
        default: "standard",
        choices: [
          ["low", "Low"],
          ["standard", "Standard"],
          ["high", "High"],
        ],
      },
      {
        key: "frameLimit",
        label: "Frame limit",
        default: "60",
        choices: [
          ["30", "30 FPS"],
          ["60", "60 FPS"],
          ["120", "120 FPS"],
          ["unlimited", "Unlimited"],
        ],
      },
      {
        key: "vSync",
        label: "V-sync",
        default: true,
        choices: null,
      },
    ],
  },
  {
    id: "controls",
    name: "Controls",
    fields: [
      {
        key: "controllerGlyphs",
        label: "Controller prompts",
        default: "auto",
        choices: [
          ["auto", "Automatic"],
          ["xbox", "Xbox"],
          ["playstation", "PlayStation"],
          ["nintendo", "Nintendo"],
        ],
      },
      {
        key: "buttonLayout",
        label: "Controller layout",
        default: "standard",
        choices: [
          ["standard", "Standard"],
          ["southpaw", "Southpaw"],
          ["custom", "Custom bindings"],
        ],
      },
      {
        key: "keyboardLayout",
        label: "Keyboard bindings",
        default: "wasd",
        choices: [
          ["wasd", "WASD"],
          ["arrows", "Arrow keys"],
          ["custom", "Custom bindings"],
        ],
      },
      {
        key: "controllerDeadzone",
        label: "Stick deadzone",
        default: "15",
        choices: [
          ["10", "10%"],
          ["15", "15%"],
          ["20", "20%"],
          ["25", "25%"],
        ],
      },
      {
        key: "controllerVibration",
        label: "Controller vibration",
        default: true,
        choices: null,
      },
      {
        key: "pauseUnfocused",
        label: "Pause when unfocused",
        default: true,
        choices: null,
      },
    ],
  },
  {
    id: "access",
    name: "Accessibility & saves",
    fields: [
      {
        key: "textScale",
        label: "Text size",
        default: "100",
        choices: [
          ["100", "100%"],
          ["115", "115%"],
          ["130", "130%"],
        ],
      },
      {
        key: "colourAssist",
        label: "Colour assistance",
        default: "none",
        choices: [
          ["none", "None"],
          ["protan", "Protanopia"],
          ["deutan", "Deuteranopia"],
          ["tritan", "Tritanopia"],
        ],
      },
      {
        key: "numberStyle",
        label: "Damage numbers",
        default: "standard",
        choices: [
          ["standard", "Standard"],
          ["large", "Large"],
          ["compact", "Compact"],
        ],
      },
      {
        key: "saveSlot",
        label: "Save slot",
        default: "1",
        choices: [
          ["1", "Slot 1"],
          ["2", "Slot 2"],
          ["3", "Slot 3"],
        ],
      },
      {
        key: "cloudSaves",
        label: "Cloud saves",
        default: true,
        choices: null,
      },
      {
        key: "holdConfirm",
        label: "Hold to confirm purchases",
        default: false,
        choices: null,
      },
    ],
  },
]);
const FUTURE_OPTION_DEFAULTS = Object.freeze(
  Object.fromEntries(
    FUTURE_OPTIONS.flatMap((g) => g.fields.map((f) => [f.key, f.default])),
  ),
);
let futureOptionsGroup = "video";
function normaliseFuturePreferences(out, input) {
  for (const field of FUTURE_OPTIONS.flatMap((g) => g.fields)) {
    const v = input[field.key];
    if (
      field.choices
        ? field.choices.some(([key]) => key === v)
        : typeof v === "boolean"
    )
      out[field.key] = v;
  }
}
function futureOptionsMarkup(p) {
  const group =
    FUTURE_OPTIONS.find((g) => g.id === futureOptionsGroup) ||
    FUTURE_OPTIONS[0];
  return `<p class="settings-note">Coming later: these choices are saved previews. They do not change the game yet.</p><label class="future-group-picker">Category<select id="future-group">${FUTURE_OPTIONS.map((g) => `<option value="${g.id}" ${g.id === group.id ? "selected" : ""}>${g.name}</option>`).join("")}</select></label><div class="settings-grid future-settings">${group.fields.map((f) => (f.choices ? `<label>${f.label}<select id="setting-${f.key}" data-setting="${f.key}">${f.choices.map(([key, label]) => `<option value="${key}" ${p[f.key] === key ? "selected" : ""}>${label}</option>`).join("")}</select></label>` : `<label class="setting-check"><input type="checkbox" id="setting-${f.key}" data-setting="${f.key}" ${p[f.key] ? "checked" : ""}><span>${f.label}</span></label>`)).join("")}</div>`;
}
