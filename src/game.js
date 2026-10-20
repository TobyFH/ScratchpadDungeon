const BALANCE = Production.balance.data;
const balanceValue = Production.balance.value;

("use strict");
// One file. No runtime dependencies or network requests.
const HTML_BACKUP = "<!doctype html>\n" + document.documentElement.outerHTML;
const $ = (s) => document.querySelector(s),
  SAVE_KEY = "scratchpad-dungeon-v8",
  W = BALANCE.engine.mapWidth,
  H = BALANCE.engine.mapHeight;
const paths = Production.assets.iconPaths();
function icon(name) {
  return Production.assets.render("icon." + name, null, () =>
    builtinIcon(name),
  );
}
function builtinIcon(name) {
  return `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.sword}"/></svg>`;
}

let artSerial = 0;

function specialEnemyArt(kind, entity) {
  const body = {
    gnawer:
      "M20 131q-21-24 10-49l17-23-4-28 12-17 9 23 19 6 17 35-8 38-29 15z M28 91 8 93l-5 18 20 9M51 49 71 30l19 8-2 33 M50 67l10 7m14-9 9 7M57 91l9 9 14-11M60 96v15m10-14v11M47 28V9h12v19M47 8l6-7 6 7 M39 128l-8 13h25m20-13 6 13h19 M21 125l-9 4m80-12 14-5",
    bellkeeper:
      "M23 138 30 86l15-17-8-35 20-20 28 12 5 39 12 26 2 47z M39 38 77 24l9 35-12 19-24-4z M40 46l42-9m-38 16 40-9 M51 61l13 8 13-10 M31 89l25 18 34-26M56 107v31 M19 66 8 110l22 8 13-38z M12 109l16 7M17 118v11 M81 83l16-15 10 7-11 16 M102 40v35M90 51h24l-4-19-8-6-8 7z M98 53v8",
    widow:
      "M46 90C-5 82 16 36 48 52c-14-50 51-52 45-10 39 11 25 58-8 54l-20 17z M40 63l20-13 24 13-2 25-21 15-22-14z M47 68l9 7m12-2 9-8 M47 80l12 8 17-9M53 84l3 13m12-14-2 15 M35 84 9 90l-6 39m30-32-12 21 6 21M85 82l27 7 5 40m-27-31 10 21-5 21 M44 44l-9-20M83 40l15-20M35 119l26-14 27 14-26 23z",
    oracle:
      "M23 140 29 101l16-24-12-39 25-28 30 14 7 39-17 18 23 29 8 30z M36 41 58 22l28 13-9 35-20 14-14-15z M45 48q16-21 33 0-16 20-33 0z M61 41v16 M53 69h15 M45 84l16 18 15-18M61 103v36 M30 110l-14-8-7 9 23 15m62-13 17-17 8 9-19 23 M2 88h29m-14-14v28M90 14l8-11 13 4M20 60l-8-5 4-12",
    pageeater:
      "M11 137 17 86l-5-24 17-37 33-17 36 19 13 38-8 24 9 48z M21 64l23-26 37-3 22 31-14 26-55-2z M32 62l19 7 30-3 14-9-10 32-25 12-24-12z M35 65l7 15 7-9 10 18 10-17 9 11 12-20 M36 101l12-13 13 20 14-18 13 12M47 26l9 6m18-7-8 8 M23 110l-17 6 2 18 22-4m64-18 19 3 4 20-22-6M36 139l7-18m35 20-5-22",
    pursuer:
      "M13 143 23 110 16 86l20-34 1-24 25-25 27 24-3 29 18 27-7 26 12 35-24-12-21 14-19-12z M37 29l23-11 21 11-7 37-15 15-15-14z M45 45l10 3m12-3 9-3M53 62l14-1 M38 80 59 98l22-19M59 99v33 M25 88l-20 13 10 25 22-12m52-26 24 12-8 26-16-12 M17 142l-10 5m99-5 10 5",
  }[kind];
  if (!body) return null;
  return `<svg class="horror-art species-${kind}" viewBox="0 0 120 150" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${body}" fill="#d7ccb1"/><path d="m27 95 12-10m-12 17 10-9m-11 19 15-12m40 18 12-12m-10 20 12-13m-43 6 6-5" stroke-width=".8" opacity=".5"/></svg>`;
}

function portraitArt(kind, entity = { hp: 1, maxHp: 1 }) {
  return Production.assets.render(
    (entity.hp <= 0 || entity.dead ? "corpse." : "portrait.") + kind,
    { entity },
    () => builtinPortraitArt(kind, entity),
  );
}
function builtinPortraitArt(kind, entity = { hp: 1, maxHp: 1 }) {
  let art =
    entity.hp > 0 && !entity.dead
      ? specialEnemyArt(kind, entity) ||
        basePortraitArt(kind === "mage" ? "healer" : kind, entity)
      : corpseArt(kind);
  if (kind === "mage" && entity.hp > 0 && !entity.dead)
    art = art.replace(
      "</svg>",
      '<g fill="#dfd4b9" stroke="currentColor" stroke-width="1.6"><path d="m27 36 31-35 37 35zM24 36h75M82 140l20-84m-5-4 6-10 7 9-7 9z"/><path d="m58 12-3 8 8-2-6 7 1-9" fill="none"/></g></svg>',
    );
  if (entity.hp <= 0 || entity.dead || entity.hp / entity.maxHp >= 0.7)
    return art;
  const severe = entity.hp / entity.maxHp < 0.35;
  const marks = `<g class="injury-marks" stroke="#ae493c" stroke-width="${severe ? 3.8 : 2.4}" fill="none" opacity=".95"><path d="m40 35 14 12m-15-7 12 12m19 2 12 5m-13 0 10 4"/>${severe ? '<path d="m34 94 17 13m-17-6 17 13m24-42-3 13m5-10-2 12M45 126l13 3"/><path d="m39 58 16 5" stroke="#f1e5c3" stroke-width="8"/><path d="m40 57 14 7m-9-6-1 5" stroke="#796248" stroke-width="1.2"/>' : ""}</g>`;
  return art.replace("</svg>", marks + "</svg>");
}
function basePortraitArt(kind, entity = { hp: 1, maxHp: 1 }) {
  if (entity.hp <= 0 || entity.dead) return corpseArt(kind);
  if (["revenant", "demon", "lich", "abomination"].includes(kind))
    return horrorArt(kind, entity);
  const id = "hatch-" + artSerial++,
    health = entity.hp / entity.maxHp,
    hurt = health < 0.35,
    bruised = health < 0.7,
    dead = health <= 0;
  const hatch = `url(#${id})`,
    fill = "#dfd5bd",
    paper = "#ece3cd";
  const eyes = dead
    ? '<path d="m47 46 7 6m0-6-7 6m19-6 7 6m0-6-7 6"/>'
    : hurt
      ? '<path d="m47 49 8-1m11 1 8 1M50 48v2m19-1v2"/>'
      : '<path d="m47 46 8 2m11 0 8-2M51 49v2m18-2v2"/>';
  const mouth = dead
    ? "M56 67h11"
    : hurt
      ? "M54 65q7-7 14 0v4H54z"
      : bruised
        ? "m54 66 6-3 8 3"
        : "M56 64q6 3 12-1";
  const face = `<path d="M42 34q18-15 38 0l-2 29-17 15-17-15z" fill="${paper}"/>${eyes}<path d="m60 50-3 9h7M${hurt ? "45 57l10 2m16-3-4 4" : "45 56l6 2m21-2-4 2"} M${mouth.slice(1)}"/>${bruised ? '<path d="m46 55 7 5m-7-2 5 4m22-8-4 9" stroke="#8c4b39"/>' : ""}${hurt ? '<path d="m74 61-3 10m4-8-1 10" stroke="#894733" stroke-width="2"/>' : ""}`;
  let body = "";
  if (kind === "fighter" || kind === "hero")
    body = `<path d="M22 139 27 95l18-15h31l20 15 8 44z" fill="${hatch}"/><path d="m25 101 18-10 17 12 19-12 19 10-8 28-29 13-28-13z" fill="${fill}"/><path d="m30 105 30 13 33-13m-31 13-1 23M38 95l4 18m39-18-3 19M32 119l7 3m44 0 8-4M42 129l10 5m17 1 9-5"/>${face}<path d="M35 49V33C35 1 87 1 87 33v18l-9 25H45z" fill="${hatch}"/><path d="M39 32c3-29 39-29 43 0l4 22-23 8-25-8z" fill="${fill}"/><path d="M40 34h43l1 16-22 6-23-6z" fill="${paper}"/><path d="m43 39 14 2m7 0 14-2M46 40v6m5-5v5m18-5v5m5-6v6M61 15v20m0 1v19M45 56l1 15 16 11 15-11 3-16M50 58v11m6-9v13m12-13v13m6-15v11 M40 28l4-8m35 8-4-9M27 97l11 4m46 0 11-5"/>${hurt ? '<path d="m43 35 10 9m-11-5 11 9m21-14-5 10" stroke="#914936"/>' : ""}${dead ? '<path d="m46 39 8 7m0-7-8 7m23-7 7 7m0-7-7 7"/>' : ""}<circle cx="61" cy="108" r="4"/><path d="M17 140h91"/>`;
  else if (kind === "healer" || kind === "rogue")
    body = `<path d="M17 140 26 92l16-14-8-36C28 2 83-12 94 33L84 80l17 18 10 42z" fill="${hatch}"/><path d="M33 80C7 24 73-26 93 29l-10 46-11 13 24 49H25l25-50z" fill="${fill}"/><path d="M40 44C44 8 76 8 82 43l-7 18H45z" fill="${paper}"/>${face}<path d="M36 43q21-8 31-23 9 10 16 23M42 37l-6 40 18 14 5-11m23-43 3 42-16 14-5-13M43 81l-16 55m46-48 24 49M34 110l15-14m36 17-12-17 M29 127l12-9m51 9-13-10"/><path d="m53 91 9-9 9 9-8 12z" fill="${paper}"/><circle cx="62" cy="91" r="3"/>${kind === "healer" ? '<path d="M56 20h10m-5-5v11M53 112h17m-9-8v20" stroke-width="2"/>' : '<path d="m33 122 4-14 13 14-13 10z M75 110l10 17m-7-18 12 12M46 50l11 3m9 0 9-3"/>'}<path d="M17 141h95"/>`;
  else if (kind === "skull" || kind === "skeleton")
    body = `<path d="M25 143h75M51 53l-11 18-12 8-6-8m49-18 11 15 11 7 M54 88l-8 22 5 20-10 11m24-53 10 20-1 24 9 9 M50 109l-5 20m28-18 6 20"/><path d="M45 58h29v29l-14 8-15-9z" fill="${paper}"/><path d="M60 58v35m-14-26 13 4 14-4m-28 7 14 5 14-5m-28 7 14 5 14-5M44 88l15 7 17-7"/><path d="M43 39C25 0 91-1 77 38l-7 12H51z" fill="${fill}"/><path d="M46 24q3-8 10-2l-1 9-9 1zm20-2q9-7 10 3l-3 6h-7z" fill="#4d4637"/><path d="m60 31-3 6h6M52 42h17m-13-3v10m6-9v10m5-9v8M43 15l5-7m29 7-4-6"/>${bruised ? '<path d="m41 12 12 5-5 8m29-9-7 4 4 5M50 73l8 6"/>' : ""}${hurt ? '<path d="m71 33 10 4m-32 6-8 5M67 56l8 10" stroke="#8b5840"/>' : ""}<path d="m22 77-17-49 5-5 18 51M16 74l16-6m-7 9 3 9" fill="${paper}"/><path d="m88 70 20 7-2 32-16 12-14-20 1-24z" fill="${hatch}"/><path d="m89 76 13 5-2 24-10 9-9-15 1-19z M90 79v30m-7-15 18 1"/><circle cx="91" cy="94" r="5" fill="${paper}"/>`;
  else if (kind === "mimic")
    body = `<path d="M15 112 20 65h82l6 49-22 24H34z" fill="${hatch}"/><path d="m20 65 10-34 61-3 11 37-39 31z" fill="${fill}"/><path d="m22 62 39 18 38-18-3 39-32 19-37-16z" fill="#463b32"/><path d="m27 68 9 20 7-11 10 21 10-16 10 14 9-21 10 8 7-19M31 103l9-16 8 23 12-16 12 17 12-22 8 13" fill="${paper}"/><path d="M47 44l9 5m13-2 10-6M48 47v8m25-8v8M29 117l-9 17 24-3m40-11 21 16-26-2M19 60h83"/><path d="m61 35-2 32h11l-2-33z" fill="${paper}"/>`;
  else if (kind === "rat")
    body = `<path d="M27 127C-5 139 1 96 24 109M26 123C12 119 12 83 36 68l39-9 28 30-7 30-31 14z" fill="${hatch}"/><path d="M43 73C5 42 24 13 50 48l-1 23m26-10C75 15 108 19 105 56l-14 21" fill="${fill}"/><path d="M42 66C24 45 28 31 43 51m41 8c0-24 17-25 12-4"/><path d="m38 77 36-12 24 22 13 10-12 15-30 4-30-13z" fill="${paper}"/><path d="m50 82 7-4 3 7m20-8 7 5-3 5" fill="#4c4332"/><path d="m98 96 10 2-8 6z M64 99l11 6 15-4m-18 5 2 12 5-1 1-11 M31 113l-6 14 20 2m35-9 5 14h17 M32 91l-14-5m18 13-20 1m71-11 19-7m-17 17 23 6M24 111l5-6m8 14 7-7m17 13 4-6"/>${hurt ? '<path d="m42 80 11 9m-11-5 10 9m28 19 8 8" stroke="#8d4c38"/>' : ""}`;
  else if (kind === "ghost")
    body = `<path d="M18 136C30 99 8 98 31 59 10 0 99-9 94 52l-7 29 18 49-19-9-10 23-16-14-13 16-9-17z" fill="${hatch}"/><path d="M36 57C16 7 94 0 88 49L76 91l12 30-23-10-9 18-10-14-17 7 12-29z" fill="${paper}"/><path d="M45 41q10-13 13 0l-1 21-11-6zm24-2q14-10 12 4l-4 15-10 5z" fill="#514937"/><path d="M55 74q14-14 16 2v18l-14-2z M37 29l9-8m28-3 7 8 M32 93l-6 15m18-1-3 8m35-19 8 10M36 57 17 77l9 8m59-25 21 19-11 9"/>${hurt ? '<path d="m46 33 8 10m14 22 12 7m-32 35 8 5" stroke="#8d4c38"/>' : ""}`;
  else
    body = `<path d="M12 128C-2 116 20 105 26 82c-4-51 51-69 60-15 0 20 41 35 23 60-21 13-79 12-97 1z" fill="${hatch}"/><path d="M23 120c-8-11 20-27 18-42-8-39 32-40 32-7 0 29 36 31 23 50-18 8-55 9-73-1z" fill="${fill}"/><path d="m44 79 9 4-9 6zm27 0-9 4 9 6z" fill="#564a35"/><path d="M49 101q13 ${hurt ? "-7" : "10"} 23-1 M32 108l-4 6m60-7 4 6M46 62l3-5m11 59 8 2M11 139l7-2m78-2 10 2"/>`;
  return `<svg viewBox="0 0 120 150" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><defs><pattern id="${id}" width="5" height="5" patternUnits="userSpaceOnUse"><rect width="5" height="5" fill="${fill}"/><path d="m-1 5 6-6m-1 7 3-3" stroke="#72664e" stroke-width=".65" opacity=".55"/></pattern></defs>${body}${bruised ? `<path d="${kind === "fighter" || kind === "hero" ? "m40 24 10 9m-9-4 10 10m24 11-8 7" : kind === "skull" || kind === "skeleton" ? "m39 17 10 7m21 15 8 5" : kind === "rat" ? "m38 77 10 6m35 25-8 7" : kind === "ghost" ? "m38 34 10 8m24 25-6 8" : "m34 77 10 8m39 26-9 7"}" stroke="#945740" stroke-width="1.5"/>` : ""}${hurt ? '<path d="m38 34 8 2m-8 2 8 2m20 11 11 4m-12 0 11 4" stroke="#8c4b39"/><path d="m72 59-2 10m3-5-1 8" stroke="#854736" stroke-width="2"/>' : ""}${dead ? `<g stroke="${paper}" stroke-width="2"><path d="${kind === "skull" || kind === "skeleton" ? "m48 23 7 6m0-6-7 6m19-6 7 6m0-6-7 6" : kind === "rat" || kind === "slime" ? "m47 80 7 6m0-6-7 6m16-6 7 6m0-6-7 6" : "m47 41 7 6m0-6-7 6m14-6 7 6m0-6-7 6"}"/></g>` : ""}</svg>`;
}
function floorArt(c, i) {
  if (c.wall || c.terrain === "bridge") return builtinFloorArt(c, i);
  return Production.assets.render(
    "floor." + (c.doodle ?? i % 5),
    { cell: c },
    () => builtinFloorArt(c, i),
  );
}
function builtinFloorArt(c, i) {
  if (c.terrain === "bridge") return icon("bridge");
  if (c.wall) return icon(c.terrain === "river" ? c.terrain : "wall");
  const variants = [
    paths.floor,
    "M4 26h24M8 25l-2-9m4 9 3-14m4 14 6-9M5 17l-3-4m12 0 3-4",
    "M6 24c-6-10 7-15 10-4 9-9 15 5 7 6z M11 25v4m9-4v4",
    "M3 24l9-4 4 3 12-7M16 23l2 5m-8-7-4-6m21 2 1-6",
    "M8 18c-7-9 7-15 9-4 12-5 15 10 4 10H9z M10 25l-4 4m15-4 4 3",
  ];
  let p = variants[c.doodle ?? i % variants.length];
  return `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" aria-hidden="true"><path d="${p}" opacity=".55"/></svg>`;
}
function symbolMarkup(s) {
  if (s.type === "class")
    return `<span class="class-face" title="${classAbilityDescription(s.job || "fighter")}">${icon({ fighter: "rage", healer: "blessing", rogue: "flurry", mage: "magic" }[s.job] || "class")}<small>${classAbilityName(s.job || "fighter")}</small></span>`;
  if (s.type === "blank")
    return `<span class="blank-face" aria-label="Empty reel face" title="Empty face · replace it with personal points">${icon("blank")}<small>EMPTY</small></span>`;
  if (s.type === "multiplier")
    return `<span class="multiplier-value">×${s.value}</span>`;
  let type = ICONS[s.type] || ITEM_DEFS[s.type]?.icon || s.type;
  return `<span class="tier-symbol tier-${s.tier || 1} ${s.type}" title="${s.type} tier ${s.tier || 1}">${Array.from({ length: s.tier || 1 }, () => icon(type)).join("")}</span>`;
}
const TYPES = structuredClone(BALANCE.slots.types),
  ICONS = structuredClone(BALANCE.slots.icons),
  POWER = {
    ...structuredClone(BALANCE.slots.power),
    attack: BALANCE.slots.attackPower[1],
    magic: BALANCE.slots.attackPower[1],
  },
  ATTACK_POWER = structuredClone(BALANCE.slots.attackPower),
  FACE_COST = structuredClone(BALANCE.slots.faceCost);
let state,
  busy = false,
  skip = false,
  animationVersion = 0,
  modalKind = "",
  modalPrevious = null,
  toastTimer,
  currentRoll = null,
  sceneFast = false,
  stagePrevious = null;
const rand = (n) => Math.floor(Math.random() * n),
  pick = (a) => a[rand(a.length)],
  pos = (x, y) => y * W + x;
const escapeHTML = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  );
function makeHero(name, job, origin = null) {
  const maxHp = BALANCE.classes[job].maxHp;
  return {
    id: Date.now() + Math.random(),
    name,
    job,
    level: 1,
    xp: 0,
    hp: maxHp,
    maxHp,
    points: BALANCE.rules.startingPoints,
    equipment: null,
    stun: 0,
    poison: null,
    stimulant: null,
    rage: 0,
    dead: false,
    joinedAt: Date.now(),
    joinedSteps: state?.steps || 0,
    origin: origin || {
      depth: state?.depth || 1,
      tile: state?.position ?? pos(1, 7),
      description: "A wandering adventurer in the dungeon",
    },
    stats: emptyStats(),
    reels: structuredClone(BALANCE.classes[job].reels),
    last: structuredClone(BALANCE.classes[job].last),
  };
}
function neighbors(i, diagonal = false) {
  let x = i % W,
    y = Math.floor(i / W),
    d = diagonal
      ? [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
          [1, 1],
          [1, -1],
          [-1, 1],
          [-1, -1],
        ]
      : [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ];
  return d
    .map(([a, b]) => [x + a, y + b])
    .filter(([a, b]) => a >= 0 && a < W && b >= 0 && b < H)
    .map(([a, b]) => pos(a, b));
}
function generateFloor(
  depth,
  partySize = state?.party.filter(alive).length || 1,
  missedFloors = state?.recruitPity || 0,
) {
  const start = pos(1, balanceValue("generateFloor.start.1")),
    map = Array.from({ length: W * H }, (_, i) => {
      const edge = i % W === 0 || i % W === W - 1 || i < W || i >= W * (H - 1);
      return {
        wall: edge,
        seen: edge,
        visited: false,
        event: null,
        feature: null,
        doodle: rand(5),
        terrain: edge ? "stone" : "floor",
        corpses: [],
        hint: null,
        hintChecked: false,
        lastVisitedStep: null,
        fogged: false,
        fogSince: null,
        room: null,
      };
    });
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++)
      if (
        pos(x, y) !== start &&
        Math.random() < balanceValue("generateFloor.coefficient.1")
      )
        Object.assign(map[pos(x, y)], { wall: true, terrain: "stone" });
  // Most floors are dry. Very occasionally two separate streams cross a floor.
  const riverRoll = Math.random(),
    riverCount =
      riverRoll < balanceValue("generateFloor.riverCount.1")
        ? balanceValue("generateFloor.riverCount.2")
        : riverRoll < balanceValue("generateFloor.riverCount.3")
          ? 1
          : 0;
  for (let stream = 0; stream < riverCount; stream++) {
    const horizontal =
        riverCount === 1 &&
        Math.random() < balanceValue("generateFloor.horizontal.1"),
      low =
        riverCount === balanceValue("generateFloor.low.1")
          ? stream === 0
            ? balanceValue("generateFloor.low.2")
            : balanceValue("generateFloor.low.3")
          : balanceValue("generateFloor.low.4"),
      high =
        riverCount === balanceValue("generateFloor.high.1")
          ? low + 1
          : horizontal
            ? balanceValue("generateFloor.high.2")
            : balanceValue("generateFloor.high.3"),
      river = [];
    let offset = low + rand(high - low + 1);
    const wet = (step, bend) => {
      const i = horizontal ? pos(step, bend) : pos(bend, step);
      if (!river.includes(i)) river.push(i);
      Object.assign(map[i], {
        wall: true,
        terrain: "river",
        riverId: stream + 1,
      });
    };
    const length = horizontal
      ? W - balanceValue("generateFloor.length.1")
      : H - balanceValue("generateFloor.length.2");
    for (let step = 1; step <= length; step++) {
      wet(step, offset);
      if (
        step < length &&
        Math.random() < balanceValue("generateFloor.coefficient.2")
      ) {
        offset = Math.max(
          low,
          Math.min(
            high,
            offset +
              (Math.random() < balanceValue("generateFloor.coefficient.3")
                ? -1
                : 1),
          ),
        );
        wet(step, offset);
      }
    }
    const bridge = pick(river),
      crossing = horizontal ? bridge % W : Math.floor(bridge / W);
    for (const i of river.filter(
      (i) => (horizontal ? i % W : Math.floor(i / W)) === crossing,
    ))
      Object.assign(map[i], { wall: false, terrain: "bridge" });
  }
  Object.assign(map[start], {
    wall: false,
    seen: true,
    visited: true,
    lastVisitedStep: state?.steps || 0,
  });
  // Every discovery is placed afresh, including the rooms nearest camp.
  const place = (i, event) =>
    Object.assign(map[i], {
      wall: false,
      terrain: map[i].terrain === "river" ? "bridge" : map[i].terrain,
      event,
      feature: event,
    });
  let candidates = map
    .map((c, i) => i)
    .filter(
      (i) =>
        !map[i].wall &&
        !map[i].event &&
        i !== start &&
        Math.abs((i % W) - 1) +
          Math.abs(
            Math.floor(i / W) - balanceValue("generateFloor.candidates.1"),
          ) >=
          balanceValue("generateFloor.candidates.2"),
    );
  if (!candidates.length) {
    Object.assign(map[pos(balanceValue("generateFloor.coefficient.4"), 1)], {
      wall: false,
      terrain: "floor",
    });
    candidates = [pos(balanceValue("generateFloor.coefficient.5"), 1)];
  }
  const stair = pick(candidates);
  place(stair, "stairs");
  ensureStairsPath(map);
  const reachable = mapDistances(map);
  map[stair].bossDefeated = false;
  if (Math.random() < balanceValue("generateFloor.coefficient.6")) {
    const centers = [
      pos(
        balanceValue("generateFloor.centers.1"),
        balanceValue("generateFloor.centers.2"),
      ),
      pos(
        balanceValue("generateFloor.centers.3"),
        balanceValue("generateFloor.centers.4"),
      ),
      pos(
        balanceValue("generateFloor.centers.5"),
        balanceValue("generateFloor.centers.6"),
      ),
    ].filter(
      (i) =>
        !map[i].event &&
        i !== stair &&
        !map[i].wall &&
        neighbors(i, true).every(
          (j) =>
            !map[j].event &&
            map[j].terrain !== "river" &&
            map[j].terrain !== "bridge",
        ),
    );
    if (centers.length) {
      const center = pick(centers),
        gate = center + W;
      neighbors(center, true).forEach((i) =>
        Object.assign(map[i], {
          wall: i !== gate,
          terrain: i === gate ? "floor" : "stone",
          structure: true,
        }),
      );
      place(center, "stronghold");
      map[center].structure = true;
      ensureStairsPath(map);
      // The gate itself must connect to the rest of the floor.
      for (
        let y = Math.floor(gate / W);
        y <= balanceValue("generateFloor.coefficient.7");
        y++
      ) {
        let i = pos(gate % W, y);
        if (i !== stair && !map[i].event)
          Object.assign(map[i], {
            wall: false,
            terrain: map[i].terrain === "river" ? "bridge" : "floor",
          });
      }
      ensureStairsPath(map, center);
    }
  }
  let free = [...mapDistances(map).keys()].filter(
      (i) => i !== start && !map[i].event && !map[i].structure,
    ),
    events = Object.entries(BALANCE.world.events).flatMap(([event, count]) =>
      Array(count).fill(event),
    );
  if (Math.random() < recruitChance(partySize, missedFloors, depth))
    events.push("recruit");
  if (Math.random() < balanceValue("generateFloor.coefficient.8"))
    events.push("shop");
  if (Math.random() < balanceValue("generateFloor.coefficient.9"))
    events.push("ruin");
  for (const e of events)
    if (free.length) place(free.splice(rand(free.length), 1)[0], e);
  ensureStairsPath(map);
  const connected = mapDistances(map);
  map.forEach((c, i) => {
    if (!c.wall && !connected.has(i))
      Object.assign(c, {
        wall: true,
        terrain: c.terrain === "bridge" ? "river" : "stone",
      });
  });
  addCaveRooms(map);
  return map;
}

function addCaveRooms(map) {
  const draw = Math.random(),
    desired =
      draw < balanceValue("addCaveRooms.desired.1")
        ? 0
        : draw < balanceValue("addCaveRooms.desired.2")
          ? 1
          : draw < balanceValue("addCaveRooms.desired.3")
            ? balanceValue("addCaveRooms.desired.4")
            : balanceValue("addCaveRooms.desired.5");
  for (let room = 1; room <= desired; room++) {
    const candidates = [];
    for (let y = 1; y < H - balanceValue("addCaveRooms.coefficient.1"); y++)
      for (let x = 1; x < W - balanceValue("addCaveRooms.coefficient.2"); x++) {
        const width =
            balanceValue("addCaveRooms.width.1") +
            (Math.random() < balanceValue("addCaveRooms.width.2") &&
            x < W - balanceValue("addCaveRooms.width.3")
              ? 1
              : 0),
          cells = [];
        for (let dy = 0; dy < balanceValue("addCaveRooms.coefficient.3"); dy++)
          for (let dx = 0; dx < width; dx++) cells.push(pos(x + dx, y + dy));
        if (
          cells.every(
            (i) =>
              !map[i].wall &&
              !map[i].structure &&
              !map[i].room &&
              i !== pos(1, balanceValue("addCaveRooms.coefficient.4")) &&
              !["enemy", "guardian", "stronghold", "trap"].includes(
                map[i].event,
              ),
          )
        )
          candidates.push(cells);
      }
    if (!candidates.length) continue;
    for (const i of pick(candidates)) map[i].room = room;
  }
}
function newRun(job = "fighter") {
  document
    .querySelectorAll(".book-cover,.turning-page")
    .forEach((el) => el.remove());
  fadeDiscoveryHints();
  exploreWasAllowed = false;
  exploreTickAt = performance.now();
  animationVersion++;
  if (stageResolver) {
    stageResolver("cancel");
    stageResolver = null;
  }
  closeSpotlight();
  closeModal();
  busy = false;
  currentRoll = null;
  sceneFast = false;
  travel = null;
  document.querySelectorAll(".speech-bubble").forEach((e) => e.remove());
  state = {
    version: 9,
    depth: 1,
    map: generateFloor(1, 1, 0),
    startedAt: Date.now(),
    exploreTime: 0,
    retired: [],
    pursuer: null,
    autoresolve: state?.autoresolve ?? readSettings().autoresolve ?? false,
    recruitPity: 0,
    recruitFoundThisFloor: false,
    position: pos(1, 7),
    party: [
      makeHero(
        { rogue: "Wren", fighter: "Alden", mage: "Orin", healer: "Mira" }[
          job
        ] || "Alden",
        job,
        {
          depth: 0,
          tile: null,
          description: "At camp, before the expedition",
        },
      ),
    ],
    gold: 0,
    steps: 0,
    block: 0,
    bag: {},
    pendingItems: [],
    potions: 0,
    bombs: 0,
    wards: 0,
    artefacts: [],
    equippedArtefact: null,
    artefactSerial: 0,
    enemy: null,
    enemies: [],
    exitReached: false,
    palette: state?.palette || readSettings().palette || "default",
    target: 0,
    round: 1,
    exitFound: false,
    exitPromptPending: false,
    floorBossDefeated: false,
    battlesWon: 0,
    graveyard: [],
    pendingDeaths: [],
    logs: ["A fresh party opens the notebook. Keep the torch burning."],
    over: false,
    won: false,
    actionSerial: 0,
    awaitingStarter: false,
    lastResult: null,
    speed:
      state?.speed ||
      readSettings().speed ||
      (matchMedia("(prefers-reduced-motion: reduce)").matches ? "skip" : "1"),
  };
  initBag();
  state.party[0].joinedSteps = 0;
  skip = state.speed === "skip";
  render();
  save();
}
function load() {
  try {
    let s = JSON.parse(
      localStorage.getItem(SAVE_KEY) ||
        localStorage.getItem("scratchpad-dungeon-v7") ||
        localStorage.getItem("scratchpad-dungeon-v6") ||
        localStorage.getItem("scratchpad-dungeon-v5") ||
        localStorage.getItem("scratchpad-dungeon-v4") ||
        localStorage.getItem("scratchpad-dungeon-v3") ||
        localStorage.getItem("scratchpad-dungeon-v2") ||
        localStorage.getItem("scratchpad-dungeon-v1"),
    );
    if (
      !s ||
      ![1, 2, 3, 4, 5, 6, 7, 8, 9].includes(s.version) ||
      s.map?.length !== W * H ||
      !Array.isArray(s.party) ||
      !s.party.length ||
      s.party.length > BALANCE.engine.maxSupportedParty ||
      !s.party.every(
        (h) =>
          Number.isFinite(h.hp) &&
          h.reels?.length === 3 &&
          h.reels.every(
            (r) =>
              r.length &&
              r.every(
                (f) =>
                  TYPES.includes(f.type) &&
                  Number.isInteger(f.tier) &&
                  f.tier >= 1 &&
                  f.tier <=
                    (["attack", "magic"].includes(f.type)
                      ? 4
                      : f.type === "class"
                        ? 1
                        : 3),
              ),
          ),
      )
    )
      return false;
    let migrated = s.version < 4,
      rebalance = s.version < 7,
      oldFog = s.version < 8,
      oldRules = s.version < 9;
    state = s;
    state.version = 9;
    state.exploreTime ??= 0;
    state.retired ??= [];
    state.autoresolve ??= readSettings().autoresolve || false;
    if (oldRules) state.pursuer = null;
    state.bombs ??= 0;
    state.wards ??= 0;
    state.potions ??= 0;
    state.round ??= 1;
    state.battlesWon ??= 0;
    state.startedAt ??= Math.min(
      ...state.party.map((h) => h.joinedAt || Date.now()),
    );
    state.recruitPity ??= 0;
    state.recruitFoundThisFloor ??= false;
    state.artefacts ??= [];
    state.equippedArtefact ??= null;
    state.artefactSerial ??= 0;
    state.floorBossDefeated ??= false;
    state.won ??= false;
    state.graveyard ??= [];
    state.pendingDeaths ??= [];
    state.speed = ["1", "2", "3", "5", "skip"].includes(state.speed)
      ? state.speed
      : state.skip
        ? "skip"
        : "1";
    state.exitFound ??= s.map.some((c) => c.seen && c.event === "stairs");
    state.exitPromptPending = false;
    state.exitReached ??= state.map.some(
      (c) => c.event === "stairs" && c.visited,
    );
    state.palette ??= readSettings().palette || "default";
    initBag();
    state.actionSerial ??= 0;
    state.party.forEach((h) => {
      h.stun ??= 0;
      h.poison ??= null;
      h.stimulant ??= null;
      h.rage ??= 0;
      if (oldRules)
        h.reels.forEach((r, k) => {
          h.reels[k] = r.filter((f) => f.type !== "class");
          if (k === 1)
            h.reels[k].push({
              type: "class",
              tier: 1,
              weight: 3,
              job: h.job,
            });
          if (oldFog && ["healer", "mage"].includes(h.job))
            h.reels[k].forEach((f) => {
              if (f.type === "attack") f.type = "magic";
            });
        });
      h.equipment ??= null;
      initLife(h);
    });
    state.map.forEach((c, i) => {
      c.feature ??= c.event;
      c.doodle ??= i % 5;
      c.terrain ??= c.wall ? "stone" : "floor";
      c.corpses ??= [];
      c.hint ??= null;
      c.hintChecked ??= false;
      c.lastVisitedStep ??= c.visited ? state.steps : null;
      if (oldRules) {
        c.fogged = false;
        c.fogSince = state.exploreTime;
      } else c.fogged = !!c.fogged;
      if (c.seen && !c.wall && c.fogSince == null)
        c.fogSince = state.exploreTime || 0;
      c.room ??= null;
      delete c.wanderPending;
      if (c.terrain === "puddle") c.terrain = "stone";
      if (
        migrated &&
        c.event === "guardian" &&
        state.depth !== BALANCE.rules.floors
      ) {
        c.event = "enemy";
        c.feature = "enemy";
      }
    });
    if (state.enemy) {
      if (state.enemies?.length)
        state.enemy =
          state.enemies.find((e) => e.id === state.enemy.id) ||
          state.enemies.find((e) => e.hp > 0) ||
          state.enemies[0];
      else state.enemies = [state.enemy];
      state.enemies.forEach((e, k) => {
        e.id ??= "saved-enemy-" + k;
        e.affixId ??=
          BALANCE.elites.find((a) => a.name === e.affix)?.id || null;
        if (rebalance) {
          const ratio = e.hp / e.maxHp,
            stats = enemyBalance(state.depth, {
              ...e,
              pair: state.enemies.length > 1,
            });
          Object.assign(e, stats, {
            hp: e.hp > 0 ? Math.max(1, Math.ceil(stats.maxHp * ratio)) : 0,
            countdown: Math.max(
              1,
              Math.min(e.countdown || stats.frequency, stats.frequency),
            ),
          });
        }
      });
      state.enemy.reels ??= enemyReels(state.enemy.art);
      state.enemy.last ??= [
        { type: "attack", tier: 1 },
        { type: "block", tier: 1 },
        { type: "blank", tier: 1 },
      ];
      state.enemy.block ??= 0;
      if (state.enemy.countdown < 1)
        state.enemy.countdown = state.enemy.frequency;
      if (migrated && state.depth !== BALANCE.rules.floors)
        state.enemy.boss = false;
    }
    if (migrated) {
      state.block = 0;
      state.logs = ["A new page: companions can no longer return from death."];
      state.lastResult = null;
    }
    delete state.relic;
    delete state.skip;
    skip = state.speed === "skip";
    return true;
  } catch {
    return false;
  }
}
function save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    localStorage.setItem(
      "scratchpad-dungeon-settings",
      JSON.stringify({
        speed: state.speed,
        palette: state.palette,
        autoresolve: state.autoresolve,
      }),
    );
    $("#save-status").textContent = "Notebook saved locally";
  } catch {
    $("#save-status").textContent =
      "Local save unavailable · keep this page open";
  }
}
function log(msg) {
  state.logs.unshift(msg);
  state.logs = state.logs.slice(0, 60);
  renderLog();
}
function renderLog() {
  $("#log").innerHTML = state.logs
    .map((x) => `<li>${escapeHTML(x)}</li>`)
    .join("");
}
function toast(msg) {
  $("#toast").textContent = msg;
  $("#toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("#toast").hidden = true), 3000);
}
async function pause(ms, context = null) {
  await Production.input.waitUnpaused();
  if (skip || context?.fast || sceneFast) return;
  let elapsed = 0,
    last = performance.now(),
    version = animationVersion;
  await new Promise((resolve) => {
    const tick = () => {
      let now = performance.now();
      if (!Production.input.paused) elapsed += (now - last) * pace();
      last = now;
      if (
        skip ||
        context?.fast ||
        sceneFast ||
        version !== animationVersion ||
        elapsed >= ms
      )
        return resolve();
      setTimeout(tick, 12);
    };
    tick();
  });
}
function fastForward() {
  if (currentRoll) currentRoll.fast = true;
  else sceneFast = true;
  if (criticalHoldResolver) {
    const done = criticalHoldResolver;
    criticalHoldResolver = null;
    done();
  }
}
let criticalHoldResolver = null;
async function criticalHold(ms) {
  await new Promise((resolve) => {
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      criticalHoldResolver = null;
      resolve();
    };
    criticalHoldResolver = done;
    Production.input.delay(ms).then(done);
  });
}

function injury(h) {
  return h.hp === 0 || h.dead
    ? "dead"
    : h.hp / h.maxHp < 0.35
      ? "wounded"
      : h.hp / h.maxHp < 0.7
        ? "bruised"
        : "steady";
}
function drawMachine(
  id,
  last,
  {
    hero = null,
    enemy = false,
    title = "",
    one = false,
    disabled = false,
  } = {},
) {
  let active = hero !== null,
    label = active
      ? `Spin ${state.party[hero].name}'s reels`
      : enemy
        ? "Enemy reels"
        : "Fast-forward this slot machine";
  return `<div class="machine-shell ${one ? "one-reel" : ""}" id="machine-${id}" data-machine="${id}">${title ? `<div class="machine-title">${title}</div>` : ""}<button class="machine-face" data-roll-area="${id}" aria-label="${label}" ${disabled ? "disabled" : ""}>${last.map((s, k) => `<span class="slot-window" data-reel="${k}"><span class="symbol-track single"><span class="slot-symbol">${symbolMarkup(s)}</span></span></span>`).join("")}</button><button class="lever" ${active ? `data-spin="${hero}"` : `data-fast-machine="${id}"`} ${disabled ? "disabled" : ""} aria-label="${active ? "Pull " + state.party[hero].name + "’s slot handle" : "Fast-forward " + (enemy ? "enemy" : "event") + " reels"}"><svg viewBox="0 0 35 100" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m6 77 12-1 .5 16-12-1zM14 79l8-58 4-1-6 63z" fill="#b1aa99"/><path d="m7 78 10 1 1 11-11-1m9-14 8-51M8 81l7-3m-8 8 10-5m-9 8 8-4m3-51 6-6m-7 14 6-6m-6 14 5-6m-6 14 6-6m-6 14 4-6m-5 14 5-6" stroke-width=".65" opacity=".7"/><path d="M33 13q1-10-8-11-11 1-10 11 0 11 10 10 9-1 8-10z" fill="#ddd7c8"/><path d="M31 12q-1-8-8-7-8 2-6 10 2 7 9 6 7-2 5-9z" stroke-width=".7"/><path d="m18 12 5-6m-6 11L28 6m-8 14L31 9m-7 12 8-8M5 95l21-1M7 97h17" stroke-width=".8"/></svg></button><div class="machine-footnote">${active ? (state.enemy ? (state.party[hero].stun ? "Pull to shake off stun" : "Pull handle to spin") : "Waiting for an encounter") : enemy ? "The enemy rolls here" : "Click during the roll to land it"}</div></div>`;
}
function render() {
  Production.audio.setScene(state.enemy ? "battle" : "field");
  document.body.dataset.palette = state.palette || "default";
  $("#palette").value = state.palette || "default";
  document.body.classList.toggle("skip-cinematics", skip);
  document.body.style.setProperty("--speed", pace());
  $("#animation-speed").value = state.speed;
  $("#autoresolve").checked = !!state.autoresolve;
  $("#gold").textContent = state.gold;
  $("#steps").textContent = state.steps;
  $("#explored").textContent = state.map.filter(
    (c) => c.seen && !c.wall,
  ).length;
  $("#depth-stat").textContent = state.depth;
  $("#floor-tag").textContent = "Floor " + state.depth + " / 10";
  $("#floor-name").textContent = [
    "The overgrown cellar",
    "The whispering archive",
    "The sunken sanctuary",
    "The bonebound stacks",
    "The iron undercroft",
    "The hollow gallery",
    "The drowned scriptorium",
    "The ash-veiled vault",
    "The forgotten margins",
    "The last page",
  ][Math.min(9, state.depth - 1)];
  $("#floor-dots").innerHTML = Array.from(
    { length: 10 },
    (_, i) => `<i class="${i < state.depth ? "filled" : ""}"></i>`,
  ).join("");
  renderArtefactSlot();
  $("#combat-title").textContent = state.enemy
    ? "Combat!"
    : state.won
      ? "The last word"
      : "Your Party";
  $("#round").textContent = "Round " + state.round;
  renderBlock();
  $("#map-status").innerHTML = state.over
    ? state.won
      ? "All ten floors conquered. The last page is yours."
      : "The expedition ends here. A fresh page awaits."
    : state.enemy
      ? "An enemy blocks the way. Pull any living hero’s handle."
      : busy
        ? "Pencil dust, little footsteps…"
        : "Scratch a neighbouring tile. Click uncovered rooms to retrace a shortest path.<br>The only way to finish is to keep descending.";
  $("#exit-found").hidden = !state.exitFound;
  $("#exit-found").disabled =
    busy || !!state.enemy || state.over || !state.exitReached;
  $("#exit-found").innerHTML =
    icon("stairs") +
    (!state.exitReached
      ? "Stairs marked · reach them first"
      : state.depth === BALANCE.rules.floors
        ? "Final stairway reached"
        : "Stairs reached · descend when you choose");
  renderMap();
  renderParty();
  renderEncounter();
  renderTargets();
  renderInventory();
  syncStatusFX();
  renderLog();
  renderMemorialButton();
  if (state.lastResult) renderResult(state.lastResult, false);
  fitNotebook();
  updateKeyboardBar();
  requestFitUI();
}
function tileName(c) {
  if (!c.seen)
    return c.hint
      ? "Unknown / " + c.hint.text
      : "Unknown / pencil-covered tile";
  if (c.terrain === "bridge" && !c.event) return "River bridge / traversable";
  if (c.wall)
    return c.terrain === "river"
      ? "Underground river / impassable"
      : c.terrain === "puddle"
        ? "Deep puddle / impassable"
        : "Stone wall / impassable";
  if (c.corpses?.length && !c.event)
    return "Remains of " + c.corpses.map((c) => c.name).join(", ");
  let names = {
    ruin: "Ancient ruins",
    stronghold: "Walled stronghold",
    treasure: "Treasure",
    trap: "Trap",
    well: "Healing well",
    beacon: "Beacon",
    recruit: "Wandering adventurer",
    stairs:
      state.floorBossDefeated || c.bossDefeated
        ? "Stairway / descend"
        : "Stairway / guardian awaits",
    enemy: "Enemy",
    guardian: "The Last Redaction",
    shop: "Rare shop",
  };
  let type = c.event || c.feature;
  return names[type]
    ? names[type] + (c.event ? " / active" : " / used")
    : c.room
      ? "Cave room"
      : "Quiet room";
}
function renderMap() {
  const locked = (busy && !travel) || !!state.enemy || state.over;
  $("#map").innerHTML = state.map
    .map((c, i) => {
      const active = c.seen && !!c.event,
        battle =
          active && ["enemy", "guardian", "stronghold"].includes(c.event),
        water = c.wall && c.terrain === "river",
        corpse = c.seen && c.corpses?.length ? c.corpses.at(-1) : null,
        art = !c.seen
          ? ""
          : corpse && !c.event
            ? corpseArt(corpse.kind)
            : c.event || c.feature
              ? icon(
                  ["enemy", "guardian"].includes(c.event || c.feature)
                    ? "skull"
                    : c.event || c.feature,
                )
              : floorArt(c, i);
      return `<button class="tile ${c.seen ? "" : "fog"} ${c.wall && c.seen ? "wall" : ""} ${water && c.seen ? "water-block " + c.terrain : ""} ${c.visited ? "visited" : ""} ${c.feature && !c.event ? "spent" : ""} ${active ? "active-event" : ""} ${battle ? "active-battle" : ""} ${active && c.event === "well" ? "active-well" : ""} ${active && c.event === "stairs" ? "active-stairs" : ""} ${corpse ? "has-corpse" : ""} ${!c.seen && c.hint ? "has-hint" : ""}  ${c.room && c.seen ? "cave-room" : ""} ${Date.now() - (c.roomRevealedAt || 0) < 1200 ? "room-reveal" : ""} ${c.terrain === "bridge" ? "bridge-tile" : ""} ${i === state.position ? "player-cell" : ""} ${travel?.goal === i ? "travel-goal" : ""}" data-tile="${i}" data-state="${!c.seen ? "unknown" : active ? "active" : c.feature ? "used" : "empty"}" aria-label="${escapeHTML(tileName(c))}, column ${(i % W) + 1}, row ${Math.floor(i / W) + 1}" ${locked || (c.seen && c.wall) ? "disabled" : ""}>${art}${c.seen && c.wall ? '<span class="terrain-stop" aria-hidden="true">×</span>' : ""}${active ? `<span class="tile-status" aria-hidden="true">${c.event === "stairs" ? "↓" : "!"}</span>` : c.seen && c.feature ? '<span class="tile-status used" aria-hidden="true">✓</span>' : ""}${!c.seen && c.hint ? `<span class="tile-whisper" title="${escapeHTML(c.hint.text)}" aria-hidden="true">${icon(c.hint.kind)}</span>` : ""}${corpse && c.event ? '<span class="corpse-mark" aria-hidden="true">†</span>' : ""}</button>`;
    })
    .join("");
  let leader = state.party.find(alive) || state.party[0];
  $("#map-player").innerHTML =
    portraitArt(leader?.job || "fighter", leader) +
    '<span class="walk-boots"><i></i><i></i></span>';
  positionPlayer(false);
  renderPursuer();
}

function positionPlayer(animate = true) {
  let cell = $(`[data-tile="${state.position}"]`),
    p = $("#map-player");
  if (!cell) return;
  let rate = moveRate() * (travel?.boost || 1);
  p.style.setProperty("--move-ms", animate ? 180 / rate + "ms" : "0ms");
  p.style.setProperty("--walk-ms", 200 / rate + "ms");
  // Percentage coordinates stay in the board's coordinate system at every CSS zoom.
  p.style.width = 100 / W + "%";
  p.style.height = 100 / H + "%";
  p.style.transform = `translate(${(state.position % W) * 100}%,${Math.floor(state.position / W) * 100}%)`;
}
function renderParty() {
  $("#party").innerHTML =
    state.party
      .map((h, i) => {
        let status = injury(h);
        return `<article data-gear-target="${i}" class="hero ${status} ${state.target === i ? "selected" : ""}" id="hero-${i}"><div class="hero-dossier"><button class="portrait" id="portrait-${i}" data-target="${i}" aria-label="Healing target: ${h.name}" aria-pressed="${state.target === i}" ${busy || !alive(h) ? "disabled" : ""}>${portraitArt(h.job, h)}${statusMarkup(h)}</button><div class="hero-name">${h.name}<small>${className(h.job)} · Lv.${h.level}</small></div>${equipmentMarkup(h, i)}</div><div class="hero-controls"><div class="hero-title-line"><span class="hp-info">HP ${h.hp} / ${h.maxHp}</span><span class="injury ${status}">${h.stun ? "stunned" : status}</span></div>${drawMachine("hero-" + i, h.last, { hero: i, disabled: busy || !state.enemy || !h.hp || state.over })}<div class="bars">${healthMarkup(h)}<div class="healthbar exp" title="Experience"><i style="width:${(h.xp / (h.level * BALANCE.rules.xpPerLevel)) * 100}%"></i></div></div><div class="edit-line"><span>${h.xp}/${h.level * BALANCE.rules.xpPerLevel} EXP</span><button class="edit-button" data-edit="${i}" ${busy || state.over ? "disabled" : ""} aria-label="Edit ${h.name}'s reels">✎ ${h.points} points</button></div></div></article>`;
      })
      .join("") +
    Array.from(
      { length: Math.max(0, BALANCE.rules.maxParty - state.party.length) },
      () =>
        `<div class="empty-slot">${icon("recruit")}<span>A name yet to be written.</span><small>Wanderers are rare. Keep a light for them.</small></div>`,
    ).join("");
}
function renderEncounter() {
  const enemies = battleEnemies(),
    paired = enemies.length > 1;
  $("#encounter").classList.toggle("paired-enemies", paired);
  $("#encounter").innerHTML = enemies.length
    ? `<h3 class="enemy-label">${paired ? "Enemies · click a target" : "Enemy"}</h3><div class="enemy-roster">${enemies.map((e, k) => `<div class="enemy-box ${e.elite ? "elite-enemy" : ""} ${e === state.enemy ? "selected-enemy" : ""} ${e.hp <= 0 ? "enemy-corpse" : ""}" id="${k ? "enemy-2" : "enemy"}" data-enemy-id="${e.id}"><button class="enemy-art" id="${k ? "enemy-art-2" : "enemy-art"}" data-enemy-target="${e.id}" aria-label="Damage target: ${e.name}" aria-pressed="${e === state.enemy}" ${busy || e.hp <= 0 ? "disabled" : ""}>${portraitArt(e.art, e)}${statusMarkup(e)}</button><div class="enemy-info"><h4>${e.name}${e.elite ? (e.boss ? " · BOSS" : " · ELITE") : ""}</h4><span class="enemy-health-label">HP ${e.hp} / ${e.maxHp} · <span class="injury ${injury(e)}">${injury(e)}</span></span>${healthMarkup(e, "enemy-hp")}<span class="enemy-clock">${e.hp <= 0 ? "Slain" : e.stun ? "Stunned · one turn" : "Attacks in " + e.countdown + (e.countdown === 1 ? " spin" : " spins")}</span><p class="enemy-stats">${e.strikes} strike${e.strikes > 1 ? "s" : ""} · base ${e.damage} damage<br>Every ${e.frequency} spins${e.affix ? " · " + e.affix : ""}${e.block ? " · " + e.block + " block" : ""}</p></div>${drawMachine(k ? "enemy-2" : "enemy", e.last, { enemy: true, title: paired ? e.name + " rolls here" : "The enemy prepares its attack…", disabled: true })}</div>`).join("")}</div>`
    : `<h3 class="enemy-label">The margins</h3><div class="peace">${portraitArt("fighter", state.party.find(alive) || state.party[0])}<p>${state.over ? (state.won ? "Ten floors, one very stubborn party. You wrote the ending." : "Every expedition leaves a story. A fresh page is waiting.") : "A moment between monsters.<br>Gather your nerve. The next floor is waiting."}</p></div>`;
}

function renderTargets() {
  $("#targets").innerHTML =
    "<span>Healing / tonic target:</span>" +
    state.party
      .map(
        (h, i) =>
          `<button class="target-button ${state.target === i ? "active" : ""}" data-target="${i}" aria-pressed="${state.target === i}" ${busy || !alive(h) ? "disabled" : ""}>${h.name}${!alive(h) ? " (dead)" : ""}</button>`,
      )
      .join("");
}
function renderInventory() {
  const slots = Object.entries(state.bag || {}).filter(([, n]) => n > 0),
    ids = { potion: "potion", bomb: "bomb", ward: "ward" };
  $(".inventory-items").innerHTML =
    slots
      .map(
        ([type, count]) =>
          `<button id="${ids[type] || "item-" + type}" data-use-item="${type}" draggable="${!!ITEM_DEFS[type].equipment}" data-drag-item="${type}" title="${escapeHTML(ITEM_DEFS[type].description)}" ${busy || !canUseItem(type) ? "disabled" : ""}>${icon(ITEM_DEFS[type].icon)}<span>${ITEM_DEFS[type].name} ×${count}</span><small>${ITEM_DEFS[type].brief}</small></button>`,
      )
      .join("") +
    Array.from(
      { length: Math.max(0, BALANCE.rules.bagTypes - slots.length) },
      () =>
        '<button class="empty-pocket" disabled>' +
        icon("bag") +
        "<span>Empty pocket</span><small>One item type per pocket</small></button>",
    ).join("");
  $("#bag-count").textContent =
    slots.length + " / " + BALANCE.rules.bagTypes + " types";
  $("#manage-bag").disabled = busy || state.over || !slots.length;
}
function renderResult(result, fresh = true) {
  $("#result-ribbon").innerHTML = result;
  $("#result-ribbon").classList.toggle("fresh", false);
  if (fresh) {
    void $("#result-ribbon").offsetWidth;
    $("#result-ribbon").classList.add("fresh");
  }
}
function result(text) {
  state.lastResult = text;
  renderResult(text);
}
function shortestPath(goal, omniscient = false) {
  if (!Number.isInteger(goal) || goal < 0 || goal >= W * H) return null;
  let costs = new Map([[state.position, 0]]),
    came = new Map([[state.position, null]]),
    queue = [state.position],
    closed = new Set();
  while (queue.length) {
    queue.sort((a, b) => costs.get(a) - costs.get(b));
    let n = queue.shift();
    if (closed.has(n)) continue;
    closed.add(n);
    if (n === goal) {
      let path = [];
      while (came.get(n) !== null) {
        path.unshift(n);
        n = came.get(n);
      }
      return path;
    }
    for (let j of neighbors(n)) {
      let c = state.map[j];
      if (
        !(omniscient
          ? !c.wall
          : j === goal
            ? !c.seen || !c.wall
            : c.seen && !c.wall)
      )
        continue;
      let danger =
          !omniscient &&
          j !== goal &&
          c.seen &&
          ["enemy", "guardian", "stronghold", "trap"].includes(c.event)
            ? 1000
            : 0,
        cost = costs.get(n) + 1 + danger;
      if (cost < (costs.get(j) ?? Infinity)) {
        costs.set(j, cost);
        came.set(j, n);
        queue.push(j);
      }
    }
  }
  return null;
}
function markSeen(i) {
  let c = state.map[i];
  const fresh = !c.seen;
  c.seen = true;
  if (fresh) c.fogSince = state.exploreTime || 0;
  if (fresh && c.room) {
    state.map.forEach((other, index) => {
      if (other.room !== c.room || other.seen) return;
      other.seen = true;
      other.fogSince = state.exploreTime || 0;
      other.roomRevealedAt = Date.now();
      if (other.event === "stairs") state.exitFound = true;
      const el = $(`[data-tile="${index}"]`);
      if (el) {
        el.classList.remove("fog");
        el.innerHTML = other.event
          ? icon(
              ["enemy", "guardian"].includes(other.event)
                ? "skull"
                : other.event,
            )
          : floorArt(other, index);
        el.classList.add("room-reveal");
        burst(el, "dust", 6);
      }
    });
    c.roomRevealedAt = Date.now();
    log("The torch opens onto a cave room. Its contents wait untouched.");
  }
  if (c.event === "stairs" && !state.exitFound) {
    state.exitFound = true;
    log("Stairs marked. Reach them before your first descent.");
  }
}

async function revealTile(i) {
  Production.audio.play("sfx.reveal");
  let c = state.map[i];
  if (c.seen) return;
  let cell = $(`[data-tile="${i}"]`);
  cell.classList.add("erasing");
  burst(cell, "dust", 12);
  await pause(205);
  markSeen(i);
  cell.classList.remove("fog", "erasing");
  cell.innerHTML = c.event
    ? icon(c.event === "enemy" || c.event === "guardian" ? "skull" : c.event)
    : floorArt(c, i);
  cell.classList.add("reveal-pulse");
  if (c.wall) cell.classList.add("wall");
  cell.setAttribute(
    "aria-label",
    tileName(c) +
      ", column " +
      ((i % W) + 1) +
      ", row " +
      (Math.floor(i / W) + 1),
  );
  await pause(125);
}
async function move(goal) {
  if (travel) {
    const path = shortestPath(goal);
    if (path === null) {
      toast("That destination has no uncovered route.");
      return;
    }
    travel.goal = goal;
    travel.revision++;
    markTravelGoal(goal);
    travel.boost = distanceBoost(path?.length || 0);
    $("#map-status").textContent =
      "New destination marked. Turning at the next step…";
    return;
  }
  if (
    busy ||
    state.enemy ||
    state.over ||
    !$("#overlay").hidden ||
    !$("#spotlight").hidden
  )
    return;
  if (goal === state.position) {
    let c = state.map[goal];
    if (c.event === "stairs" && state.exitReached) stairs();
    else if (c.event) {
      busy = true;
      render();
      try {
        await resolveTile(c);
      } finally {
        busy = false;
        render();
        save();
      }
    }
    return;
  }
  let route = shortestPath(goal);
  if (!route) {
    toast(
      "Scratch beside an uncovered path. Unknown rooms cannot be shortcuts.",
    );
    return;
  }
  busy = true;
  sceneFast = false;
  travel = { goal, revision: 0, boost: distanceBoost(route.length) };
  render();
  try {
    while (travel && state.position !== travel.goal) {
      let path = shortestPath(travel.goal);
      if (!path?.length) break;
      let i = path[0],
        c = state.map[i],
        fresh = !c.seen,
        revision = travel.revision;
      if (fresh) {
        await revealTile(i);
        renderMap();
      }
      if (revision !== travel.revision) continue;
      if (c.wall) {
        log(
          c.terrain === "river"
            ? "Deep water beneath the pencil. There is no safe crossing here."
            : "Stone beneath the pencil. There is another way through.",
        );
        break;
      }
      refreshStaleMap();
      const staleEntry = isStale(c),
        resolved = !c.event || !!c.activated;
      c.fogged = false;
      c.fogSince = state.exploreTime || 0;
      state.position = i;
      state.steps++;
      c.lastVisitedStep = state.steps;
      $("#map .player-cell")?.classList.remove("player-cell");
      $(`[data-tile="${i}"]`)?.classList.add("player-cell", "visited");
      c.visited = true;
      $("#map-player").classList.add("walking");
      positionPlayer(true);
      await waitMovement(fresh ? 205 : 180, travel.boost);
      $("#map-player").classList.remove("walking");
      refreshStaleMap();
      if (await advancePursuer()) {
        travel = null;
        break;
      }
      if (fresh && !c.event && (await minorTravelEvent(c))) {
        travel = null;
        break;
      }
      if (
        staleEntry &&
        resolved &&
        Math.random() < balanceValue("move.coefficient.1")
      ) {
        travel = null;
        beginEncounter(false, { wandering: true });
        renderMap();
        renderEncounter();
        log("Ambush! Something was waiting in the old passages.");
        smokePoof($(`[data-tile="${i}"]`), true);
        await encounterEntrance();
        break;
      }
      if (!c.event) maybeDiscoveryHint(i);
      if (c.event === "stairs") {
        state.exitFound = true;
        state.exitReached = true;
        c.activated = true;
        if (!state.floorBossDefeated && !c.bossDefeated) {
          state.exitPromptPending = i === travel.goal;
          travel = null;
          beginEncounter(true, { stairBoss: true });
          renderMap();
          renderEncounter();
          await encounterEntrance();
          break;
        }
        if (i !== travel.goal) continue;
      }
      const passOptional =
        !fresh &&
        i !== travel.goal &&
        ["well", "shop", "ruin"].includes(c.event);
      if (c.event && !passOptional) {
        travel = null;
        renderMap();
        let stop = await resolveTile(c);
        maybeDiscoveryHint(i);
        if (stop || state.over) break;
      }
    }
  } finally {
    travel = null;
    busy = false;
    sceneFast = false;
    render();
    save();
    if (state.exitPromptPending && !state.enemy && !state.over) {
      state.exitPromptPending = false;
      stairs();
      save();
    }
  }
}
async function resolveTile(c) {
  let type = c.event;
  if (!type) return false;
  c.feature = type;
  if (!["stairs", "shop", "well", "ruin"].includes(type)) c.event = null;
  if (type === "ruin") {
    await ruinEncounter(c);
    return true;
  }
  if (type === "treasure") {
    if (!c.room && Math.random() < BALANCE.world.mimicChance) {
      beginEncounter(false, { mimic: true, count: 1 });
      renderEncounter();
      log("The chest yawns open. Those are teeth!");
      await encounterEntrance();
      return true;
    }
    await treasureRoll();
    return true;
  }
  if (type === "trap") {
    await trapRoll();
    return true;
  }
  if (type === "well") {
    await wellEncounter(c);
    return true;
  }
  if (type === "beacon") {
    showSpotlight(
      "A rare beacon",
      "A lantern awakens beneath the pencil.",
      `<div class="stage-art">${icon("beacon")}</div><div class="stage-result">Reveal covered cells within one tile,<br>including the diagonals.</div>`,
      "beacon",
    );
    await eventChoice([
      { id: "stage-confirm", label: "Wake the beacon", value: true },
    ]);
    closeSpotlight();
    result(icon("beacon") + " A little light spreads through the paper.");
    shakeBook(2);
    burst($(`[data-tile="${state.position}"]`), "gold", 20);
    let around = beaconTiles(state.position).filter((i) => !state.map[i].seen);
    pulseBeacon();
    for (let ring of [
      around.filter((i) => neighbors(state.position).includes(i)),
      around.filter(
        (i) => !neighbors(state.position).includes(i) && tileDistance(i) <= 1,
      ),
      around.filter((i) => tileDistance(i) > 1),
    ])
      await Promise.all(
        ring.map(async (i, k) => {
          await pause(k * 45);
          await revealTile(i);
        }),
      );
    log(
      `A beacon reveals ${around.length} covered neighbouring tiles, including diagonals.`,
    );
    return true;
  }
  if (type === "recruit") {
    await recruitEncounter();
    return true;
  }
  if (type === "shop") {
    c.activated = true;
    await shopEncounter(c);
    return true;
  }
  if (["enemy", "guardian", "stronghold"].includes(type)) {
    beginEncounter(type === "guardian", { elite: type === "stronghold" });
    renderEncounter();
    $("#combat-title").textContent = "Combat!";
    await encounterEntrance();
    return true;
  }
  if (type === "stairs") {
    state.exitFound = true;
    state.exitReached = true;
    c.activated = true;
    state.exitPromptPending = true;
    if (!state.floorBossDefeated && !c.bossDefeated) {
      beginEncounter(true, { stairBoss: true });
      renderEncounter();
      await encounterEntrance();
    }
    return true;
  }
  return false;
}
function enemyReels(art) {
  return structuredClone(
    BALANCE.reelSets[BALANCE.enemyReelRefs[art] || BALANCE.enemyReelRefs.skull]
      .reels,
  );
}
function enemyBalance(
  depth,
  {
    boss = false,
    elite = false,
    pair = false,
    mimic = false,
    stronghold = false,
  } = {},
) {
  const growth = Math.max(0, depth - balanceValue("enemy.growthStartDepth"));
  return {
    maxHp: boss
      ? Math.ceil(
          balanceValue("enemy.bossHpBase") +
            depth * balanceValue("enemy.bossHpPerDepth") +
            growth * growth * balanceValue("enemy.bossHpQuadratic"),
        )
      : Math.ceil(
          (balanceValue("enemy.hpBase") +
            depth * balanceValue("enemy.hpPerDepth") +
            growth * growth * balanceValue("enemy.hpQuadratic")) *
            (elite ? balanceValue("enemy.eliteHpMultiplier") : 1) *
            (stronghold ? balanceValue("enemy.strongholdHpMultiplier") : 1) *
            (mimic ? balanceValue("enemy.mimicHpMultiplier") : 1) *
            (pair ? balanceValue("enemy.pairHpMultiplier") : 1),
        ),
    damage: boss
      ? balanceValue("enemyBalance.damage.1") +
        Math.floor(depth / balanceValue("enemyBalance.damage.2"))
      : Math.max(
          1,
          Math.floor(
            (balanceValue("enemyBalance.damage.3") +
              Math.floor((depth - 1) / balanceValue("enemyBalance.damage.4")) +
              (elite ? 1 : 0) +
              (stronghold ? 1 : 0)) *
              (pair ? balanceValue("enemyBalance.damage.5") : 1),
          ),
        ),
    frequency: stronghold
      ? balanceValue("enemyBalance.frequency.1")
      : boss
        ? depth >= balanceValue("enemyBalance.frequency.2")
          ? 1
          : balanceValue("enemyBalance.frequency.3")
        : depth < balanceValue("enemyBalance.frequency.4")
          ? balanceValue("enemyBalance.frequency.5")
          : depth < balanceValue("enemyBalance.frequency.6")
            ? balanceValue("enemyBalance.frequency.7")
            : 1,
    strikes:
      (boss && depth >= balanceValue("enemyBalance.strikes.1")) ||
      (stronghold && depth >= balanceValue("enemyBalance.strikes.2"))
        ? balanceValue("enemyBalance.strikes.3")
        : 1,
  };
}
function beginEncounter(boss = false, options = {}) {
  const depth = state.depth,
    stronghold = !!options.elite,
    pools = (
      depth >= balanceValue("beginEncounter.pools.1")
        ? BALANCE.encounterPools.deep
        : depth >= balanceValue("beginEncounter.pools.2")
          ? BALANCE.encounterPools.middle
          : BALANCE.encounterPools.early
    )
      .filter((id) => enemyEligible(id, depth))
      .map(enemyDefinition),
    band = enemyDefinition(
      BALANCE.encounterPools.bands[
        Math.min(
          balanceValue("beginEncounter.band.1"),
          Math.floor((depth - 1) / balanceValue("beginEncounter.band.2")),
        )
      ],
    ),
    count =
      options.count ||
      (!boss &&
      !stronghold &&
      !options.wandering &&
      depth >= balanceValue("beginEncounter.count.1") &&
      Math.random() <
        Math.min(
          balanceValue("beginEncounter.count.2"),
          balanceValue("beginEncounter.count.3") +
            (depth - balanceValue("beginEncounter.count.4")) *
              balanceValue("beginEncounter.count.5"),
        )
        ? balanceValue("beginEncounter.count.6")
        : 1),
    create = (index) => {
      const elite =
          boss ||
          stronghold ||
          Math.random() < balanceValue("beginEncounter.elite.1"),
        affixData = elite ? pick(BALANCE.elites) : null,
        affix = affixData?.name || null,
        b = options.pursuer
          ? enemyDefinition(BALANCE.encounterPools.pursuer)
          : options.mimic
            ? enemyDefinition(BALANCE.encounterPools.mimic)
            : boss
              ? stairBossType(depth)
              : stronghold
                ? enemyDefinition(BALANCE.encounterPools.stronghold)
                : pick([
                    ...pools,
                    ...[band, band].filter((e) =>
                      enemyEligible(e.typeId, depth),
                    ),
                  ]),
        stats = enemyBalance(depth, {
          boss,
          elite,
          stronghold,
          mimic: options.mimic,
          pair: count === balanceValue("beginEncounter.pair.1"),
        }),
        definition = BALANCE.enemies[b.typeId],
        frequency =
          definition.frequencyOverride ||
          Math.max(1, stats.frequency - (affixData?.frequencyReduction || 0));
      stats.maxHp = Math.ceil(stats.maxHp * definition.hpMultiplier);
      stats.damage = Math.max(
        1,
        Math.floor(stats.damage * definition.damageMultiplier),
      );
      stats.strikes = definition.strikesOverride || stats.strikes;
      return {
        ...b,
        ...stats,
        frequency,
        affix,
        affixId: affixData?.id || null,
        stronghold,
        pursuer: !!options.pursuer,
        id: "enemy-" + Date.now() + "-" + index,
        hp: stats.maxHp,
        mimic: !!options.mimic,
        ambush: !!options.wandering,
        countdown: frequency,
        stun: 0,
        block:
          (affixData?.blockBase || 0) + (affixData?.blockPerDepth || 0) * depth,
        boss,
        elite,
        reels: structuredClone(BALANCE.reelSets[definition.reelSet].reels),
        poison: null,
        stimulant: null,
        rage: 0,
        last: [
          { type: "attack", tier: 1 },
          { type: "block", tier: 1 },
          { type: "attack", tier: 2 },
        ],
      };
    };
  clearBattleStatuses();
  state.enemies = Array.from({ length: count }, (_, i) => create(i));
  state.enemy = state.enemies[0];
  state.encounterReward = {
    count,
    boss,
    elite: state.enemies.some((e) => e.elite),
    stronghold,
    stairBoss: !!options.stairBoss,
    ambush: !!options.wandering,
  };
  state.round = 1;
  state.block =
    passive("guard") +
    state.party
      .filter(alive)
      .reduce((n, h) => n + equipmentBonus(h, "guard"), 0);
  log(
    `${state.enemies.map((e) => e.name).join(" and ")} appear. Team block resets for this battle.`,
  );
  renderBlock();
}

async function encounterEntrance() {
  Production.audio.play("sfx.encounter");
  if (innerWidth <= 760)
    $(".right-page").scrollIntoView({
      behavior: "instant",
      block: "start",
    });
  let e = state.enemy;
  showSpotlight(
    battleEnemies()
      .map((foe) => foe.name)
      .join(" & "),
    e.boss
      ? "STAIR GUARDIAN · ELITE · FLOOR " + state.depth
      : e.elite
        ? "ELITE · " + e.affix
        : e.ambush
          ? "AMBUSH!"
          : "An enemy steps out of the margins.",
    `<div class="stage-art ${battleEnemies().length > 1 ? "paired-intro" : ""}" id="entrance-art" data-elite="${e.elite}">${battleEnemies()
      .map((foe) => portraitArt(foe.art, foe))
      .join(
        "",
      )}<div class="scare-lines"></div></div><div class="stage-result">${e.strikes} strike${e.strikes > 1 ? "s" : ""} · attacks every ${e.frequency} spins</div><p class="encounter-quote">“${enemyLine(e, "entrance")}”</p>`,
    "enemy-intro",
  );
  burst($("#entrance-art"), "scary", 36);
  if (e.ambush) {
    smokePoof($("#entrance-art"), true);
    const banner = document.createElement("div");
    banner.className = "ambush-banner";
    banner.textContent = visualPick(["SURPRISE!", "AMBUSH!"]);
    $("#entrance-art").append(banner);
  }
  shakeBook(4);
  await pause(600);
  await eventChoice([
    { id: "stage-confirm", label: "Face " + e.name + " ↗", value: true },
  ]);
  let from = $("#entrance-art")?.getBoundingClientRect(),
    target = $("#enemy-art"),
    to = target?.getBoundingClientRect();
  if (
    !skip &&
    !sceneFast &&
    from &&
    to &&
    to.top < innerHeight &&
    to.bottom > 0
  ) {
    let ghost = document.createElement("div");
    ghost.className = "encounter-ghost";
    ghost.innerHTML = portraitArt(e.art, e);
    Object.assign(ghost.style, {
      left: from.left + "px",
      top: from.top + "px",
      width: from.width + "px",
      height: from.height + "px",
    });
    document.body.append(ghost);
    target.style.visibility = "hidden";
    closeSpotlight();
    let a = animate(
      ghost,
      [
        { transform: "translate(0,0) scale(1)" },
        {
          transform: `translate(${to.left - from.left}px,${to.top - from.top}px) scale(${to.width / from.width},${to.height / from.height})`,
        },
      ],
      {
        duration: 450,
        easing: "cubic-bezier(.4,0,.2,1)",
        fill: "forwards",
      },
    );
    await pause(450);
    a?.cancel();
    ghost.remove();
    target.style.visibility = "";
    burst(target, "dust", 12);
  } else closeSpotlight();
  result(icon("skull") + `${e.name} blocks the way. Choose any living hero.`);
  sayEnemy("entrance");
}
const liveAnimations = new Set();
function animate(el, frames, options = {}) {
  const { juice = false, ...settings } = options;
  if (
    !el ||
    (!juice && (skip || sceneFast)) ||
    (juice && matchMedia("(prefers-reduced-motion: reduce)").matches)
  )
    return null;
  let a = el.animate(frames, {
    ...settings,
    duration:
      (settings.duration || 250) / (juice ? Math.min(pace(), 2) : pace()),
  });
  a.juice = juice;
  liveAnimations.add(a);
  a.finished.catch(() => {}).finally(() => liveAnimations.delete(a));
  return a;
}
async function runMachine(id, reels, { results = null } = {}) {
  let symbols = results || reels.map((r) => ({ ...weightedPick(r) })),
    root = $("#machine-" + id);
  if (!root) return symbols;
  let ctx = { id, fast: false };
  Production.audio.play("sfx.spin-start");
  currentRoll = ctx;
  root.classList.remove("landed", "match");
  root.classList.add("rolling");
  let face = root.querySelector(".machine-face"),
    lever = root.querySelector(".lever");
  face.disabled = false;
  lever.disabled = false;
  lever.classList.remove("pulling");
  void lever.offsetWidth;
  lever.classList.add("pulling");
  root.querySelector(".machine-footnote").textContent =
    "Click the machine to land it now…";
  await Promise.all(
    symbols.map(async (final, k) => {
      let win = root.querySelector(`[data-reel="${k}"]`),
        track = win.querySelector(".symbol-track"),
        previous = weightedPick(reels[k], fxRandom),
        steps = 10 + k * 2;
      win.classList.remove("locked");
      for (let t = 0; t < steps; t++) {
        if (skip || ctx.fast || sceneFast) break;
        Production.audio.play("sfx.reel-tick");
        let next = t === steps - 1 ? final : weightedPick(reels[k], fxRandom);
        let duration = 45 + Math.pow(t / (steps - 1), 2.2) * 420;
        track.classList.remove("single");
        track.innerHTML = `<span class="slot-symbol">${symbolMarkup(previous)}</span><span class="slot-symbol">${symbolMarkup(next)}</span>`;
        let a = animate(
          track,
          [{ transform: "translateY(0)" }, { transform: "translateY(-50%)" }],
          {
            duration,
            easing: t === steps - 1 ? "cubic-bezier(.1,.6,.2,1)" : "linear",
            fill: "forwards",
          },
        );
        await pause(duration, ctx);
        a?.cancel();
        previous = next;
      }
      track.classList.add("single");
      track.innerHTML = `<span class="slot-symbol">${symbolMarkup(final)}</span>`;
      win.classList.add("locked");
      Production.audio.play("sfx.reel-lock");
      burst(win, "paper", k === symbols.length - 1 ? 14 : 5);
      shakeElement(root, 1.2);
      await pause(110, ctx);
    }),
  );
  root.classList.remove("rolling");
  root.classList.add("landed");
  lever.classList.remove("pulling");
  lever.disabled = true;
  root.querySelector(".machine-footnote").textContent = "The ink has spoken.";
  burst(root, "paper", 18);
  shakeBook(1.6);
  await pause(230, ctx);
  if (currentRoll === ctx) currentRoll = null;
  await Production.input.waitUnpaused();
  return symbols;
}
function matchCount(symbols) {
  const seals = symbols.filter((s) => s.type === "class"),
    other = symbols.filter((s) => s.type !== "class");
  if (
    seals.length === 1 &&
    other.length === 2 &&
    !["blank", "miss"].includes(other[0].type) &&
    other[0].type === other[1].type &&
    other[0].tier === other[1].tier
  )
    return 3;
  let counts = {};
  symbols.forEach((s) => {
    if (["miss", "blank"].includes(s.type)) return;
    let key = s.type + ":" + s.tier;
    counts[key] = (counts[key] || 0) + 1;
  });
  return Math.max(1, ...Object.values(counts));
}
async function rollCritical(owner, symbols, enemy = false, options = {}) {
  if (matchCount(symbols) !== BALANCE.engine.criticalMatches) return 1;
  Production.audio.play("sfx.critical");
  const inline = !!options.context && !$("#spotlight").hidden,
    pool = BALANCE.slots.criticalMultipliers.map((value) => ({
      type: "multiplier",
      value,
      tier: 1,
    })),
    rolled = { ...pick(pool) },
    details = (options.details || effectDetails(calculate(symbols))).map(
      (d) => ({ ...d }),
    ),
    final = details.map((d) => ({
      ...d,
      value: Math.ceil(d.value * rolled.value),
    })),
    body =
      drawMachine("critical", [{ type: "multiplier", value: "?", tier: 1 }], {
        one: true,
        title: "Critical multiplier",
      }) +
      '<div class="critical-summary"><div class="stage-result" id="critical-result">Three of a kind!</div><div class="critical-math" id="critical-math"></div></div>';
  state.lastCritical = {
    owner,
    matches: BALANCE.engine.criticalMatches,
    multiplier: rolled.value,
    baseEffects: details,
    finalEffects: final,
    context: options.context || "combat",
  };
  log(`${owner}: triple match! ×${rolled.value} critical.`);
  let region;
  if (inline) {
    region = $("#event-critical");
    if (!region) {
      region = document.createElement("div");
      region.id = "event-critical";
      $("#stage-card .scene-layout").append(region);
    }
    region.className = "event-critical active-critical";
    region.innerHTML =
      '<div class="inline-critical-title">✧ THREE OF A KIND · CRITICAL! ✧</div><div class="inline-critical-body">' +
      body +
      "</div>";
    $("#stage-card").classList.add("celebrating-critical");
  } else {
    showSpotlight(
      enemy ? "Enemy critical!" : "Critical!",
      "Three identical symbols · every mark matters.",
      body,
      "critical",
    );
    region = $("#stage-card");
  }
  await runMachine("critical", [pool], { results: [rolled] });
  $("#critical-result").innerHTML =
    `<strong class="multiplier-value">×${rolled.value}</strong> ${inline ? "Critical locked!" : "to the original roll"}`;
  $("#critical-math").innerHTML = criticalMath(details, rolled.value);
  fitDialogs();
  const skipButton = $("#stage-skip");
  if (skipButton) {
    skipButton.disabled = false;
    skipButton.textContent = inline
      ? "Take the result now ↗"
      : "Strike now ↗";
  }
  const criticalMachine = $("#machine-critical");
  criticalMachine.querySelector(".machine-face").disabled = false;
  criticalMachine.querySelector(".lever").disabled = false;
  burst(
    region,
    options.context ? "confetti" : "gold",
    options.context ? 110 : 55,
  );
  shakeBook(options.context ? 6 : 4);
  shakeElement(region, options.context ? 6 : 4);
  if (options.context === "treasure")
    startCoinRain(
      Math.ceil(
        (details.find((d) => d.icon === "coin")?.value || 12) * rolled.value,
      ),
      true,
    );
  await criticalHold(
    skip ? 950 : pace() >= 5 ? 1150 : pace() >= 2 ? 1400 : 1850,
  );
  if (inline) $("#stage-card").classList.remove("celebrating-critical");
  else closeSpotlight();
  return rolled.value;
}

function calculate(symbols, multiplier = 1) {
  let total = Object.fromEntries(TYPES.map((type) => [type, 0]));
  for (let s of symbols)
    if (TYPES.includes(s.type))
      total[s.type] += ["attack", "magic"].includes(s.type)
        ? ATTACK_POWER[s.tier]
        : POWER[s.type] * s.tier;
  for (let t of TYPES) total[t] = Math.ceil(total[t] * multiplier);
  return total;
}
function syncHero(i) {
  let h = state.party[i],
    root = $("#hero-" + i);
  if (!root) return;
  let status = injury(h);
  root.classList.remove("steady", "bruised", "wounded", "downed");
  root.classList.add(status);
  root.querySelector(".hp-info").textContent = `HP ${h.hp} / ${h.maxHp}`;
  root.querySelector(".injury").textContent = h.stun ? "stunned" : status;
  root.querySelector(".injury").className = "injury " + status;
  root.querySelector(".hp-bar").outerHTML = healthMarkup(h);
  root.querySelector(".portrait").innerHTML =
    portraitArt(h.job, h) + statusMarkup(h);
  syncStatusFX();
}
function syncEnemy(e = null) {
  for (const foe of e ? [e] : battleEnemies()) {
    const k = battleEnemies().indexOf(foe),
      root = $(k ? "#enemy-2" : "#enemy");
    if (!root) continue;
    root.querySelector(".enemy-art").innerHTML =
      portraitArt(foe.art, foe) + statusMarkup(foe);
    root.querySelector(".enemy-health-label").innerHTML =
      `HP ${foe.hp} / ${foe.maxHp} · <span class="injury ${injury(foe)}">${injury(foe)}</span>`;
    root.querySelector(".enemy-hp").outerHTML = healthMarkup(foe, "enemy-hp");
    root.querySelector(".enemy-clock").textContent =
      foe.hp <= 0
        ? "Slain"
        : foe.stun
          ? "Stunned · one turn"
          : "Attacks in " +
            foe.countdown +
            (foe.countdown === 1 ? " spin" : " spins");
    root.classList.toggle("enemy-corpse", foe.hp <= 0);
  }
  renderBlock();
  syncStatusFX();
}

function addXP(h, n) {
  if (!alive(h)) return;
  h.xp += n;
  h.stats ??= emptyStats();
  h.stats.xpEarned += n;
  while (h.xp >= h.level * BALANCE.rules.xpPerLevel) {
    h.xp -= h.level * BALANCE.rules.xpPerLevel;
    h.level++;
    h.stats.levelsGained = (h.stats.levelsGained || 0) + 1;
    levelUpFX(h);
    h.maxHp += BALANCE.rules.levelHp;
    h.hp = Math.min(h.maxHp, h.hp + BALANCE.rules.levelHp);
    h.points += BALANCE.rules.levelPoints;
    log(
      `${h.name} reaches level ${h.level}: +6 maximum HP, +4 personal points.`,
    );
    let i = state.party.indexOf(h);
    floatAt($("#portrait-" + i), "Level " + h.level + "!", true);
    burst($("#portrait-" + i), "gold", 20);
  }
}
function healHero(i, n) {
  let h = state.party[i];
  if (!alive(h)) return 0;
  let actual = Math.min(n, h.maxHp - h.hp);
  h.hp += actual;
  syncHero(i);
  if (actual) {
    Production.audio.play("sfx.heal");
    h.stats ??= emptyStats();
    h.stats.healingReceived += actual;
    healingFX($("#portrait-" + i));
    floatAt($("#portrait-" + i), "+" + actual + " HP", true);
    burst($("#portrait-" + i), "heal", 16);
    if (actual > 4) sayHero(i, "relief");
    log(`${h.name} recovers ${actual} HP.`);
  }
  combatNumber($("#portrait-" + i), actual, "heal");
  return actual;
}
function damageHero(i, n, source, { piercing = false } = {}) {
  let h = state.party[i];
  if (!alive(h)) return 0;
  h.stats ??= emptyStats();
  const resisted = piercing ? 0 : Math.min(n, defenceBonus(h));
  n -= resisted;
  let blocked = piercing ? 0 : Math.min(state.block, n);
  state.block -= blocked;
  let actual = Math.min(h.hp, n - blocked);
  h.hp -= actual;
  Production.audio.play(actual ? "sfx.damage" : "sfx.block");
  h.stats.damageTaken += actual;
  h.stats.damageBlocked += blocked + resisted;
  syncHero(i);
  renderBlock();
  if (blocked) armourFX(blocked, "Damage blocked");
  if ((blocked || resisted) && !actual) shieldedFX($("#portrait-" + i));
  floatAt(
    $("#portrait-" + i),
    actual ? "-" + actual + " HP" : "Team protected",
    false,
    !actual,
  );
  burst($("#portrait-" + i), actual ? "damage" : "shield", 16);
  shakeElement($("#hero-" + i), actual ? 5 : 2);
  shakeBook(actual ? 3 : 1);
  sayHero(i, actual ? (h.hp / h.maxHp < 0.35 ? "panic" : "hurt") : "block");
  log(
    `${source} → ${h.name}: ${actual} damage${blocked ? " (" + blocked + " team armour consumed)" : ""}.`,
  );
  combatNumber($("#portrait-" + i), actual, "attack");
  if (h.hp === 0) recordDeath(h, source);
  return actual;
}
function damageEnemy(n, source, e = state.enemy, { piercing = false } = {}) {
  if (!e || e.hp <= 0) return 0;
  const resisted = piercing ? 0 : Math.min(n, defenceBonus(e));
  n -= resisted;
  const blocked = piercing ? 0 : Math.min(e.block || 0, n),
    actual = Math.min(e.hp, n - blocked);
  e.block -= blocked;
  e.hp -= actual;
  Production.audio.play(actual ? "sfx.damage" : "sfx.block");
  if (e.hp === 0 && !e.corpseRecorded) {
    e.corpseRecorded = true;
    leaveCorpse(e.art, e.name, true);
  }
  syncEnemy(e);
  const art = enemyArtEl(e);
  combatNumber(art, actual, "attack");
  if ((blocked || resisted) && !actual) shieldedFX(art);
  floatAt(art, actual ? "-" + actual + " HP" : "Blocked", false, !actual);
  burst(art, actual ? "damage" : "paper", 22);
  shakeElement(art, 6);
  shakeBook(2.5);
  if (e.hp > 0) {
    const previous = actingEnemy;
    actingEnemy = e;
    sayEnemy("hurt");
    actingEnemy = previous;
  }
  log(
    `${source} strikes ${e.name} for ${actual}${blocked ? " (" + blocked + " blocked)" : ""}.`,
  );
  return actual;
}

function checkDefeat() {
  if (state.party.some(alive)) return false;
  state.over = true;
  state.enemy = null;
  state.enemies = [];
  state.block = 0;
  renderBlock();
  log("The last torch falls. A fresh page is waiting.");
  openModal(
    "The light goes out.",
    runSummaryMarkup() +
      `<div class="modal-actions"><button class="primary" data-restart>Begin a new expedition</button><button data-close>Read the final notes</button></div>`,
    "defeat",
  );
  return true;
}
const classAbilityDescription = (job) =>
  BALANCE.abilities[job]?.description ||
  "A signature ability alongside the other two reels.";
const classAbilityName = (job) => BALANCE.abilities[job]?.name || "CLASS";
const attackBonus = (entity) =>
  (entity.rage || 0) +
  (entity.stimulant
    ? BALANCE.abilities.stimulant.attackBase +
      Math.floor(
        entity.stimulant.power / BALANCE.abilities.stimulant.attackDivisor,
      )
    : 0);
const defenceBonus = (entity) =>
  equipmentBonus(entity, "defence") +
  Math.floor((entity.rage || 0) / BALANCE.abilities.fighter.defenceThreshold) +
  (entity.stimulant
    ? BALANCE.abilities.stimulant.defenceBase +
      Math.floor(
        entity.stimulant.power / BALANCE.abilities.stimulant.defenceDivisor,
      )
    : 0);
function statusMarkup(entity) {
  if (entity.hp <= 0 || entity.dead) return "";
  return `<span class="portrait-conditions">${entity.poison?.turns ? `<b class="poison-badge">${icon("poison")}${entity.poison.turns}</b>` : ""}${entity.rage ? `<b class="rage-badge">${icon("rage")}+${entity.rage}</b>` : ""}${entity.stimulant ? `<b class="buff-badge">${icon("flame")}${entity.stimulant.turns}</b>` : ""}</span>`;
}
function syncStatusFX() {
  state.party.forEach((h, i) => {
    const root = $("#hero-" + i);
    root?.classList.toggle("powered-up", alive(h) && !!h.stimulant);
    root?.classList.toggle("raging", alive(h) && !!h.rage);
    root?.classList.toggle("poisoned", alive(h) && !!h.poison);
  });
  battleEnemies().forEach((e) => {
    const root = enemyArtEl(e)?.closest(".enemy-box");
    root?.classList.toggle("powered-up", e.hp > 0 && !!e.stimulant);
    root?.classList.toggle("poisoned", e.hp > 0 && !!e.poison);
  });
}
function clearBattleStatuses() {
  for (const entity of [...state.party, ...battleEnemies()]) {
    entity.rage = 0;
    entity.stimulant = null;
    entity.poison = null;
  }
  syncStatusFX();
}
function applyStimulant(entity, amount) {
  entity.stimulant = {
    power: Math.min(
      BALANCE.abilities.stimulant.maxPower,
      (entity.stimulant?.power || 0) + Math.ceil(amount),
    ),
    turns:
      BALANCE.abilities.stimulant.baseTurns +
      Math.min(BALANCE.abilities.stimulant.maxExtraTurns, Math.ceil(amount)),
    appliedAt: state.actionSerial,
  };
  syncStatusFX();
  const el = state.party.includes(entity)
    ? $("#portrait-" + state.party.indexOf(entity))
    : enemyArtEl(entity);
  burst(el, "gold", 22);
  actionLabel(el, "POWERED UP!");
}
function applyPoison(entity, amount, source = null) {
  if (entity.hp <= 0 || !amount) return;
  entity.poison = {
    turns: Math.min(
      BALANCE.abilities.poison.maxTurns,
      Math.max(
        entity.poison?.turns || 0,
        BALANCE.abilities.poison.baseTurns + Math.ceil(amount),
      ),
    ),
    damage: BALANCE.abilities.poison.damage,
    sourceId: source?.id || null,
    sourceName: source?.name || "Poison",
    appliedAt: state.actionSerial,
  };
  syncStatusFX();
  const el = state.party.includes(entity)
    ? $("#portrait-" + state.party.indexOf(entity))
    : enemyArtEl(entity);
  burst(el, "poison", 18);
  actionLabel(el, "POISON · " + entity.poison.turns + " turns");
}
async function tickPoison() {
  for (const entity of [...state.party.filter(alive), ...livingEnemies()]) {
    const poison = entity.poison;
    if (!poison || poison.appliedAt >= state.actionSerial) continue;
    poison.turns--;
    const hero = state.party.indexOf(entity),
      source =
        state.party.find((h) => h.id === poison.sourceId) ||
        state.graveyard.find((d) => d.id === poison.sourceId);
    if (hero >= 0)
      damageHero(hero, poison.damage, "Poison from " + poison.sourceName, {
        piercing: true,
      });
    else {
      const n = damageEnemy(
        poison.damage,
        "Poison from " + poison.sourceName,
        entity,
        { piercing: true },
      );
      if (source) {
        source.stats.damageDealt += n;
        if (entity.hp === 0) source.stats.kills++;
        if (source.death) {
          source.death.stats.damageDealt += n;
          if (entity.hp === 0) source.death.stats.kills++;
        }
      }
    }
    if (!poison.turns || entity.hp <= 0) entity.poison = null;
    await pause(100);
  }
  await processDeaths();
  syncStatusFX();
}
function impactFlash(el, index = 0) {
  if (!el) return;
  const r = el.getBoundingClientRect(),
    flash = document.createElement("div");
  flash.className = "critical-impact";
  flash.innerHTML = icon("stun");
  flash.style.left = r.left + r.width * (0.25 + fxRandom() * 0.5) + "px";
  flash.style.top = r.top + r.height * (0.2 + fxRandom() * 0.5) + "px";
  flash.style.rotate = index * 43 + "deg";
  document.body.append(flash);
  setTimeout(() => flash.remove(), 500);
}
async function planHeroRoll(h, symbols) {
  const base = calculate(symbols),
    seals = symbols[1]?.type === "class" ? 1 : 0;
  let flurryHits = [];
  if (seals) {
    if (h.job === "fighter") base.rage = seals;
    if (h.job === "healer") {
      base.teamHeal =
        seals *
        (BALANCE.abilities.healer.healBase +
          Math.ceil(h.level / BALANCE.abilities.healer.healLevelDivisor));
      base.block +=
        seals *
        (BALANCE.abilities.healer.blockBase +
          Math.floor(h.level / BALANCE.abilities.healer.blockLevelDivisor));
    }
    if (h.job === "mage")
      base.magic +=
        seals *
        (BALANCE.abilities.mage.damageBase +
          Math.floor(h.level / BALANCE.abilities.mage.damageLevelDivisor));
    if (h.job === "rogue") {
      const pool = BALANCE.abilities.rogue.reel;
      actionLabel(
        $("#portrait-" + state.party.indexOf(h)),
        "FLURRY · three blades!",
      );
      const flurry = await runMachine("hero-" + state.party.indexOf(h), [
        pool,
        pool,
        pool,
      ]);
      const damage = calculate(flurry).attack;
      const multi =
        matchCount(symbols) === BALANCE.engine.criticalMatches
          ? 1
          : await rollCritical(h.name + "’s flurry", flurry, false, {
              details: [
                { label: "Flurry damage", icon: "sword", value: damage },
              ],
            });
      flurryHits = flurry.map((face) => ATTACK_POWER[face.tier]);
      if (multi > 1) flurryHits.push(Math.ceil(damage * multi) - damage);
      Object.defineProperty(base, "flurryMultiplier", {
        value: multi,
        enumerable: false,
      });
      base.attack += Math.ceil(damage * multi) * seals;
      state.lastFlurry = {
        heroId: h.id,
        symbols: flurry,
        multiplier: multi,
        damage: Math.ceil(damage * multi) * seals,
      };
    }
  }
  if (base.attack) base.attack += passive("attack") + attackBonus(h);
  else if (base.magic) base.magic += passive("attack") + attackBonus(h);
  if (base.attack || base.magic) {
    if (base.attack) base.attack += equipmentBonus(h, "attack");
    else base.magic += equipmentBonus(h, "attack");
    base.magic += equipmentBonus(h, "magic");
    base.poison += equipmentBonus(h, "poison");
  }
  if (base.heal) base.heal += passive("heal") + equipmentBonus(h, "heal");
  base.teamHeal = (base.teamHeal || 0) + equipmentBonus(h, "teamHeal");
  base.block += equipmentBonus(h, "block");
  if (
    equipmentBonus(h, "stunEvery") &&
    h.stats.spins % equipmentBonus(h, "stunEvery") === 0
  )
    base.stun++;
  if (
    equipmentBonus(h, "stimEvery") &&
    h.stats.spins % equipmentBonus(h, "stimEvery") === 0
  )
    base.stimulant += equipmentBonus(h, "stimulantPower");
  if (base.block) base.block += passive("block");
  const regular =
    (base.attack || 0) +
    (base.magic || 0) -
    flurryHits.reduce((n, x) => n + x, 0);
  Object.defineProperty(base, "hitSegments", {
    value: [...(regular > 0 ? [regular] : []), ...flurryHits],
    enumerable: false,
  });
  return base;
}
async function spin(i) {
  const h = state.party[i];
  if (
    busy ||
    !state.enemy ||
    !alive(h) ||
    state.over ||
    !$("#overlay").hidden ||
    !$("#spotlight").hidden
  )
    return;
  busy = true;
  sceneFast = false;
  const selected = state.enemy,
    foes = battleEnemies().slice();
  render();
  try {
    h.stats ??= emptyStats();
    if (h.stun) {
      h.stun = 0;
      h.stunGrace = 1;
      h.stats.turnsMissed++;
      result(
        icon("stun") +
          `${h.name} misses this go · enemy still attacks in ${selected.countdown} spins`,
      );
      log(
        `${h.name} misses one go to stun. Enemy countdown stays at ${selected.countdown}.`,
      );
      actionLabel($("#portrait-" + i), "Stunned · one missed go");
      await feedbackPause(skip ? 180 : 300);
      return;
    }
    h.stunGrace = 0;
    state.actionSerial++;
    h.stats.spins++;
    sayHero(i, "attack");
    actionLabel($("#portrait-" + i), h.name + " rolls!");
    lunge($("#portrait-" + i), false);
    const symbols = await runMachine("hero-" + i, h.reels);
    h.last = symbols;
    const base = await planHeroRoll(h, symbols),
      multiplier = await rollCritical(h.name, symbols, false, {
        details: effectDetails(base),
      }),
      sums = scaleEffects(base, multiplier),
      criticalImpact = multiplier > 1 || base.flurryMultiplier > 1,
      area =
        criticalImpact ||
        symbols.some(
          (s) =>
            ["attack", "magic"].includes(s.type) &&
            s.tier >= BALANCE.rules.areaAttackTier,
        ) ||
        (h.job === "mage" && symbols.some((s) => s.type === "class")),
      targets = area ? foes.filter((e) => e.hp > 0) : [selected],
      parts = [];
    if (
      ["mage", "rogue"].includes(h.job) &&
      symbols.some((s) => s.type === "class")
    )
      parts.push(
        `<span>${icon(h.job === "mage" ? "magic" : "flurry")}${classAbilityName(h.job)}</span>`,
      );
    if (criticalImpact) h.stats.criticals = (h.stats.criticals || 0) + 1;
    state.lastPlayerRoll = {
      actor: i,
      heroId: h.id,
      symbols,
      multiplier,
      base,
      totals: { ...sums },
      flurryMultiplier: base.flurryMultiplier || 1,
      area,
      targets: targets.map((e) => e.id),
    };
    if (sums.rage) {
      h.rage = Math.min(
        BALANCE.abilities.fighter.stackCap,
        (h.rage || 0) + sums.rage,
      );
      parts.push(`<span>${icon("rage")}RAGE · +${h.rage} damage</span>`);
      burst($("#portrait-" + i), "gold", 24);
    }
    if (sums.stimulant) {
      const ally =
        state.party[alive(state.party[state.target]) ? state.target : i];
      applyStimulant(ally, sums.stimulant);
      parts.push(`<span>${icon("flame")}${ally.name} powered up</span>`);
    }
    const damage = (sums.attack || 0) + (sums.magic || 0);
    if (damage) {
      let dealt = 0;
      const segments = base.hitSegments?.length
        ? [...base.hitSegments]
        : [(base.attack || 0) + (base.magic || 0)];
      const bonus = damage - segments.reduce((n, x) => n + x, 0);
      if (bonus > 0) segments.push(bonus);
      state.lastPlayerRoll.hits = [];
      for (let hit = 0; hit < segments.length; hit++) {
        for (const e of targets.filter((e) => e.hp > 0)) {
          const power = segments[hit];
          if (power <= 0) continue;
          beam(
            $("#portrait-" + i),
            enemyArtEl(e),
            sums.magic ? "magic" : "attack",
            {
              critical: criticalImpact,
              lethal: power >= e.hp + (e.block || 0) + defenceBonus(e),
            },
          );
          lunge($("#portrait-" + i), false);
          if (hit === segments.length - 1 && criticalImpact)
            actionLabel(enemyArtEl(e), "CRITICAL · BONUS HIT");
          const n = damageEnemy(
            power,
            h.name + (multiplier > 1 ? " (×" + multiplier + " critical)" : ""),
            e,
          );
          dealt += n;
          h.stats.damageDealt += n;
          if (e.hp === 0) h.stats.kills++;
          state.lastPlayerRoll.hits.push({
            enemyId: e.id,
            power,
            actual: n,
            at: Date.now(),
          });
        }
        if (hit < segments.length - 1)
          await feedbackPause(skip ? 95 : Math.max(100, 190 / pace()));
      }
      state.lastPlayerRoll.actualDamage = dealt;
      parts.push(
        `<span class="damage combat-total">${icon(sums.magic ? "magic" : "sword")} <strong>−${dealt}</strong> HP${area && foes.length > 1 ? " across ALL enemies" : ""}${multiplier > 1 ? " · " + (base.attack && base.magic ? sums.attack + " blade + " + sums.magic + " magic" : (base.attack || 0) + (base.magic || 0) + " × " + multiplier + " = " + damage) : ""}</span>`,
      );
      await pause(380);
    }
    if (sums.poison) {
      for (const e of targets.filter((e) => e.hp > 0))
        applyPoison(e, sums.poison, h);
      parts.push(
        `<span>${icon("poison")}Poison · ${Math.min(BALANCE.abilities.poison.maxTurns, BALANCE.abilities.poison.baseTurns + sums.poison)} turns</span>`,
      );
    }
    if (sums.teamHeal) {
      let total = 0;
      state.party.forEach((ally, k) => {
        if (alive(ally)) {
          total += healHero(k, sums.teamHeal);
          beam($("#portrait-" + i), $("#portrait-" + k), "heal");
        }
      });
      h.stats.healingDone += total;
      parts.push(
        `<span class="healing">${icon("blessing")}SANCTUARY · <strong>+${total} party HP</strong></span>`,
      );
    }
    if (sums.heal) {
      const target = alive(state.party[state.target])
          ? state.target
          : state.party.findIndex(alive),
        n = healHero(target, sums.heal);
      h.stats.healingDone += n;
      state.lastPlayerRoll.actualHealing = n;
      beam($("#portrait-" + i), $("#portrait-" + target), "heal");
      parts.push(
        `<span class="healing">${icon("heal")}<strong>+${n} HP</strong> ${state.party[target].name}</span>`,
      );
      await pause(300);
    }
    if (sums.block) {
      state.block += sums.block;
      renderBlock();
      floatAt($("#block"), "+" + sums.block + " team armour", false, true);
      burst($("#block"), "shield", 18);
      parts.push(`<span>${icon("block")}+${sums.block} team armour</span>`);
    }
    if (sums.stun)
      for (const e of (multiplier > 1 ? foes : [selected]).filter(
        (e) => e.hp > 0,
      ))
        parts.push(`<span>${icon("stun")}${stunEnemy(sums.stun, e)}</span>`);
    result(
      `<span>${h.name}${multiplier > 1 ? " · ×" + multiplier + " critical" : ""}:</span>` +
        (parts.join("") || "<span>Empty reels · no effect</span>"),
    );
    await tickPoison();
    if (
      h.stimulant &&
      h.stimulant.appliedAt < state.actionSerial &&
      --h.stimulant.turns <= 0
    )
      h.stimulant = null;
    if (checkDefeat()) return;
    syncHero(i);
    syncEnemy();
    if (foes.every((e) => e.hp <= 0)) {
      state.lastLethalHitAt = Date.now();
      await feedbackPause(skip ? 650 : 900);
      await victory(selected);
      return;
    }
    if (state.enemy.hp <= 0) state.enemy = foes.find((e) => e.hp > 0);
    await pause(260);
    for (const e of foes.filter((e) => e.hp > 0)) {
      e.countdown--;
      syncEnemy(e);
      if (e.countdown <= 0) {
        if (e.stun) {
          e.stun = 0;
          log(`${e.name} misses its turn to stun.`);
          actionLabel(enemyArtEl(e), "Stunned · turn missed");
          await pause(350);
        } else await enemyTurn(e);
        if (!state.over) {
          e.countdown = e.frequency;
          state.round++;
        }
      }
      if (checkDefeat()) break;
    }
  } finally {
    actingEnemy = null;
    busy = false;
    sceneFast = false;
    render();
    if (skip && !state.over)
      shakeElement(
        $("#machine-hero-" + Math.max(0, state.party.indexOf(h))),
        2,
      );
    save();
  }
}

async function enemyTurn(e) {
  actingEnemy = e;
  for (let strike = 0; strike < e.strikes; strike++) {
    let living = state.party
      .map((h, i) => (alive(h) ? i : -1))
      .filter((i) => i >= 0);
    if (!living.length) break;
    let target = pick(living),
      victim = state.party[target];
    sayEnemy("attack");
    lunge(enemyArtEl(e), true);
    let symbols = await runMachine(enemyMachine(e), e.reels);
    e.last = symbols;
    let raw = calculate(symbols),
      base = {
        attack:
          Math.ceil(
            ((raw.attack + raw.magic) * e.damage) /
              balanceValue("enemyTurn.attack.1"),
          ) + (raw.attack || raw.magic ? attackBonus(e) : 0),
        poison:
          raw.poison +
          (raw.attack || raw.magic
            ? BALANCE.elites.find((a) => a.id === e.affixId)?.poisonOnHit || 0
            : 0),
        stimulant: raw.stimulant,
        heal: Math.ceil(raw.heal / balanceValue("enemyTurn.heal.1")),
        block: raw.block,
        stun: raw.stun,
        blank: 0,
      },
      multiplier = await rollCritical(e.name, symbols, true, {
        details: effectDetails(base),
      }),
      totals = scaleEffects(base, multiplier),
      notes = [];
    state.lastEnemyRoll = {
      enemyId: e.id,
      target,
      heroId: victim.id,
      symbols,
      multiplier,
      damage: totals.attack,
    };
    if (totals.stimulant) {
      applyStimulant(e, totals.stimulant);
      notes.push("power gathers");
    }
    if (totals.poison) {
      applyPoison(victim, totals.poison, e);
      notes.push("poison on " + victim.name);
    }
    if (totals.stun) notes.push(stunHero(target, totals.stun));
    if (totals.attack) {
      let n = 0;
      const hits =
        multiplier > 1
          ? [base.attack, totals.attack - base.attack]
          : [totals.attack];
      state.lastEnemyRoll.hits = [];
      for (const power of hits) {
        if (!alive(victim) || power <= 0) break;
        beam(
          enemyArtEl(e),
          $("#portrait-" + target),
          raw.magic ? "magic" : "attack",
          {
            critical: multiplier > 1,
            lethal: power >= victim.hp + state.block,
          },
        );
        lunge(enemyArtEl(e), true);
        const actual = damageHero(
          target,
          power,
          `${e.name}${multiplier > 1 ? " (×" + multiplier + " critical)" : ""}`,
        );
        n += actual;
        state.lastEnemyRoll.hits.push({ power, actual, at: Date.now() });
        if (hits.length > 1)
          await feedbackPause(skip ? 95 : Math.max(100, 190 / pace()));
      }
      state.lastEnemyRoll.actualDamage = n;
      notes.push("<strong>−" + n + " HP</strong> to " + victim.name);
      await pause(380);
    }
    if (totals.heal) {
      let n = Math.min(e.maxHp - e.hp, totals.heal);
      e.hp += n;
      if (n) {
        floatAt(enemyArtEl(e), "+" + n + " HP", true);
        burst(enemyArtEl(e), "heal", 12);
        notes.push("+" + n + " enemy HP");
      }
    }
    if (totals.block) {
      e.block += totals.block;
      notes.push("+" + totals.block + " enemy armour");
    }
    result(
      `<span class="damage">${icon("skull")}${e.name}: ${notes.join(" · ") || "a harmless scratch"}</span>`,
    );
    syncEnemy(e);
    await pause(250);
    await processDeaths();
    if (!state.party.some(alive)) break;
  }
  if (e.stimulant && --e.stimulant.turns <= 0) e.stimulant = null;
  actingEnemy = null;
}
async function victory(e) {
  sayEnemy("defeat");
  burst($("#enemy-art"), "paper", 46);
  shakeElement($("#enemy-art"), 5);
  await pause(350);
  state.party.filter(alive).forEach((h) => {
    h.stats ??= emptyStats();
    h.stats.battles++;
    addXP(
      h,
      Math.round(
        (balanceValue("victory.coefficient.1") +
          state.depth * balanceValue("victory.coefficient.2")) *
          balanceValue("victory.coefficient.3") *
          (state.encounterReward?.count || 1) *
          (e.stronghold
            ? balanceValue("victory.coefficient.4")
            : e.boss
              ? balanceValue("victory.coefficient.5")
              : e.elite
                ? balanceValue("victory.coefficient.6")
                : 1),
      ),
    );
    h.points++;
  });
  const leveled = state.party.filter(
    (h) => alive(h) && Date.now() - (h.levelUpAt || 0) < 2000,
  );
  if (leveled.length) {
    renderParty();
    leveled.forEach(levelUpFX);
    result(
      leveled
        .map((h) => h.name + " · LEVEL " + h.level + " · +6 HP · +4 points")
        .join(" / "),
    );
    await feedbackPause(skip ? 180 : Math.max(180, 600 / pace()));
  }
  state.battlesWon++;
  if (state.encounterReward?.ambush) clearFogAfterVictory();
  clearBattleStatuses();
  state.enemy = null;
  state.enemies = [];
  state.block = 0;
  if (e.boss) {
    state.floorBossDefeated = true;
    const stair = state.map.find((c) => c.event === "stairs");
    if (stair) stair.bossDefeated = true;
    log(e.name + " falls. The staircase is unguarded.");
  }
  log(`${e.name} is defeated. EXP for the survivors. Team armour expires.`);
  renderBlock();
  if (e.boss && state.depth === BALANCE.rules.floors) {
    finishVictory();
    return;
  }
  await treasureRoll(e.stronghold ? "stronghold" : e.boss ? "boss" : "battle");
  $("#field-note").textContent =
    "“The only way to write the ending is to keep turning pages.”";
  maybeDiscoveryHint();
  if (state.exitPromptPending) {
    state.exitPromptPending = false;
    busy = false;
    stairs();
  }
}
async function treasureRoll(source = "chest") {
  let faces = lootFaces(),
    battle = source !== "chest",
    elite = source === "stronghold";
  showSpotlight(
    source === "body"
      ? "A traveller’s satchel"
      : battle
        ? "Spoils of battle"
        : "Treasure!",
    source === "body"
      ? "A few keepsakes, left beneath the dust."
      : battle
        ? "The enemy leaves a few scraps worth keeping."
        : "Something rattles inside the little wooden chest.",
    `<div class="trap-art">${icon(battle ? "skull" : "treasure")}</div>${drawMachine(
      "treasure",
      [
        { type: "coin", tier: 1 },
        { type: "coin", tier: 2 },
        { type: "coin", tier: 3 },
      ],
      { title: "Fortune favours the curious" },
    )}${criticalSpace()}<div class="stage-result" id="treasure-result">What did the dungeon leave you?</div><div id="artefact-loot"></div>`,
    "treasure",
  );
  let symbols = await runMachine("treasure", [faces, faces, faces]),
    baseGold = balanceValue("treasureRoll.baseGold.1") + state.depth,
    counts = {},
    found = [];
  for (let s of symbols) {
    counts[s.type] = (counts[s.type] || 0) + 1;
    if (s.type === "coin")
      baseGold +=
        s.tier *
        (battle
          ? balanceValue("treasureRoll.coefficient.1") + state.depth
          : balanceValue("treasureRoll.coefficient.2") + state.depth);
    if (s.type === "artefact") found.push(makeArtefact(state.depth));
  }
  if (source === "boss") baseGold *= balanceValue("treasureRoll.coefficient.3");
  if (elite) {
    baseGold *= balanceValue("treasureRoll.coefficient.4");
    const prized = makeArtefact(
      state.depth + balanceValue("treasureRoll.prized.1"),
    );
    prized.depth = state.depth;
    found.push(prized);
  }
  baseGold = Math.ceil(baseGold * (1 + passive("gold") / 100));
  let details = [{ label: "Gold", icon: "coin", value: baseGold }];
  for (let type of [...Object.keys(ITEM_DEFS), "point"])
    if (counts[type])
      details.push({
        label: ITEM_DEFS[type]?.name || "Personal points",
        icon: ITEM_DEFS[type]?.icon || "point",
        value: counts[type],
      });
  for (let a of found.filter((a) => a.key !== "revive"))
    details.push({
      label: a.name + " power",
      icon: "artefact",
      value: a.power,
    });
  let multiplier = await rollCritical(
      battle ? "Battle spoils" : "Treasure",
      symbols,
      false,
      { context: "treasure", details },
    ),
    gold = Math.ceil(baseGold * multiplier),
    notes = ["+" + gold + " gold"];
  state.gold += gold;
  const itemDrops = Object.keys(ITEM_DEFS)
    .filter((type) => counts[type])
    .map((type) => ({
      type,
      count: Math.ceil(counts[type] * multiplier),
    }));
  for (const drop of itemDrops)
    notes.push("+" + drop.count + " " + ITEM_DEFS[drop.type].name);
  if (counts.point) {
    let h = pick(state.party.filter(alive)),
      n = Math.ceil(counts.point * multiplier);
    h.points += n;
    notes.push("+" + n + " points for " + h.name);
  }
  for (let a of found) {
    if (a.key !== "revive") a.power = Math.ceil(a.power * multiplier);
    state.artefacts.push(a);
    if (!state.equippedArtefact && a.key !== "revive")
      state.equippedArtefact = a.id;
    notes.push("Artefact: " + a.name);
  }
  $("#treasure-result").innerHTML =
    (multiplier > 1
      ? `<b>JACKPOT · ${baseGold} × ${multiplier} = ${gold} gold</b><br>`
      : "") + notes.map(escapeHTML).join(" · ");
  $("#artefact-loot").innerHTML =
    itemDrops
      .map(
        (drop) =>
          `<div class="item-find">${icon(ITEM_DEFS[drop.type].icon)}<div><b>${ITEM_DEFS[drop.type].name} ×${drop.count}</b><p>${ITEM_DEFS[drop.type].description}</p></div></div>`,
      )
      .join("") +
    found
      .map(
        (a) =>
          `<div class="artefact-card">${icon("artefact")}<div><b>${a.name}</b><p>${artefactText(a)}</p>${artefactButton(a)}</div></div>`,
      )
      .join("");
  state.lastLoot = {
    source,
    symbols,
    gold,
    baseGold,
    multiplier,
    found: found.map((a) => a.id),
  };
  result(
    `<span class="gold">${icon("coin")}${notes.map(escapeHTML).join(" · ")}</span>`,
  );
  log((battle ? "Battle spoils: " : "Treasure: ") + notes.join(", ") + ".");
  document.querySelectorAll(".item-find").forEach((el) => {
    popTitle(el);
    burst(el, "gold", 30);
  });
  goldCelebration(gold, multiplier > 1);
  await eventChoice([
    {
      id: "stage-confirm",
      label: battle ? "Claim the spoils ↗" : "Pocket the treasure ↗",
      value: true,
    },
  ]);
  stopCoinRain();
  closeSpotlight();
  state.pendingItems.push(...itemDrops);
  save();
  await processPendingItems();
  renderInventory();
  renderArtefactSlot();
}
function trapArt(type) {
  return `<div class="trap-art ${type}">${Production.assets.render("trap." + type, null, () => builtinTrapArt(type))}</div>`;
}
function builtinTrapArt(type) {
  let body =
    type === "spikes"
      ? '<path d="M5 76h190M10 82h180"/><g class="spike-bank"><path d="m20 76 13-49 13 49m10 0 15-63 15 63m10 0 15-56 15 56m11 0 14-46 14 46" fill="#b2a384"/><path d="m32 42 1 27m38-34v30m41-27-1 30m41-26 1 29"/></g>'
      : type === "arrow"
        ? '<path d="M5 7h32v76H5z M5 27h32M5 51h32M20 7v20m3 24v31 M36 41h14"/><g class="flying-arrow"><path d="M54 42h90l-12-10m12 10-12 10M56 42l-10-9m17 9-11-9m4 9-10 9m17-9-11 9"/></g>'
        : '<path d="M5 78h190"/><g class="rolling-boulder"><circle cx="83" cy="45" r="31" fill="#d0c2a1"/><path d="m65 27 10-7 17 3 14 13-4 28-15 11-22-8-9-17z M72 31l-6 9 13 9-3 14m14-37 5 13-5 12 10 5"/></g>';
  return `<svg viewBox="0 0 200 90" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}
async function trapRoll() {
  let kind = pick(["spikes", "arrow", "boulder"]),
    title = {
      spikes: "Spikes in the floor!",
      arrow: "An arrow in the wall!",
      boulder: "A rolling boulder!",
    }[kind];
  showSpotlight(
    "A hidden trap",
    title,
    trapArt(kind) +
      '<p class="stage-subtitle">Something clicks beneath your feet…</p><div id="trap-machine"></div>' +
      criticalSpace() +
      '<div class="stage-result" id="trap-result">Hold very, very still.</div>',
    "trap",
  );
  shakeBook(5);
  burst($("#stage-card"), "scary", 20);
  await pause(650);
  let faces = BALANCE.eventReels.trap.faces;
  $("#trap-machine").innerHTML = drawMachine("trap", faces.slice(0, 3), {
    title: "Escape, guard, or danger",
  });
  let symbols = await runMachine("trap", [faces, faces, faces]),
    baseDamage = Math.ceil(
      symbols.filter((s) => s.type === "trap").reduce((n, s) => n + s.tier, 0) *
        trapPower(state.depth),
    ),
    baseGuard = symbols.filter((s) => s.type === "block").length,
    multiplier = await rollCritical("Trap reels", symbols, false, {
      context: "trap",
      details: [
        { label: "Incoming damage", icon: "trap", value: baseDamage },
        { label: "Temporary guard", icon: "block", value: baseGuard },
      ],
    }),
    n = Math.ceil(baseDamage * multiplier),
    guard = Math.ceil(baseGuard * multiplier),
    living = state.party
      .map((h, i) => (alive(h) ? i : -1))
      .filter((i) => i >= 0),
    target = pick(living),
    name = state.party[target].name;
  state.block = guard;
  $("#trap-result").innerHTML = n
    ? `${name}: ${baseDamage}${multiplier > 1 ? " × " + multiplier + " = " + n : ""} incoming damage<br>${guard} temporary guard`
    : `A narrow escape. No damage!<br>${guard} temporary guard`;
  await eventChoice([
    { id: "stage-confirm", label: "Carry on ↗", value: true },
  ]);
  closeSpotlight();
  if (n) {
    beam(
      $(`[data-tile="${state.position}"]`),
      $("#portrait-" + target),
      "attack",
    );
    let actual = damageHero(
      target,
      n,
      title + (multiplier > 1 ? " (×" + multiplier + " critical)" : ""),
    );
    result(
      `<span class="damage">${icon("trap")}${name}: −${actual} HP · ${title}</span>`,
    );
    await feedbackPause(300);
  } else {
    log("The trap reels show a safe way through.");
    result(icon("safe") + " A narrow escape · no damage");
    burst($("#map-player"), "paper", 18);
  }
  state.block = 0;
  renderBlock();
  await processDeaths();
  checkDefeat();
  await pause(300);
}
function stairs() {
  if (
    busy ||
    state.enemy ||
    state.over ||
    !state.exitFound ||
    !state.exitReached
  )
    return;
  state.exitPromptPending = false;
  let finalFloor = state.depth === BALANCE.rules.floors,
    locked = !state.floorBossDefeated;
  openModal(
    "A stairway in the paper",
    `<p>The stairs are marked. Use them from anywhere on this floor, or stay and explore. There is no road back: only the next page.</p>${locked ? "<p><b>A guardian bars this staircase.</b> Defeat the guardian on the staircase to descend.</p>" : ""}<p>Floor ${state.depth} / 10 · ${state.gold} gold · ${state.battlesWon} battles won</p><div class="modal-actions"><button class="primary" id="descend" ${locked ? "disabled" : ""}>${finalFloor ? "Write the final page ↗" : "Descend to floor " + (state.depth + 1)}</button><button data-close>Keep exploring</button></div>`,
    "stairs",
  );
  if (locked) {
    const button = document.createElement("button");
    button.className = "primary";
    button.textContent = "Challenge the stair guardian";
    $("#modal .modal-actions").prepend(button);
    button.onclick = async () => {
      closeModal();
      busy = true;
      try {
        beginEncounter(true, { stairBoss: true });
        render();
        await encounterEntrance();
      } finally {
        busy = false;
        render();
        save();
      }
    };
  }
  $("#descend").onclick = () => {
    if (busy || locked) return;
    closeModal();
    if (finalFloor) {
      finishVictory();
      return;
    }
    state.recruitPity = state.recruitFoundThisFloor
      ? 0
      : (state.recruitPity || 0) + 1;
    state.recruitFoundThisFloor = false;
    fadeDiscoveryHints();
    state.depth++;
    state.pursuer = null;
    state.pursuerSpawned = false;
    state.map = generateFloor(state.depth);
    state.position = pos(1, 7);
    state.exitFound = false;
    state.exitReached = false;
    state.enemies = [];
    state.exitPromptPending = false;
    state.floorBossDefeated = false;
    state.block = 0;
    state.party.forEach((h, i) => healHero(i, BALANCE.rules.descentHeal));
    log(
      `The company descends to floor ${state.depth}. Everyone recovers 5 HP.`,
    );
    result(icon("stairs") + " A fresh page. Deeper shadows.");
    render();
    shakeBook(3);
    save();
  };
}
const ITEM_DEFS = Production.balance.items();
function initBag() {
  const legacy = {
    potion: state.potions || 0,
    bomb: state.bombs || 0,
    ward: state.wards || 0,
  };
  state.bag ??= Object.fromEntries(
    Object.entries(legacy).filter(([, n]) => n > 0),
  );
  state.pendingItems ??= [];
  for (const [key, count] of Object.entries(state.bag))
    if (!ITEM_DEFS[key] || !Number.isFinite(count) || count <= 0)
      delete state.bag[key];
  for (const key of Object.keys(state.bag).slice(BALANCE.rules.bagTypes)) {
    state.pendingItems.push({ type: key, count: state.bag[key] });
    delete state.bag[key];
  }
  for (const [field, type] of Object.entries({
    potions: "potion",
    bombs: "bomb",
    wards: "ward",
  }))
    Object.defineProperty(state, field, {
      configurable: true,
      enumerable: true,
      get() {
        return this.bag[type] || 0;
      },
      set(n) {
        if (n > 0) this.bag[type] = Math.floor(n);
        else delete this.bag[type];
      },
    });
}
function canUseItem(type) {
  const item = ITEM_DEFS[type],
    h = state.party[state.target];
  if (
    !item ||
    state.over ||
    !alive(h) ||
    (item.combat && !state.enemy) ||
    (item.outside && state.enemy)
  )
    return false;
  if (item.equipment)
    return state.party.some((hero) => alive(hero) && hero.job === item.job);
  if (["potion", "bandage", "ration"].includes(type)) return h.hp < h.maxHp;
  if (type === "salve")
    return state.party.some((h) => alive(h) && h.hp < h.maxHp);
  if (type === "antidote") return !!h.poison;
  return true;
}
function bagCards(overflow = false) {
  return Object.entries(state.bag)
    .map(
      ([type, count]) =>
        `<article class="bag-card">${icon(ITEM_DEFS[type].icon)}<div><b>${ITEM_DEFS[type].name} ×${count}</b><p>${ITEM_DEFS[type].description}</p><div>${overflow ? `<button data-stage-choice="swap:${type}">Toss this stack & take the find</button>${canUseItem(type) ? `<button data-stage-choice="use:${type}">Use one now</button>` : ""}` : `<button data-use-item="${type}" ${canUseItem(type) ? "" : "disabled"}>Use one</button><button data-toss-item="${type}">Discard stack</button>`}</div></div></article>`,
    )
    .join("");
}
function inspectBag() {
  if (busy || state.over) return;
  openModal(
    "Three pockets in the dark",
    `<p>${Object.keys(state.bag).length} / 3 item types. Matching items share a pocket.</p><div class="bag-grid">${bagCards()}</div><div class="modal-actions"><button data-close class="primary">Close the satchel</button></div>`,
    "bag",
  );
}
let processingItems = false;
async function processPendingItems() {
  if (processingItems) return;
  processingItems = true;
  try {
    while (state.pendingItems.length) {
      const drop = state.pendingItems[0],
        item = ITEM_DEFS[drop.type];
      if (!item || drop.count <= 0) {
        state.pendingItems.shift();
        continue;
      }
      if (
        state.bag[drop.type] ||
        Object.keys(state.bag).length < BALANCE.rules.bagTypes
      ) {
        state.bag[drop.type] = (state.bag[drop.type] || 0) + drop.count;
        state.pendingItems.shift();
        renderInventory();
        save();
        continue;
      }
      showSpotlight(
        "The satchel is full",
        `${item.name} ×${drop.count} · three different item types already packed.`,
        `<div class="incoming-item">${icon(item.icon)}<b>${item.name}</b><p>${item.description}</p></div><div class="bag-grid">${bagCards(true)}</div>`,
        "bag-overflow",
      );
      const choices = [
        {
          id: "item-leave",
          label: "Leave this find behind",
          value: "leave",
        },
      ];
      if (canUseItem(drop.type))
        choices.unshift({
          id: "item-use-found",
          label: "Use the new item now",
          value: "found",
        });
      const choice = await eventChoice(choices);
      closeSpotlight();
      if (choice === "leave") {
        state.pendingItems.shift();
        log(item.name + " left beside the full satchel.");
      } else if (choice === "found") {
        const used = await useItem(drop.type, {
          free: true,
          internal: true,
        });
        if (used) drop.count--;
        save();
      } else if (choice.startsWith("swap:")) {
        const old = choice.slice(5);
        delete state.bag[old];
        state.bag[drop.type] = drop.count;
        state.pendingItems.shift();
        log(ITEM_DEFS[old].name + " discarded to carry " + item.name + ".");
      } else if (choice.startsWith("use:"))
        await useItem(choice.slice(4), { internal: true });
      renderInventory();
      save();
    }
  } finally {
    processingItems = false;
  }
}
async function useItem(type, { free = false, internal = false } = {}) {
  if ((busy && !internal) || (!free && !state.bag[type]) || !canUseItem(type))
    return false;
  if (ITEM_DEFS[type]?.equipment)
    return selectEquipment(type, { free, internal });
  const wasBusy = busy,
    h = state.party[state.target],
    item = ITEM_DEFS[type];
  busy = true;
  sceneFast = false;
  if (!free) {
    state.bag[type]--;
    if (!state.bag[type]) delete state.bag[type];
  }
  h.stats.itemsUsed = (h.stats.itemsUsed || 0) + 1;
  if (modalKind === "bag") closeModal();
  renderInventory();
  save();
  try {
    const target = state.target;
    if (item.equipment)
      return state.party.some((hero) => alive(hero) && hero.job === item.job);
    if (["potion", "bandage", "ration"].includes(type)) {
      const amount =
        type === "potion"
          ? BALANCE.items.potion.heal
          : type === "bandage"
            ? BALANCE.items.bandage.heal
            : Math.ceil(h.maxHp * BALANCE.items.ration.healthFraction);
      const n = healHero(target, amount);
      result(icon(item.icon) + " " + h.name + " · +" + n + " HP");
    }
    if (type === "salve") {
      let total = 0;
      state.party.forEach(
        (h, i) => (total += healHero(i, BALANCE.items.salve.heal)),
      );
      result(icon(item.icon) + " +" + total + " party HP");
    }
    if (type === "antidote") {
      h.poison = null;
      healingFX($("#portrait-" + target));
      result(icon("antidote") + h.name + " is free of poison.");
    }
    if (type === "ward") {
      state.block += BALANCE.items.ward.block;
      renderBlock();
      burst($("#block"), "shield", 20);
      result(icon("ward") + " +" + BALANCE.items.ward.block + " team block");
    }
    if (type === "ember") {
      applyStimulant(h, BALANCE.items.ember.stimulant);
      result(icon("flame") + h.name + " is powered up.");
    }
    if (type === "oil") {
      h.rage = Math.min(
        BALANCE.abilities.fighter.stackCap,
        (h.rage || 0) + BALANCE.items.oil.rage,
      );
      syncStatusFX();
      result(
        icon("flame") + h.name + " gains +" + BALANCE.items.oil.rage + " rage.",
      );
    }
    if (type === "venom") {
      applyPoison(state.enemy, BALANCE.items.venom.poison, h);
      result(
        icon("poison") +
          state.enemy.name +
          " · poison for " +
          state.enemy.poison.turns +
          " turns",
      );
    }
    if (type === "frost") {
      result(icon("frost") + stunEnemy(BALANCE.items.frost.stun, state.enemy));
      burst(enemyArtEl(), "water", 24);
    }
    if (type === "chalk") {
      for (const i of neighbors(state.position, true))
        if (!state.map[i].seen && lineOfSight(state.position, i))
          await revealTile(i);
      result(icon("chalk") + " A few more rooms in the torchlight.");
    }
    if (type === "firebomb") {
      const selected = state.enemy;
      for (const e of livingEnemies()) {
        const power =
          BALANCE.items.firebomb.damageBase +
          Math.floor(state.depth / BALANCE.items.firebomb.depthDivisor);
        beam($("#inventory-title"), enemyArtEl(e), "magic", {
          lethal: power >= e.hp + (e.block || 0),
        });
        const n = damageEnemy(power, item.name, e);
        h.stats.damageDealt += n;
        if (!e.hp) h.stats.kills++;
      }
      result(icon("flame") + " Cinders sweep every enemy.");
      await finishItemBattle(selected);
    }
    if (type === "bomb") await rollInkBomb(h);
    return true;
  } finally {
    busy = wasBusy;
    render();
    save();
  }
}
async function finishItemBattle(selected) {
  if (!livingEnemies().length) {
    state.lastLethalHitAt = Date.now();
    await feedbackPause(skip ? 650 : 900);
    await victory(selected);
  } else if (state.enemy.hp <= 0) state.enemy = livingEnemies()[0];
}
async function rollInkBomb(h) {
  const e = state.enemy,
    pool = BALANCE.eventReels.inkBomb.faces;
  showSpotlight(
    "Ink bomb!",
    "A glass shell. A very unpleasant splash.",
    `${drawMachine("ink-bomb", [pool[0], pool[2], pool[4]], { title: "Damage & poison" })}${criticalSpace()}<div id="bomb-result" class="stage-result">The fuse is hissing…</div>`,
    "bomb-roll",
  );
  const symbols = await runMachine("ink-bomb", [pool, pool, pool]),
    base = calculate(symbols);
  if (base.attack)
    base.attack += Math.floor(
      state.depth / balanceValue("rollInkBomb.coefficient.1"),
    );
  const multiplier = await rollCritical("Ink bomb", symbols, false, {
      context: "bomb",
      details: effectDetails(base),
    }),
    totals = scaleEffects(base, multiplier);
  $("#bomb-result").innerHTML =
    `<b>${totals.attack} damage</b> · ${totals.poison ? Math.min(BALANCE.abilities.poison.maxTurns, BALANCE.abilities.poison.baseTurns + totals.poison) + " turns of poison" : "no poison"}${multiplier > 1 ? "<br>" + base.attack + " × " + multiplier + " = " + totals.attack + " damage" : ""}`;
  state.lastItemRoll = {
    type: "bomb",
    symbols,
    base,
    totals,
    multiplier,
    target: e.id,
  };
  await eventChoice([
    { id: "stage-confirm", label: "Let it burst ↗", value: true },
  ]);
  closeSpotlight();
  if (totals.attack) {
    beam($("#inventory-title"), enemyArtEl(e), "attack", {
      critical: multiplier > 1,
      lethal: totals.attack >= e.hp + (e.block || 0),
    });
    const n = damageEnemy(totals.attack, "Ink bomb", e);
    h.stats.damageDealt += n;
    if (!e.hp) h.stats.kills++;
  }
  if (totals.poison && e.hp > 0) applyPoison(e, totals.poison, h);
  result(
    icon("bomb") +
      " Ink bomb · " +
      totals.attack +
      " damage" +
      (totals.poison ? " & poison" : ""),
  );
  await finishItemBattle(e);
}
function usePotion() {
  return useItem("potion");
}
function useBomb() {
  return useItem("bomb");
}
function useWard() {
  return useItem("ward");
}
function openModal(title, body, kind) {
  if ($("#overlay").hidden) modalPrevious = document.activeElement;
  modalKind = kind;
  $("#modal").innerHTML =
    `<button class="quiet close" data-close aria-label="Close dialog">✕</button><div class="eyebrow">Scratchpad / field notes</div><h2 id="modal-title">${title}</h2><div class="modal-body"><div class="modal-flow">${body}</div></div>`;
  $("#overlay").hidden = false;
  $("#modal").focus();
  popTitle($("#modal-title"));
  updateKeyboardBar();
  fitDialogs();
  requestFitUI();
}
function closeModal() {
  let shop = modalKind === "shop";
  $("#overlay").hidden = true;
  modalKind = "";
  if (shop && shopResolver) {
    let done = shopResolver;
    shopResolver = null;
    done();
  }
  if (modalPrevious?.isConnected) modalPrevious.focus();
  updateKeyboardBar();
}
function showSpotlight(title, subtitle, body, kind) {
  stagePrevious = document.activeElement;
  $("#stage-card").className = "stage-card " + kind;
  $("#spotlight").dataset.kind = kind;
  $("#stage-card").innerHTML =
    `<div class="paper-tear" aria-hidden="true"></div><div class="eyebrow">A turn of fate / ${kind === "critical" ? "three of a kind" : kind === "enemy-intro" ? "encounter" : "field notes"}</div><h2 class="stage-title" id="stage-title">${title}</h2><p class="stage-subtitle">${subtitle}</p><div class="stage-content"><div class="scene-layout">${body}</div></div><div class="stage-actions" id="stage-actions"><button class="stage-skip" id="stage-skip" data-fast>Land the reels now ↗</button></div>`;
  $("#spotlight").hidden = false;
  $("#stage-card").focus();
  popTitle($("#stage-title"));
  burst($("#stage-card"), "paper", 48);
  shakeElement($("#stage-card"), 2);
  updateKeyboardBar();
  fitDialogs();
  requestFitUI();
}
function closeSpotlight() {
  stopCoinRain();
  $("#spotlight").hidden = true;
  if (stagePrevious?.isConnected) stagePrevious.focus();
  updateKeyboardBar();
}
function editor(i) {
  if (busy || state.over) return;
  const h = state.party[i];
  if (!h) return;
  openModal(
    h.name + "’s lucky machinery",
    `<p><b>${h.points} personal points.</b> ${classAbilityDescription(h.job)}<br>Each column is one reel; every weighted face is shown. Only the middle reel carries a class seal. Change a symbol for its tier cost. Inscribe an EMPTY face for ${BALANCE.rules.blankInscriptionCost} points. Upgrade I → II for ${FACE_COST[2]} points, II → III for ${FACE_COST[3]}, attack / magic III → IV for ${FACE_COST[4]}. Weaken for ${BALANCE.rules.weakenCost}.</p><div class="reel-editor">${h.reels.map((r, k) => `<section class="editor-row"><b>Reel ${k + 1}</b><div class="editor-slots">${r.map((s, j) => `<div class="editor-slot">${symbolMarkup(s)}<small>${s.type} ${tierName(s.tier)} · ${Math.round((100 * (s.weight || 1)) / r.reduce((n, f) => n + (f.weight || 1), 0))}%</small><div class="face-actions"><button data-cycle="${i},${k},${j}" ${h.points < (s.type === "blank" ? BALANCE.rules.blankInscriptionCost : FACE_COST[s.tier]) ? "disabled" : ""}>Change ${s.type === "blank" ? BALANCE.rules.blankInscriptionCost : FACE_COST[s.tier]}pt</button><button data-upgrade="${i},${k},${j}" ${h.points < (faceUpgradeCost(s) || Infinity) ? "disabled" : ""}>${s.type === "blank" ? "Inscribe " + (h.job === "healer" ? "heal" : h.job === "mage" ? "magic" : "attack") + " I · " + BALANCE.rules.blankInscriptionCost + "pt" : s.tier >= maxFaceTier(s.type) ? "Max" : "↑ " + FACE_COST[s.tier + 1] + "pt"}</button>${s.tier > 1 ? `<button data-weaken="${i},${k},${j}" ${h.points < BALANCE.rules.weakenCost ? "disabled" : ""}>↓ ${BALANCE.rules.weakenCost}pt</button>` : ""}</div></div>`).join("")}</div></section>`).join("")}</div><div class="modal-actions"><button class="primary" data-close>Back to the adventure</button></div>`,
    "editor",
  );
}

function editFace(data, operation) {
  if (busy || state.over) return;
  let [i, r, f] = data.split(",").map(Number),
    h = state.party[i],
    s = h?.reels[r]?.[f];
  if (!s) return;
  let op =
      operation === true
        ? "upgrade"
        : operation === false
          ? "cycle"
          : operation,
    cost =
      op === "upgrade"
        ? faceUpgradeCost(s)
        : op === "weaken"
          ? BALANCE.rules.weakenCost
          : s.type === "blank"
            ? BALANCE.rules.blankInscriptionCost
            : FACE_COST[s.tier];
  if (
    !cost ||
    h.points < cost ||
    (op === "upgrade" && s.type !== "blank" && s.tier >= maxFaceTier(s.type)) ||
    (op === "weaken" && s.tier === 1)
  )
    return;
  h.points -= cost;
  if (op === "upgrade" && s.type === "blank") {
    s.type =
      h.job === "healer" ? "heal" : h.job === "mage" ? "magic" : "attack";
    s.tier = 1;
  } else if (op === "upgrade") s.tier++;
  else if (op === "weaken") s.tier = 1;
  else {
    let next = (TYPES.indexOf(s.type) + 1) % TYPES.length;
    if (
      TYPES[next] === "class" &&
      (r !== 1 ||
        h.reels[r].some((face, j) => j !== f && face.type === "class"))
    )
      next = (next + 1) % TYPES.length;
    s.type = TYPES[next];
    s.job = h.job;
    s.tier = Math.min(s.tier, maxFaceTier(s.type));
  }
  h.last[r] = { type: s.type, tier: s.tier };
  renderParty();
  save();
  editor(i);
}
function help() {
  openModal(
    "A field guide for the brave",
    `<div class="guide-grid">
    <p><b>Explore.</b> Click a frontier tile, or follow known rooms. Routes avoid active fights and traps, and pass through known wells, shops and ruins unless selected. Click a new goal while walking or erasing. Walls and rivers block movement; bridges cross rivers. Stairs are random, reachable, and at least eight steps from camp.</p>
    <p><b>Descend.</b> A shop map only marks the stairs. Select the stairs to open their menu, even after an earlier visit. Walking across them on a longer path does not stop you. Once reached, descend from anywhere or keep exploring. Every staircase has an elite guardian. Defeat it before descending. Killing the tenth guardian wins the expedition.</p>
    <p><b>Old passages.</b> Explored rooms may hide an ambush after a minute away. Only exploration time counts; battles and menus pause it. There is no fog on the map. Winning an ambush makes nearby passages safe again. On deeper floors The Unwritten follows your footsteps: watch for its moving mark.</p>
    <p><b>Act freely.</b> Any living hero can spin repeatedly. Click a hero portrait to select healing; click an enemy portrait to select damage. On deep floors two enemies may attack with independent clocks. Magic attacks work like blades. Poison deals one damage per action for a few turns. Stimulants boost damage and protection. Tier III / IV attacks and criticals hit ALL enemies.</p>
    <p><b>Three of a kind.</b> Three identical type-and-tier symbols roll a ×2–×4 critical. A class seal completes two matching symbols while also casting its ability. Blanks never crit. Event criticals stay in their original panel. Click rolling reels or press Space to land them. “Strike now” skips a critical result’s hold. Confirm event results with a button.</p>
    <p><b>Armour and stun.</b> Shared team armour absorbs damage and clears after battle. Any armour blocks a stun, consuming up to six armour per power. A stunned hero misses one go without advancing enemy clocks.</p>
    <p><b>Live and learn.</b> Victory gives EXP and editing points. Each level adds 6 maximum HP and 4 personal points. Edit all three reels with ✎. Upgrading to tiers II / III / IV costs 4 / 9 / 16 points. Blank faces cost three points to inscribe. Rage, poison and buffs end with combat.</p>
    <p><b>The fallen.</b> A Revive Stone in your pack can be consumed once to restore a fallen hero at 75% health. Otherwise dead heroes leave corpses. Survivors confirm a burial with their cause, origin, time and statistics. Names remembered keeps those records. Healing never revives the dead.</p>
    <p><b>Discoveries.</b> Wells can be left for later; they roll 30% HP plus a bonus. Ruins can be ignored or examined for loot against trap damage. Cave rooms reveal together without activating anything. Rare walled strongholds house bosses with rich loot.</p>
    <p><b>Supplies.</b> Carry three item types; matching items stack. Drag class equipment onto a hero to fill their personal equipment slot. Eight unique pieces grant damage, protection or abilities. Inspect the satchel to use or discard stacks. With a full bag, use a find, swap a stack or leave it. Ink bombs roll damage and poison. Equip one passive artefact. Shops sell supplies and healing. Adventurers join only if invited, up to three heroes; a fourth can replace a current companion. Retired companions remain in the final records.</p>
    <p><b>Read the page.</b> Health bars move from green through yellow to red and flash below 25%. Faint hints suggest neighbouring discoveries without revealing them. The field log and final memorial roster scroll; other panels fit their content.</p>
    <p><b>Controls.</b> The bottom bar lists keyboard and mouse actions. Tab and Enter reach every control. Options and Field Guide tabs turn to extra notebook pages. Autoresolve chooses battle actions and occasional emergency supplies. Animation speed, palette and autoresolve persist into new runs. Save HTML downloads the complete offline game; progress stays in this browser.</p>
  </div><div class="modal-actions"><button class="primary" data-close>Into the margins ↗</button></div>`,
    "help",
  );
}

// Small independent random stream: presentation never changes gameplay odds.
let fxSeed = Date.now() >>> 0;
function fxRandom() {
  fxSeed = (Math.imul(fxSeed, 1664525) + 1013904223) >>> 0;
  return fxSeed / 4294967296;
}
function visualPick(a) {
  return a[Math.floor(fxRandom() * a.length)];
}
const fxCanvas = $("#fx-canvas"),
  fxContext = fxCanvas.getContext("2d");
let particles = [],
  fxFrame = 0;
function sizeCanvas() {
  let d = Math.min(devicePixelRatio || 1, 2);
  fxCanvas.width = innerWidth * d;
  fxCanvas.height = innerHeight * d;
  fxContext.setTransform(d, 0, 0, d, 0, 0);
}
function burst(el, kind = "paper", count = 15) {
  if (!el) return;
  let r = el.getBoundingClientRect(),
    x = r.left + r.width / 2,
    y = r.top + r.height / 2;
  for (let n = 0; n < count; n++) {
    let angle = fxRandom() * Math.PI * 2,
      speed =
        (kind === "dust" ? 1.5 : 3) + fxRandom() * (kind === "scary" ? 5 : 4);
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - (kind === "paper" ? 3 : 0),
      size:
        kind === "smoke"
          ? 9 + fxRandom() * 16
          : kind === "dust"
            ? 1 + fxRandom() * 2
            : kind === "coin"
              ? 6 + fxRandom() * 8
              : 2 + fxRandom() * 5,
      angle: fxRandom() * 6,
      spin: (fxRandom() - 0.5) * 0.25,
      life: 0,
      max: 450 + fxRandom() * 650,
      kind,
    });
  }
  particles = particles.slice(-900);
  if (!fxFrame) fxFrame = requestAnimationFrame(drawParticles);
}
let fxLast = 0;
function drawParticles(time) {
  fxFrame = 0;
  let dt = Math.min(35, time - (fxLast || time - 16));
  fxLast = time;
  fxContext.clearRect(0, 0, innerWidth, innerHeight);

  particles = particles.filter((p) => p.life < p.max);
  for (let p of particles) {
    p.life += dt;
    p.x += (p.vx * dt) / 16;
    p.y += (p.vy * dt) / 16;
    p.vy += (0.07 * dt) / 16;
    p.angle += p.spin;
    fxContext.save();
    fxContext.translate(p.x, p.y);
    fxContext.rotate(p.angle);
    fxContext.globalAlpha = Math.max(0, 1 - p.life / p.max);
    fxContext.fillStyle = {
      paper: "#d4c8a7",
      dust: "#5b5749",
      damage: "#8d5140",
      heal: "#768759",
      gold: "#b99b55",
      coin: "#c6a544",
      confetti: "#c9ae6c",
      shield: "#6b8461",
      water: "#829b91",
      scary: "#423a2e",
      poison: "#6f9e49",
      smoke: "#b5bfbb",
    }[p.kind];
    fxContext.strokeStyle = fxContext.fillStyle;
    if (p.kind === "smoke") {
      fxContext.globalAlpha *= 0.5;
      fxContext.beginPath();
      fxContext.arc(0, 0, p.size * (1 + p.life / p.max), 0, Math.PI * 2);
      fxContext.fill();
    } else if (p.kind === "coin") {
      fxContext.beginPath();
      fxContext.ellipse(0, 0, p.size, p.size * 0.7, 0, 0, Math.PI * 2);
      fxContext.fill();
      fxContext.strokeStyle = "#785e30";
      fxContext.lineWidth = 0.8;
      fxContext.stroke();
      fxContext.beginPath();
      fxContext.moveTo(0, -p.size * 0.4);
      fxContext.lineTo(0, p.size * 0.4);
      fxContext.stroke();
    } else if (p.kind === "shield") {
      fxContext.beginPath();
      fxContext.moveTo(-p.size, -p.size);
      fxContext.lineTo(p.size, -p.size);
      fxContext.lineTo(p.size * 0.7, p.size * 0.4);
      fxContext.lineTo(0, p.size);
      fxContext.lineTo(-p.size * 0.7, p.size * 0.4);
      fxContext.closePath();
      fxContext.fill();
    } else if (p.kind === "scary" || p.kind === "heal") {
      fxContext.lineWidth = 1.3;
      fxContext.beginPath();
      fxContext.moveTo(-p.size, 0);
      fxContext.lineTo(p.size, 0);
      fxContext.moveTo(0, -p.size);
      fxContext.lineTo(0, p.size);
      fxContext.stroke();
    } else {
      fxContext.fillRect(
        -p.size / 2,
        -p.size / 2,
        p.size,
        p.kind === "paper" ? p.size * 0.6 : p.size,
      );
      if (p.kind === "paper") {
        fxContext.strokeStyle = "#9d8c63";
        fxContext.lineWidth = 0.5;
        fxContext.strokeRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      }
    }
    fxContext.restore();
  }
  if (particles.length) fxFrame = requestAnimationFrame(drawParticles);
  else fxLast = 0;
}
function shakeElement(el, amount = 3) {
  animate(
    el,
    [
      { transform: "translate(0,0) rotate(0)" },
      { transform: `translate(${-amount}px,1px) rotate(-1deg)` },
      { transform: `translate(${amount}px,-1px) rotate(1deg)` },
      { transform: `translate(${-amount * 0.4}px,0)` },
      { transform: "translate(0,0) rotate(0)" },
    ],
    { duration: 170, easing: "ease-out", juice: true },
  );
}
function pulseBeacon() {
  if (skip) return;
  let cell = $(`[data-tile="${state.position}"]`),
    wave = document.createElement("div");
  wave.className = "beacon-wave";
  Object.assign(wave.style, {
    left: cell.offsetLeft + cell.offsetWidth / 2 + "px",
    top: cell.offsetTop + cell.offsetHeight / 2 + "px",
    width: cell.offsetWidth * 3 + "px",
    height: cell.offsetHeight * 3 + "px",
  });
  $("#map-board").append(wave);
  setTimeout(() => wave.remove(), 1100);
}
function shakeBook(amount = 2) {
  shakeElement($("#book"), amount);
}
function lunge(el, enemy) {
  animate(
    el,
    [
      { transform: "translateX(0) rotate(0)" },
      {
        transform: `translateX(${enemy ? -10 : 10}px) rotate(${enemy ? -5 : 5}deg)`,
      },
      { transform: "translateX(0) rotate(0)" },
    ],
    { duration: 350, easing: "cubic-bezier(.2,.8,.3,1)" },
  );
}
function floatAt(el, label, heal = false, block = false) {
  if (!el) return;

  let r = el.getBoundingClientRect(),
    node = document.createElement("span");
  node.className = "combat-float" + (heal ? " healing" : block ? " block" : "");
  node.textContent = label;
  node.style.left = r.left + r.width / 2 + "px";
  node.style.top = r.top + r.height * 0.25 + "px";
  document.body.append(node);
  setTimeout(() => node.remove(), 1000);
}
function actionLabel(el, label) {
  if (!el) return;
  let r = el.getBoundingClientRect(),
    node = document.createElement("span");
  node.className = "action-label";
  node.textContent = label;
  node.style.left = r.left + r.width / 2 + "px";
  node.style.top = r.top - 15 + "px";
  document.body.append(node);
  setTimeout(() => node.remove(), 1000);
}
function beam(from, to, type, impact = {}) {
  if (!from || !to) return;
  let a = from.getBoundingClientRect(),
    b = to.getBoundingClientRect(),
    x = a.left + a.width / 2,
    y = a.top + a.height / 2,
    dx = b.left + b.width / 2 - x,
    dy = b.top + b.height / 2 - y;
  let el = document.createElement("div");
  el.className =
    "fx-beam " +
    (type === "heal"
      ? "heal"
      : type === "block"
        ? "block"
        : type === "magic"
          ? "magic"
          : "");
  el.style.left = x + "px";
  el.style.top = y + "px";
  el.style.width = Math.hypot(dx, dy) + "px";
  el.style.transform = "rotate(" + Math.atan2(dy, dx) + "rad)";
  if (impact.critical) {
    for (let hit = 0; hit < 4; hit++)
      setTimeout(() => {
        burst(to, "damage", 16);
        burst(to, "paper", 9);
        shakeElement(to, 4 + hit);
        impactFlash(to, hit);
      }, hit * 65);
  }
  if (impact.critical || impact.lethal) {
    el.classList.add(impact.lethal ? "lethal" : "critical-hit");
    if (impact.critical) el.classList.add("critical-hit");
    el.dataset.impact = impact.lethal ? "lethal" : "critical";
    shakeElement(to, impact.lethal ? 9 : 7);
    shakeBook(impact.lethal ? 5 : 4);
    burst(to, "damage", impact.lethal ? 42 : 30);
    burst(from, "paper", 15);
  }
  document.body.append(el);
  setTimeout(() => el.remove(), 550);
}
function setSkip(value) {
  setPace(value ? "skip" : "1");
}

let stageResolver = null,
  shopResolver = null;
function pace() {
  return skip ? 1 : Number(state?.speed) || 1;
}
function feedbackPause(ms) {
  return Production.input.delay(ms);
}
function setPace(value) {
  if (!["1", "2", "3", "5", "skip"].includes(String(value))) return;
  state.speed = String(value);
  skip = state.speed === "skip";
  $("#animation-speed").value = state.speed;
  $("#autoresolve").checked = !!state.autoresolve;
  document.body.classList.toggle("skip-cinematics", skip);
  document.body.style.setProperty("--speed", pace());
  if (skip) for (let a of liveAnimations) if (!a.juice) a.cancel();
  save();
}
function weightedPick(faces, random = Math.random) {
  let sum = faces.reduce((n, s) => n + (s.weight || 1), 0),
    n = random() * sum;
  for (let face of faces) {
    n -= face.weight || 1;
    if (n < 0) return face;
  }
  return faces.at(-1);
}
function eventChoice(choices) {
  $("#stage-actions").innerHTML = choices
    .map(
      (c) =>
        `<button class="${c.value ? "primary" : ""}" id="${c.id}" data-stage-choice="${String(c.value)}">${escapeHTML(c.label)}</button>`,
    )
    .join("");
  fitDialogs();
  return new Promise((resolve) => {
    stageResolver = resolve;
    $("#stage-actions button")?.focus();
  });
}
function renderBlock() {
  $("#block").innerHTML =
    icon("block") +
    `<strong>${state.block}</strong><span>TEAM BLOCK<small>All heroes · this battle</small></span>`;
  $("#block").setAttribute(
    "aria-label",
    state.block + " team block. Shared by every hero; expires after battle.",
  );
}
const ARTEFACT_TYPES = structuredClone(BALANCE.artefacts);
function makeArtefact(depth) {
  let t = pick(ARTEFACT_TYPES);
  return {
    id: "artefact-" + ++state.artefactSerial,
    name:
      t.name +
      " · " +
      ["I", "II", "III", "IV"][
        Math.min(
          balanceValue("makeArtefact.name.1"),
          Math.floor((depth - 1) / balanceValue("makeArtefact.name.2")),
        )
      ],
    key: t.key,
    power: Math.ceil(t.base + depth * t.scale),
    depth,
  };
}
function passive(key) {
  let a = state.artefacts.find((a) => a.id === state.equippedArtefact);
  return a?.key === key && key !== "revive" ? a.power : 0;
}
function artefactText(a) {
  return {
    revive: `Keep in your pack. Consume once to bring a fallen companion back at ${Math.round(BALANCE.rules.reviveHealthFraction * 100)}% health.`,
    attack: `+${a.power} damage when a hero rolls attack.`,
    heal: `+${a.power} healing when a hero rolls heal.`,
    block: `+${a.power} team block when a hero rolls shields.`,
    gold: `+${a.power}% gold from chests and battle spoils.`,
    guard: `Start every battle with ${a.power} shared team block.`,
  }[a.key];
}
function artefactButton(a) {
  return a.key === "revive"
    ? '<small class="revive-ready">Ready in your pack · no slot needed</small>'
    : `<button class="small" data-equip="${a.id}">${state.equippedArtefact === a.id ? "Equipped" : "Equip instead"}</button>`;
}
function renderArtefactSlot() {
  let a = state.artefacts.find((a) => a.id === state.equippedArtefact);
  $("#relic-status").innerHTML =
    `<button class="artefact-slot" id="artefact-slot" ${busy ? "disabled" : ""}>${icon("artefact")}<span>${a ? escapeHTML(a.name) : "Empty artefact slot"}<small>${a ? artefactText(a) : "Rare finds. One passive bonus at a time."}</small><em>${state.artefacts.length ? "Inspect / swap · " + state.artefacts.length + " owned" : "Very rarely found in loot"}</em></span></button>`;
}
function equipArtefact(id) {
  if (!state.artefacts.some((a) => a.id === id && a.key !== "revive")) return;
  state.equippedArtefact = id;
  renderArtefactSlot();
  document.querySelectorAll("[data-equip]").forEach((b) => {
    b.textContent = b.dataset.equip === id ? "Equipped" : "Equip instead";
  });
  save();
  toast("Artefact equipped. Its passive bonus is active.");
}
function inspectArtefacts() {
  if (busy || state.over) return;
  openModal(
    "A little power in the paper",
    `<p>Only one artefact is active at a time. Swapping is free; its bonus applies to future rolls. The power of a find scales with the floor where it was discovered.</p>${state.artefacts.length ? state.artefacts.map((a) => `<div class="artefact-card">${icon("artefact")}<div><b>${escapeHTML(a.name)}</b><p>Found on floor ${a.depth}. ${artefactText(a)}</p>${artefactButton(a)}</div></div>`).join("") : "<p>The slot is empty. Artefacts appear very rarely in chests and the spoils of defeated enemies.</p>"}<div class="modal-actions"><button class="primary" data-close>Keep walking</button></div>`,
    "artefacts",
  );
}
function lootFaces() {
  return [
    ...structuredClone(BALANCE.loot.coins),
    { type: "point", tier: 1, weight: BALANCE.loot.pointWeight },
    ...Object.keys(ITEM_DEFS).map((type) => ({
      type,
      tier: 1,
      weight: BALANCE.loot.itemWeight / Object.keys(ITEM_DEFS).length,
    })),
    { type: "artefact", tier: 1, weight: BALANCE.loot.artefactWeight },
  ];
}
async function recruitEncounter() {
  state.recruitPity = 0;
  state.recruitFoundThisFloor = true;
  let job = state.party.some((h) => h.job === "healer")
      ? pick(["rogue", "fighter", "mage"])
      : pick(["healer", "healer", "rogue", "mage"]),
    name = uniqueRecruitName(job),
    h = prepareRecruit(makeHero(name, job)),
    full = state.party.length >= BALANCE.rules.maxParty,
    quote = {
      fighter: "I’ll take the first hit. You keep the light.",
      healer: "I can mend more than torn pages.",
      rogue: "You look like you could use a quieter blade.",
      mage: "There is still a spark in these old pages.",
    }[job];
  showSpotlight(
    "A wandering adventurer",
    `${h.name} · ${job === "fighter" ? "Tank" : job[0].toUpperCase() + job.slice(1)}`,
    `<div class="stage-art">${portraitArt(job, h)}</div><p class="encounter-quote">“${quote}”</p><div class="stage-result">${h.maxHp} HP · level ${h.level} · ${job === "healer" ? "Healing specialist" : job === "fighter" ? "Damage & team protection" : job === "mage" ? "Magic, poison & stimulants" : "Damage & poison"}<br>${full ? "Three companions already share your torch. You may invite a replacement." : "Invite them to join your company?"}</div>`,
    "recruit",
  );
  let yes = await eventChoice([
    { id: "recruit-accept", label: "Invite " + h.name, value: true },
    {
      id: "recruit-decline",
      label: "Wish them safe travels",
      value: false,
    },
  ]);
  let replacement = -1;
  if (yes === "true" && full) {
    showSpotlight(
      "Make room by the torch",
      h.name + " can join if someone steps away.",
      `<div class="replacement-grid">${state.party.map((member, i) => `<article>${portraitArt(member.job, member)}<b>${member.name}</b><small>${className(member.job)} · Lv.${member.level} · ${member.hp}/${member.maxHp} HP</small><button data-stage-choice="replace:${i}">Let ${member.name} rest</button></article>`).join("")}</div>`,
      "recruit-swap",
    );
    const swap = await eventChoice([
      {
        id: "recruit-decline",
        label: "Keep the current party",
        value: false,
      },
    ]);
    if (swap.startsWith("replace:")) replacement = Number(swap.slice(8));
    else yes = "false";
  }
  closeSpotlight();
  if (
    yes === "true" &&
    (state.party.length < BALANCE.rules.maxParty || replacement >= 0)
  ) {
    if (replacement >= 0) {
      const old = state.party.splice(replacement, 1)[0];
      state.retired ??= [];
      state.retired.push({
        ...old,
        retiredAt: Date.now(),
        stepsWithParty: state.steps - (old.joinedSteps || 0),
      });
      if (old.equipment)
        state.pendingItems.push({ type: old.equipment, count: 1 });
      log(
        old.name +
          " leaves the expedition alive. Their story is kept in the notebook.",
      );
    }
    h.joinedAt = Date.now();
    h.joinedSteps = state.steps;
    state.party.push(h);
    log(`${h.name} the ${job === "fighter" ? "tank" : job} joins the company.`);
    renderParty();
    sayHero(state.party.length - 1, "idle");
    result(icon("recruit") + h.name + " joins the company.");
    if (state.pendingItems.length) await processPendingItems();
  } else {
    log(`The company wishes ${h.name} safe travels.`);
    result(icon("recruit") + " A brief meeting in the margins.");
  }
}
async function shopEncounter(c) {
  if (!c.shop) {
    c.shop = { potion: 1, bomb: 1, ward: 1, heal: 1, reveal: 1 };
    const extra = Object.keys(ITEM_DEFS).filter(
      (t) => !["potion", "bomb", "ward"].includes(t),
    );
    for (let i = 0; i < 2; i++)
      c.shop[extra.splice(rand(extra.length), 1)[0]] = 1;
  }
  shopCell = c;
  drawShop();
  await new Promise((resolve) => (shopResolver = resolve));
  shopCell = null;
}
let shopCell = null;
function shopPrices() {
  return {
    ...Object.fromEntries(
      Object.keys(ITEM_DEFS).map((type) => [
        type,
        balanceValue("shopPrices.coefficient.1") +
          state.depth * balanceValue("shopPrices.coefficient.2"),
      ]),
    ),
    potion:
      balanceValue("shopPrices.potion.1") +
      state.depth * balanceValue("shopPrices.potion.2"),
    bomb:
      balanceValue("shopPrices.bomb.1") +
      state.depth * balanceValue("shopPrices.bomb.2"),
    ward:
      balanceValue("shopPrices.ward.1") +
      state.depth * balanceValue("shopPrices.ward.2"),
    heal:
      balanceValue("shopPrices.heal.1") +
      state.depth * balanceValue("shopPrices.heal.2"),
    reveal:
      balanceValue("shopPrices.reveal.1") +
      state.depth * balanceValue("shopPrices.reveal.2"),
  };
}
function drawShop() {
  let prices = shopPrices(),
    labels = {
      ...Object.fromEntries(
        Object.entries(ITEM_DEFS).map(([key, item]) => [
          key,
          item.name + " · " + item.brief,
        ]),
      ),
      potion: "Healing tonic · restore 16 HP",
      bomb: "Ink bomb · damage an enemy",
      ward: "Paper ward · 5 team block",
      heal: "Full heal · every living hero",
      reveal: "Old map · reveal the stairs",
    },
    c = shopCell;
  openModal(
    "A shop between the lines",
    `<div class="shop-keeper">${portraitArt("rogue")}<p>“No credit. No refunds.<br>Do try to remain alive.”<br><b>${state.gold} gold</b> in the satchel.</p></div><div class="shop-offers">${Object.keys(
      c.shop,
    )
      .map(
        (key) =>
          `<button data-buy="${key}" ${!c.shop[key] || state.gold < prices[key] || (key === "reveal" && state.exitFound) ? "disabled" : ""}>${icon(key === "heal" ? "well" : key === "reveal" ? "stairs" : key === "potion" ? "potion" : ITEM_DEFS[key]?.icon || "ward")}<span>${labels[key]}<small>${!c.shop[key] ? "Sold out" : key === "reveal" && state.exitFound ? "Stairs already marked" : prices[key] + " gold · one in stock"}</small></span></button>`,
      )
      .join(
        "",
      )}</div><div class="modal-actions"><button class="primary" data-close>Leave the shop</button></div>`,
    "shop",
  );
}
let shopPurchasePending = false;
async function buyShop(key) {
  if (
    shopPurchasePending ||
    modalKind !== "shop" ||
    !shopCell ||
    !Object.hasOwn(shopPrices(), key)
  )
    return;
  let price = shopPrices()[key];
  if (
    !shopCell.shop[key] ||
    state.gold < price ||
    (key === "reveal" && state.exitFound)
  )
    return;
  state.gold -= price;
  shopCell.shop[key]--;
  if (ITEM_DEFS[key]) {
    shopPurchasePending = true;
    const overflow =
      !state.bag[key] &&
      Object.keys(state.bag).length >= BALANCE.rules.bagTypes;
    if (overflow) $("#overlay").hidden = true;
    state.pendingItems.push({ type: key, count: 1 });
    save();
    await processPendingItems();
    if (overflow) $("#overlay").hidden = false;
    shopPurchasePending = false;
  }
  if (key === "heal") state.party.forEach((h, i) => healHero(i, h.maxHp));
  if (key === "reveal") {
    let i = state.map.findIndex((c) => c.event === "stairs");
    if (i >= 0) {
      markSeen(i);
      renderMap();
    }
  }
  log(
    `The shop sells ${key === "reveal" ? "a map to the stairs" : key === "heal" ? "a full team heal" : key} for ${price} gold.`,
  );
  render();
  drawShop();
  if (key === "reveal") {
    $("#modal-title").textContent = "The stairway is marked!";
    announceStairs();
    animate(
      $("#modal-title"),
      [
        { transform: "scale(.9)" },
        { transform: "scale(1.09)", color: "#ba8840" },
        { transform: "scale(1)" },
      ],
      { duration: 1100, juice: true },
    );
  }
  save();
  burst($("#modal"), "coin", Math.min(price, 30));
}
function healingFX(el) {
  if (!el) return;
  animate(
    el,
    [
      { backgroundColor: "#dbe8b6", boxShadow: "0 0 0 0 #66854d66" },
      {
        backgroundColor: "#8fb16b99",
        boxShadow: "0 0 20px 8px #7d9c5d66",
      },
      { backgroundColor: "#e5ddc8", boxShadow: "0 0 0 16px #7d9c5d00" },
    ],
    { duration: 700, juice: true },
  );
  for (let j = 0; j < 4; j++) {
    let r = el.getBoundingClientRect(),
      n = document.createElement("span");
    n.className = "healing-glyph";
    n.innerHTML = icon("heal");
    n.style.left = r.left + r.width * (0.15 + 0.22 * j) + "px";
    n.style.top = r.top + r.height * (0.6 - 0.1 * (j % 2)) + "px";
    n.style.animationDelay = j * 70 + "ms";
    document.body.append(n);
    setTimeout(() => n.remove(), 1100);
  }
}
const HERO_LINES = {
  mage: {
    attack: ["Light the margins.", "A spark will do."],
    hurt: ["Mind the robes!"],
    panic: ["The spark is fading!"],
    block: ["Still a little fire."],
    relief: ["Warmth again."],
    idle: ["One spark left.", "The ink remembers spells."],
  },
  fighter: {
    attack: ["Behind me!", "Steel first!", "Hold the line!"],
    hurt: ["Just a dent.", "Armour, hold!"],
    panic: ["That one got through!", "A healer, perhaps?!"],
    block: ["Not one of you gets past.", "Stay behind the shield!"],
    relief: ["Still standing.", "Much better."],
    idle: [
      "Anyone else hear that?",
      "I miss chairs.",
      "This map needs a bigger sword.",
    ],
  },
  healer: {
    attack: ["Forgive the mess.", "A sharp lesson."],
    hurt: ["I could use a hand!", "Careful with the hands!"],
    panic: ["I cannot mend that twice!", "Someone, please!"],
    block: ["A little protection."],
    relief: ["Breathe. We’re alright."],
    idle: [
      "Hold still. You’re bleeding.",
      "Even the dark needs tending.",
      "I packed bandages. Not optimism.",
    ],
  },
  rogue: {
    attack: ["Never saw me.", "Your margin’s showing.", "Quick and quiet."],
    hurt: ["Rude.", "That was my good side."],
    panic: ["I vote we move!", "A little help here?!"],
    block: ["Missed me."],
    relief: ["Nearly like new."],
    idle: [
      "That chest is looking at me.",
      "I hear a very expensive silence.",
      "Quiet feet. Loud thoughts.",
    ],
  },
};
function enemyLine(e, mood) {
  let lines = {
    gnawer: {
      entrance: ["Snff. Warm wax."],
      attack: ["Krrr-CHOMP!"],
      hurt: ["Skree!"],
      defeat: ["Fssst…"],
    },
    bellkeeper: {
      entrance: ["The bell has called your name."],
      attack: ["TOLL!"],
      hurt: ["A cracked note."],
      defeat: ["Silence…"],
    },
    widow: {
      entrance: ["Another thread in my web."],
      attack: ["Stay still, little fly."],
      hurt: ["Hisss!"],
      defeat: ["The thread breaks…"],
    },
    oracle: {
      entrance: ["I have already seen you fall."],
      attack: ["Your ending approaches."],
      hurt: ["An unwelcome future!"],
      defeat: ["I did not see this…"],
    },
    pageeater: {
      entrance: ["Your story smells sweet."],
      attack: ["RIP. CHEW. SWALLOW."],
      hurt: ["Bitter ink!"],
      defeat: ["No more pages…"],
    },
    pursuer: {
      entrance: ["Every footstep brought me closer."],
      attack: ["No further."],
      hurt: ["Still I follow."],
      defeat: ["The trail… ends."],
    },
    revenant: {
      entrance: ["The chains are hungry."],
      attack: ["RUST AND RUIN!"],
      hurt: ["The links remember."],
      defeat: ["Unbound…"],
    },
    demon: {
      entrance: ["Your torch burns cold."],
      attack: ["BURN!"],
      hurt: ["Ash and spite!"],
      defeat: ["Cinders…"],
    },
    lich: {
      entrance: ["Your pulse is overdue."],
      attack: ["Become a footnote."],
      hurt: ["Mortal ink!"],
      defeat: ["My final word…"],
    },
    abomination: {
      entrance: ["So many hearts. So little time."],
      attack: ["BREAK. THEM."],
      hurt: ["MORE THREAD!"],
      defeat: ["Unstitched…"],
    },
    mimic: {
      entrance: ["Just a little closer…"],
      attack: ["CHOMP!"],
      hurt: ["Splinters!"],
      defeat: ["Crrreak…"],
    },
    rat: {
      entrance: ["Skkrit. Mine!"],
      attack: ["Skkree!", "Bite. Bite!"],
      hurt: ["Krrrk!"],
      defeat: ["Squeee…"],
    },
    ghost: {
      entrance: ["You will be a footnote."],
      attack: ["Fade with me.", "Your last word…"],
      hurt: ["You tear my story!"],
      defeat: ["Unwritten…"],
    },
    slime: {
      entrance: ["Blorp?"],
      attack: ["GLORP!", "Plip. Plop."],
      hurt: ["Blip?!"],
      defeat: ["…plip."],
    },
    skull: {
      entrance: ["Clack. Clack."],
      attack: ["RATTLE!", "Krrr… clack!"],
      hurt: ["Crack?!"],
      defeat: ["Clatter…"],
    },
  };
  return visualPick(lines[e.art]?.[mood] || ["…"]);
}
function speech(el, line) {
  if (!el || document.hidden) return;
  let id = el.id;
  if (id)
    document.querySelectorAll(".speech-bubble").forEach((n) => {
      if (n.dataset.speaker === id) n.remove();
    });
  let r = el.getBoundingClientRect();
  if (r.bottom < 0 || r.top > innerHeight) return;
  let node = document.createElement("span");
  node.className = "speech-bubble";
  node.dataset.speaker = id;
  node.textContent = line;
  node.style.left =
    Math.min(innerWidth - 105, Math.max(105, r.left + r.width / 2)) + "px";
  node.style.top = Math.max(12, r.top - 15) + "px";
  document.body.append(node);
  setTimeout(() => node.remove(), 2200);
}
let lastPartySpeechAt = 0;
function sayHero(i, mood) {
  let h = state.party[i];
  if (!h || (!alive(h) && mood !== "panic")) return;
  let now = Date.now();
  if (
    (mood === "idle" && now - lastPartySpeechAt < 7000) ||
    now - (h.lastQuipAt || 0) < 15000 ||
    fxRandom() > (mood === "panic" ? 0.75 : mood === "idle" ? 1 : 0.22)
  )
    return;
  h.lastQuipAt = now;
  lastPartySpeechAt = now;
  speech(
    $("#portrait-" + i),
    visualPick(HERO_LINES[h.job]?.[mood] || ["Keep going."]),
  );
}
function sayEnemy(mood) {
  if (!(actingEnemy || state.enemy)) return;
  let e = actingEnemy || state.enemy,
    now = Date.now();
  if (now - (e.lastQuipAt || 0) < 16000 || fxRandom() > 0.25) return;
  e.lastQuipAt = now;
  speech(enemyArtEl(e), enemyLine(e, mood));
}
function idleChatter() {
  if (
    !state ||
    busy ||
    state.enemy ||
    state.over ||
    document.hidden ||
    !$("#overlay").hidden ||
    !$("#spotlight").hidden
  )
    return false;
  let living = state.party
    .map((h, i) => (h.hp > 0 ? i : -1))
    .filter((i) => i >= 0);
  if (!living.length) return false;
  sayHero(visualPick(living), "idle");
  return true;
}

function tileDistance(a, b = state.position) {
  return Math.max(
    Math.abs((a % W) - (b % W)),
    Math.abs(Math.floor(a / W) - Math.floor(b / W)),
  );
}
const FOG_DELAY = balanceValue("world.ambushAgeMs");
function isStale(c) {
  return !!(c.seen && !c.wall && c.fogged);
}
function canExplore() {
  return (
    !!state &&
    !state.over &&
    !Production.input.paused &&
    !state.enemy &&
    (!busy || !!travel) &&
    $("#overlay").hidden &&
    $("#spotlight").hidden &&
    !document.hidden
  );
}
let exploreTickAt = performance.now(),
  exploreWasAllowed = false;
function refreshStaleMap(now = performance.now()) {
  const delta = Math.max(0, Math.min(1000, now - exploreTickAt));
  exploreTickAt = now;
  if (!state || !canExplore()) {
    exploreWasAllowed = false;
    return false;
  }
  if (exploreWasAllowed) state.exploreTime = (state.exploreTime || 0) + delta;
  exploreWasAllowed = true;
  let changed = false;
  state.map.forEach((c, i) => {
    if (!c.seen || c.wall) {
      c.fogged = false;
      return;
    }
    if (!c.fogged) {
      if (tileDistance(i) <= 1 || c.fogSince == null)
        c.fogSince = state.exploreTime;
      else if (state.exploreTime - c.fogSince >= FOG_DELAY) {
        c.fogged = true;
        changed = true;
      }
    }
  });
  return changed;
}
function smokePoof(el, big = false) {
  burst(el, "smoke", big ? 68 : 32);
}
function clearFogAfterVictory() {
  const cleared = [];
  for (const i of neighbors(state.position, true)) {
    const c = state.map[i];
    if (!c.seen || !c.fogged || c.wall) continue;
    c.fogged = false;
    c.fogSince = state.exploreTime || 0;
    cleared.push(i);
    smokePoof($(`[data-tile="${i}"]`));
  }
  smokePoof($(`[data-tile="${state.position}"]`), true);
  state.lastFogClear = cleared;
  refreshStaleMap();
  log("The nearby passages are quiet again.");
}
function announceStairs() {
  animate(
    $("#floor-tag"),
    [
      { transform: "scale(.96)" },
      { transform: "scale(1.14)", color: "#aa7133" },
      { transform: "scale(1)" },
    ],
    { duration: 900, juice: true },
  );
  animate(
    $("#exit-found"),
    [{ boxShadow: "0 0 0 0 #c6a14b99" }, { boxShadow: "0 0 0 12px #c6a14b00" }],
    { duration: 1000, juice: true },
  );
  actionLabel($("#floor-tag"), "STAIRS MARKED ON YOUR MAP");
  burst($("#floor-tag"), "gold", 32);
}
async function ruinEncounter(c) {
  showSpotlight(
    "Ruins below the ink",
    "A forgotten structure. Greed and danger share a wheel.",
    `<div class="stage-art">${icon("ruin")}</div><div class="stage-result">An old mechanism guards whatever remains.<br>Examine it, or leave it untouched.</div>`,
    "ruin",
  );
  const choice = await eventChoice([
    { id: "ruin-examine", label: "Examine the ruins", value: true },
    { id: "ruin-leave", label: "Leave them untouched", value: false },
  ]);
  if (choice !== "true") {
    closeSpotlight();
    return false;
  }
  const faces = BALANCE.eventReels.ruin.faces;
  showSpotlight(
    "The ruin’s mechanism",
    "A glint of gold. A click beneath the dust.",
    `${drawMachine("ruin", faces.slice(0, 3), { title: "Loot against danger" })}${criticalSpace()}<div class="stage-result" id="ruin-result">Ancient gears turn…</div>`,
    "ruin",
  );
  const symbols = await runMachine("ruin", [faces, faces, faces]),
    baseGold = symbols
      .filter((s) => s.type === "coin")
      .reduce(
        (n, s) =>
          n +
          s.tier *
            (balanceValue("ruinEncounter.baseGold.1") +
              state.depth * balanceValue("ruinEncounter.baseGold.2")),
        0,
      ),
    baseDamage = Math.ceil(
      symbols
        .filter((s) => s.type === "trap")
        .reduce((n, s) => n + s.tier * trapPower(state.depth), 0),
    ),
    multiplier = await rollCritical("Ruin mechanism", symbols, false, {
      context: "ruin",
      details: [
        { label: "Gold", icon: "coin", value: baseGold },
        { label: "Trap damage", icon: "trap", value: baseDamage },
      ],
    }),
    gold = Math.ceil(baseGold * multiplier),
    damage = Math.ceil(baseDamage * multiplier);
  $("#ruin-result").innerHTML =
    `<b>+${gold} gold</b> · ${damage} incoming damage<br>Gold in the rubble. Watch your step.`;
  state.lastRuinRoll = { symbols, gold, damage, multiplier };
  if (gold) goldCelebration(gold, multiplier > 1);
  await eventChoice([
    {
      id: "stage-confirm",
      label: "Gather what remains ↗",
      value: true,
    },
  ]);
  closeSpotlight();
  state.gold += gold;
  c.event = null;
  c.feature = "ruin";
  if (damage) {
    damageHero(
      state.party.findIndex(alive),
      damage,
      "An ancient ruin mechanism",
    );
    await feedbackPause(350);
    await processDeaths();
    checkDefeat();
  }
  log(`The ruins yield ${gold} gold and ${damage} trap damage.`);
  return true;
}
function horrorArt(kind, h) {
  if (h.hp <= 0) return corpseArt(kind);
  const red = h.hp / h.maxHp < 0.35 ? "#a15a4c" : "#6f3f36",
    hatched =
      '<pattern id="horror-hatch-' +
      ++artSerial +
      '" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M0 5 5 0" stroke="#73604d" stroke-width=".7"/></pattern>',
    fill = `url(#horror-hatch-${artSerial})`;
  let shape =
    kind === "demon"
      ? `<path d="M21 48 6 13l31 21M84 35l27-27-10 42M27 58 16 94 3 111l16 11 18-23 8 37m31 0 8-40 18 28 16-14-18-25-8-29" fill="${fill}"/><path d="m29 29 34-12 32 22-7 43-28 19-30-23z" fill="#c2ad91"/><path d="m35 46 23 11-17 7zm47-3-20 15 18 4z" fill="${red}"/><path d="m45 74 30-3-8 15-18-2z M49 72l3 11m8-12 1 13m7-13-1 12M53 27l8 14 9-17M60 96v42m-16-30 17 8 17-12M24 140h68"/>`
      : kind === "lich"
        ? `<path d="m10 144 19-77-9-37 30-28 37 3 22 31-15 36 16 72-29-12-20 16-20-15z" fill="${fill}"/><path d="M35 39Q57 8 84 38l-3 35-22 20-24-17z" fill="#d4c5a6"/><path d="m39 46 17 4-6 15-12-6zm39-2-17 8 7 13 13-10z" fill="${red}"/><path d="m59 57-6 15 12-1M43 77l33-3m-29-2 2 12m9-12v13m11-14-1 12M32 93l29 11 28-14M18 115l23-10m42 2 21 9M31 29l-6-10m72 11 9-12M9 131 4 58m-4 3 12-1M56 110l6 22 7-23"/>`
        : kind === "revenant"
          ? `<path d="M17 145 24 83l19-13 35-2 24 19 4 58z" fill="${fill}"/><path d="M37 30 50 9l29 7 14 25-11 36-39 2-12-21z" fill="#c4b295"/><path d="m42 36 20 11 20-8-3 18-16 8-23-10z" fill="#685446"/><path d="m41 26 38 5M49 12l6 17m12-15 4 17M46 64l-6 12 20 12 24-12M28 91l31 21 36-20M37 97l-5 27 22 13 27-11-1-26M24 87l-13 35m82-34 17 37M45 108q-17 7-2 18 16-10-1-18m17 10q-17 7-2 18 16-10-1-18m17-22q-17 7-2 18 16-10-1-18"/>`
          : `<path d="M9 140Q-5 92 30 74L24 40 47 8l34 8 17 39-4 28q35 25 19 59z" fill="${fill}"/><path d="m29 41 23-20 29 8 13 28-18 31-33-4-17-23z" fill="#b8a08b"/><path d="m34 44 18 5-9 14-14-5zm44-1-17 12 16 11 12-15z" fill="${red}"/><path d="m41 70 35-4-8 16-18-3M32 32l56 31m-49-29-7 9m18-2-8 10m19-5-8 10m18-5-8 10M23 88l75 35m-65-30-6 14m20-7-5 13m20-7-5 13m21-8-5 13M17 107l-8 21m90-25 14 27M20 143h85"/>`;
  return `<svg class="horror-art" data-horror="${kind}" viewBox="0 0 120 150" fill="none" stroke="#58473c" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><defs>${hatched}</defs>${shape}</svg>`;
}

let actingEnemy = null;
function battleEnemies() {
  if (!state.enemy) return [];
  if (!state.enemies?.length || !state.enemies.includes(state.enemy))
    state.enemies = [state.enemy];
  return state.enemies;
}
function livingEnemies() {
  return battleEnemies().filter((e) => e.hp > 0);
}
function enemyArtEl(e = actingEnemy || state.enemy) {
  return $(battleEnemies().indexOf(e) > 0 ? "#enemy-art-2" : "#enemy-art");
}
function enemyMachine(e) {
  return battleEnemies().indexOf(e) > 0 ? "enemy-2" : "enemy";
}
function className(job) {
  return BALANCE.classes[job]?.name || job;
}
function healthMarkup(h, extra = "") {
  const fraction = h.hp / h.maxHp,
    tone =
      fraction <= 0.25
        ? "critical"
        : fraction <= 0.4
          ? "red"
          : fraction <= 0.65
            ? "yellow"
            : "green";
  return `<div class="healthbar hp-bar ${tone} ${extra}" aria-label="${h.hp} of ${h.maxHp} health"><i style="width:${Math.max(0, fraction * 100)}%"></i></div>`;
}
function selectEnemy(id) {
  if (busy || !state.enemy) return;
  const e = battleEnemies().find(
    (e) => String(e.id) === String(id) && e.hp > 0,
  );
  if (e) {
    state.enemy = e;
    renderEncounter();
    renderTargets();
    save();
  }
}

function readSettings() {
  try {
    return (
      JSON.parse(localStorage.getItem("scratchpad-dungeon-settings")) || {}
    );
  } catch {
    return {};
  }
}
function setPalette(value) {
  if (!["default", "dark", "warm"].includes(value)) return;
  state.palette = value;
  document.body.dataset.palette = value;
  $("#palette").value = value;
  save();
}
function fitText(el, max = 20, min = 11) {
  if (Production.ui.isDeck()) min = Math.max(min, 12);
  if (!el || !el.clientHeight || !el.clientWidth) return;
  const overflows = () => {
    if (
      el.scrollHeight > el.clientHeight + 1 ||
      el.scrollWidth > el.clientWidth + 1
    )
      return true;
    if (el.tagName !== "H2") return false;
    const range = document.createRange();
    range.selectNodeContents(el);
    const text = range.getBoundingClientRect(),
      box = el.getBoundingClientRect();
    return (
      text.top < box.top - 1 ||
      text.bottom > box.bottom + 1 ||
      text.left < box.left - 1 ||
      text.right > box.right + 1
    );
  };
  el.style.fontSize = max + "px";
  for (let size = max; size > min && overflows(); size--)
    el.style.fontSize = size - 1 + "px";
}
let fittingUI = false;
function requestFitUI() {
  if (fittingUI) return;
  fittingUI = true;
  requestAnimationFrame(() => {
    fittingUI = false;
    fitDialogs();
    fitText($("#result-ribbon"), 20, 11);
    fitText($("#field-note"), 18, 11);
    fitText($("#hover-name"), 16, 10);
    fitText($("#map-status"), 16, 11);
  });
}
function fitDialogs() {
  const top = Math.max(
      10,
      Math.min(130, $(".desk-top").getBoundingClientRect().bottom + 10),
    ),
    bottom = $("#keyboard-bar").offsetHeight + 14,
    available = Math.max(240, innerHeight - top - bottom);
  for (const [selector, flow, title] of [
    ["#spotlight", ".scene-layout", "#stage-title"],
    ["#overlay", ".modal-flow", "#modal-title"],
  ]) {
    const layer = $(selector);
    if (layer.hidden) continue;
    layer.style.paddingTop = top + "px";
    layer.style.paddingBottom = bottom + "px";
    const panel = layer.firstElementChild;
    panel.style.height = Math.min(790, available) + "px";
    fitText($(title), innerWidth <= 760 ? 29 : 38, 15);
    if (selector === "#spotlight")
      fitText(
        $("#stage-card > .stage-subtitle"),
        innerWidth <= 760 ? 15 : 17,
        11,
      );
    const content = panel.querySelector(flow),
      holder = content?.parentElement;
    if (!content || !holder) continue;
    content.style.zoom = "1";
    content.style.width = holder.clientWidth + "px";
    const padding = getComputedStyle(holder),
      usableHeight =
        holder.clientHeight -
        parseFloat(padding.paddingTop) -
        parseFloat(padding.paddingBottom) -
        2,
      height = content.offsetHeight,
      width = content.scrollWidth,
      scale = Math.min(
        1,
        usableHeight / Math.max(1, height),
        holder.clientWidth / Math.max(1, width),
      );
    content.style.zoom = Math.max(0.15, scale).toFixed(4);
  }
}
function updateKeyboardBar() {
  if (Production.input?.device === "gamepad") {
    $("#keyboard-bar").innerHTML = Production.input.prompts();
    return;
  }
  const event = !$("#spotlight").hidden || !$("#overlay").hidden;
  $("#keyboard-bar").innerHTML = event
    ? "<span><kbd>Tab</kbd> / <kbd>Shift Tab</kbd> choose</span><span><kbd>Enter</kbd> confirm highlighted button</span><span><kbd>Space</kbd> / <kbd>Esc</kbd> land reels</span><span><kbd>T</kbd> pace · <kbd>C</kbd> palette</span><span>Mouse: click buttons or rolling reels</span>"
    : "<span><kbd>WASD</kbd> / <kbd>↑↓←→</kbd> move</span><span><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> spin hero · <kbd>Shift 1–3</kbd> heal target</span><span><kbd>[</kbd><kbd>]</kbd> damage target · <kbd>E</kbd> edit</span><span><kbd>P</kbd> tonic · <kbd>B</kbd> bomb · <kbd>V</kbd> ward · <kbd>X</kbd> stairs · <kbd>R</kbd> revisit</span><span><kbd>F</kbd> guide · <kbd>T</kbd> pace · <kbd>C</kbd> palette · <kbd>M</kbd> log</span><span><kbd>Tab</kbd> / <kbd>Enter</kbd> navigate all controls · Mouse: click tile, portrait or handle</span>";
}
function keyboardShortcut(e) {
  return Production.input.handleKeyboard(e);
}

function corpseArt(kind) {
  return Production.assets.render("corpse." + kind, null, () =>
    builtinCorpseArt(kind),
  );
}
function builtinCorpseArt(kind) {
  const animal = kind === "rat",
    spectral = kind === "ghost",
    blob = kind === "slime";
  const remains =
    kind === "mimic"
      ? '<path d="m10 118 19-22 34 13 32-12 16 25-37 19-49-4z" fill="#ad9872"/><path d="m18 116 36 15 50-12M29 98l20 18 16-5 27-11M26 117l10 9 8-8 9 13 8-8 10 11 9-12 10 5M16 142h92M53 107l7 20"/><path d="m39 103 6 4m-5 0 5-4m28 0 7 3m-7 0 7-3"/>'
      : animal
        ? '<path d="M22 119q-25 15-16-8m16 8q-7-34 33-34l30 6 22 20-12 17H38z" fill="#c6b99b"/><path d="m83 93 5-18 10 21M77 105l8 7m0-7-8 7M38 118l-9 14m30-10 8 12M95 114l12 4"/>'
        : spectral
          ? '<path d="m12 125 14-22 22 8 15-27 17 26 26-7-12 22-23 9-31-4z" fill="#d9cfb4"/><path d="m43 112 8 6m0-6-8 6m19-6 8 6m0-6-8 6M11 137h90"/>'
          : blob
            ? '<path d="M12 128q-8-13 22-14 5-17 25-7 21-16 28 6 30 3 20 18-51 10-95-3z" fill="#c3b392"/><path d="m43 116 8 7m0-7-8 7m18-7 8 7m0-7-8 7"/>'
            : `<path d="m9 135 16-7 22 4 20-8 25 6 19-5M42 116l17 6 28-13 13 7m-40 4 17 12 19-2M43 108l20-10 21 5-10 18-28 4z" fill="#cbbd9f"/><path d="m55 109 18 1m-15 8 12-12m-6-5 2 20M36 116l-12 14m38-8 17 13M9 143h102"/><ellipse cx="28" cy="110" rx="17" ry="16" fill="#e7dcc0"/><path d="m18 106 7 6m0-6-7 6m13-8 7 6m0-6-7 6M24 119h9"/>${kind === "fighter" || kind === "hero" ? '<path d="m12 102 7-11 19 2 9 13-9 7-25-2z M13 104l31 1M15 137l64-5m-63 1 1 8"/>' : kind === "skeleton" || kind === "skull" ? '<path d="m52 103 2 18m4-17 3 16m4-17 4 13m5-12 3 10M24 116h10m-7-2v7m4-7v7"/>' : '<path d="M10 110q-3-29 27-20l15 20-15 19H15z M15 113q5-28 22-14"/>'}`;
  return `<svg class="corpse-art" data-corpse="${kind}" viewBox="0 0 120 150" fill="none" stroke="#625343" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><ellipse cx="62" cy="133" rx="52" ry="8" fill="#80715b20"/>${remains}<path d="m11 145 14-1m74-2 13 1m-44-7 8 1" opacity=".55"/></svg>`;
}
function leaveCorpse(kind, name, enemy = false) {
  const cell = state.map[state.position];
  cell.corpses ??= [];
  cell.corpses.push({
    kind,
    name,
    enemy,
    id: "corpse-" + Date.now() + "-" + cell.corpses.length,
  });
  const corpse = cell.corpses.at(-1);
  renderMap();
  return corpse.id;
}
function shieldedFX(el) {
  if (!el) return;
  let r = el.getBoundingClientRect(),
    node = document.createElement("div");
  node.className = "shielded-overlay";
  node.dataset.target = el.id;
  node.innerHTML = icon("block") + "<b>SHIELDED</b>";
  node.style.left = r.left + r.width / 2 + "px";
  node.style.top = r.top + r.height / 2 + "px";
  node.style.width = Math.max(58, Math.min(115, r.width + 12)) + "px";
  document.body.append(node);
  setTimeout(() => node.remove(), 1050);
}
const tierName = (tier) => ["", "I", "II", "III", "IV"][tier];
const maxFaceTier = (type) =>
  ["attack", "magic"].includes(type) ? 4 : type === "class" ? 1 : 3;
function faceUpgradeCost(face) {
  return face.type === "blank"
    ? BALANCE.rules.blankInscriptionCost
    : face.tier < maxFaceTier(face.type)
      ? FACE_COST[face.tier + 1]
      : undefined;
}
function criticalSpace() {
  return '<div class="event-critical" id="event-critical"><span class="critical-placeholder">Fortune is listening.</span></div>';
}
function criticalMath(details, multiplier) {
  return (
    details
      .map(
        (d) =>
          `<div data-before="${d.value}" data-after="${Math.ceil(d.value * multiplier)}">${icon(d.icon || "stun")}<span>${escapeHTML(d.label)}<br><b>${d.value}</b> × ${multiplier} = <strong>${Math.ceil(d.value * multiplier)}</strong></span></div>`,
      )
      .join("") || "<div>Three safe marks. A spectacular escape.</div>"
  );
}
const DISCOVERY_HINTS = {
  ruin: ["draft", "A forgotten archway in the dark…"],
  stronghold: ["sound", "A monstrous heartbeat behind stone…"],
  enemy: ["sound", "A scratching sound behind the graphite…"],
  guardian: ["sound", "Something enormous is breathing…"],
  treasure: ["glimmer", "A glimmer catches the torchlight…"],
  trap: ["sound", "A tiny metallic click…"],
  well: ["water", "A gentle trickle of water…"],
  beacon: ["glimmer", "A warm light seeps through the paper…"],
  recruit: ["sound", "Quiet footsteps. Almost human…"],
  shop: ["sound", "The soft clink of traded coins…"],
  stairs: ["draft", "A cold draft rises from below…"],
  river: ["water", "Running water beyond the pencil…"],
  puddle: ["water", "A drop echoes in the darkness…"],
};
function maybeDiscoveryHint(from = state.position) {
  const room = state.map[from];
  if (
    room.hintChecked ||
    state.over ||
    state.enemy ||
    !room.visited ||
    (room.event && !["stairs", "shop"].includes(room.event))
  )
    return;
  room.hintChecked = true;
  if (Math.random() >= balanceValue("maybeDiscoveryHint.coefficient.1")) return;
  const candidates = neighbors(from, true).filter((i) => {
    const c = state.map[i];
    return !c.seen && !c.hint && DISCOVERY_HINTS[c.event || c.terrain];
  });
  if (!candidates.length) return;
  let i = pick(candidates),
    c = state.map[i],
    [kind, text] = DISCOVERY_HINTS[c.event || c.terrain];
  c.hint = { kind, text, atStep: state.steps };
  state.lastHint = { tile: i, ...c.hint };
  $("#field-note").textContent = text;
  log(
    `A hint from column ${(i % W) + 1}, row ${Math.floor(i / W) + 1}: ${text}`,
  );
  renderMap();
  const cell = $(`[data-tile="${i}"]`),
    r = cell.getBoundingClientRect(),
    note = document.createElement("div");
  note.className = "discovery-whisper";
  note.textContent = text;
  note.style.left =
    Math.max(90, Math.min(innerWidth - 90, r.left + r.width / 2)) + "px";
  note.style.top = Math.max(22, r.top) + "px";
  document.body.append(note);
  setTimeout(() => note.remove(), 4200);
}
function markTravelGoal(goal) {
  document
    .querySelectorAll(".travel-goal")
    .forEach((el) => el.classList.remove("travel-goal"));
  $(`[data-tile="${goal}"]`)?.classList.add("travel-goal");
}
function fitNotebook() {
  if (Production.ui.fit($(".desk"))) {
    positionPlayer(false);
    return;
  }
  const desk = $(".desk"),
    fit = innerWidth >= 1260 && innerHeight >= 560;
  desk.classList.toggle("fit-notebook", fit);
  if (!fit) {
    desk.style.removeProperty("--desk-scale");
    return;
  }
  const scale = Math.min(
    1.12,
    (innerWidth - 24) / 1800,
    (innerHeight - $("#keyboard-bar").offsetHeight - 16) / desk.offsetHeight,
  );
  desk.style.setProperty("--desk-scale", Math.max(0.35, scale).toFixed(4));
}

let travel = null,
  coinRain = null;
const alive = (h) => !!h && !h.dead && h.hp > 0;
function uniqueRecruitName(job) {
  const pools = {
      fighter: ["Bram", "Garran", "Osric", "Tove"],
      healer: ["Mira", "Elin", "Sera", "Nell"],
      rogue: ["Wren", "Rook", "Lys", "Pip"],
      mage: ["Ivo", "Aster", "Vey", "Rune"],
    },
    used = new Set(
      [...state.party, ...state.graveyard, ...(state.retired || [])].map(
        (h) => h.name,
      ),
    ),
    pool = pools[job];
  return pool.find((n) => !used.has(n)) || pool[0] + " " + (used.size + 1);
}
function emptyStats() {
  return {
    spins: 0,
    turnsMissed: 0,
    battles: 0,
    kills: 0,
    damageDealt: 0,
    damageTaken: 0,
    damageBlocked: 0,
    healingDone: 0,
    healingReceived: 0,
    xpEarned: 0,
    itemsUsed: 0,
    criticals: 0,
    levelsGained: 0,
  };
}
function initLife(h) {
  h.stats = { ...emptyStats(), ...h.stats };
  h.joinedAt ??= Date.now();
  h.joinedSteps ??= state.steps;
  h.origin ??= {
    depth: state.depth,
    tile: state.position,
    description: "A companion from an earlier page",
  };
  h.dead ??= h.hp <= 0;
  if (h.dead) h.hp = 0;
  if (h.hp <= 0 && !h.death) {
    h.dead = false;
    recordDeath(h, "Lost on an earlier page");
  }
}
function recordDeath(h, cause) {
  if (h.dead && h.death) return;
  Production.audio.play("sfx.death");
  h.dead = true;
  h.hp = 0;
  h.stun = 0;
  const record = {
    id: h.id,
    name: h.name,
    job: h.job,
    level: h.level,
    xp: h.xp,
    maxHp: h.maxHp,
    stats: { ...emptyStats(), ...h.stats },
    cause,
    points: h.points,
    equipment: h.equipment,
    reels: h.reels.map((r) => r.map((f) => ({ ...f }))),
    depth: state.depth,
    tile: state.position,
    joinedAt: h.joinedAt || Date.now(),
    diedAt: Date.now(),
    stepsWithParty: Math.max(0, state.steps - (h.joinedSteps || 0)),
    origin: h.origin || {
      depth: 0,
      tile: null,
      description: "The beginning of the expedition",
    },
    buried: false,
  };
  h.death = record;
  state.pendingDeaths.push(record);
  record.corpseId = leaveCorpse(h.job, h.name);
  log(`${h.name} falls on floor ${state.depth}: ${cause}.`);
  save();
}
function elapsedText(ms) {
  let seconds = Math.max(0, Math.floor(ms / 1000)),
    m = Math.floor(seconds / 60),
    h = Math.floor(m / 60);
  return h ? `${h}h ${m % 60}m` : m ? `${m}m ${seconds % 60}s` : `${seconds}s`;
}
function foundText(origin) {
  return !origin || origin.depth === 0
    ? "At camp, before the expedition"
    : `${origin.description || "Met in the dungeon"} · floor ${origin.depth}${origin.tile != null ? ", column " + ((origin.tile % W) + 1) + ", row " + (Math.floor(origin.tile / W) + 1) : ""}`;
}
function memorialMarkup(d) {
  return `<div class="memorial-stats"><p><b>${escapeHTML(d.name)}</b> · ${d.job === "fighter" ? "Tank" : d.job[0].toUpperCase() + d.job.slice(1)} · level ${d.level}</p><dl><dt>Cause of death</dt><dd>${escapeHTML(d.cause)}</dd><dt>Final resting place</dt><dd>Floor ${d.depth}, column ${(d.tile % W) + 1}, row ${Math.floor(d.tile / W) + 1}</dd><dt>Found</dt><dd>${escapeHTML(foundText(d.origin))}</dd><dt>Time with the party</dt><dd>${elapsedText(d.diedAt - d.joinedAt)} · ${d.stepsWithParty} steps</dd><dt>Battles / kills</dt><dd>${d.stats.battles} / ${d.stats.kills}</dd><dt>Damage dealt / taken</dt><dd>${d.stats.damageDealt} / ${d.stats.damageTaken}</dd><dt>Armour absorbed</dt><dd>${d.stats.damageBlocked}</dd><dt>Healing given / received</dt><dd>${d.stats.healingDone} / ${d.stats.healingReceived}</dd><dt>Spins / missed turns</dt><dd>${d.stats.spins} / ${d.stats.turnsMissed}</dd><dt>Experience earned</dt><dd>${d.stats.xpEarned}</dd></dl></div>`;
}
async function processDeaths() {
  while (state.pendingDeaths.length) {
    const d = state.pendingDeaths[0],
      h = state.party.find((h) => h.id === d.id);
    const stone = state.artefacts.find((a) => a.key === "revive");
    if (stone && h && !d.reviveDeclined) {
      showSpotlight(
        "A light inside the stone",
        `${d.name} is slipping away.`,
        `<div class="stage-art">${icon("artefact")}</div><div class="stage-result">Consume your Revive Stone to bring ${escapeHTML(d.name)} back with <b>${Math.ceil(h.maxHp * BALANCE.rules.reviveHealthFraction)} / ${h.maxHp} HP</b>?<br><small>The stone will be lost. Their story can continue.</small></div>`,
        "revive",
      );
      const choice = await eventChoice([
        { id: "revive-use", label: "Use the Revive Stone", value: true },
        { id: "revive-decline", label: "Let them rest", value: false },
      ]);
      closeSpotlight();
      if (choice === "true") {
        state.artefacts = state.artefacts.filter((a) => a.id !== stone.id);
        if (state.equippedArtefact === stone.id) state.equippedArtefact = null;
        h.dead = false;
        h.hp = Math.ceil(h.maxHp * BALANCE.rules.reviveHealthFraction);
        h.stun = 0;
        h.stats.revives = (h.stats.revives || 0) + 1;
        delete h.death;
        const cell = state.map[d.tile];
        if (cell)
          cell.corpses = cell.corpses.filter((c) =>
            d.corpseId ? c.id !== d.corpseId : c.name !== h.name || c.enemy,
          );
        state.pendingDeaths.shift();
        render();
        burst($("#portrait-" + state.party.indexOf(h)), "heal", 36);
        floatAt(
          $("#portrait-" + state.party.indexOf(h)),
          "Returned · " + h.hp + " HP",
          true,
        );
        log(
          `${h.name} returns at ${h.hp} HP. The Revive Stone crumbles to dust.`,
        );
        save();
        continue;
      }
      d.reviveDeclined = true;
      if (h.death) h.death.reviveDeclined = true;
      save();
    }
    showSpotlight(
      "A name falls silent",
      `${d.name} is dead. Forever.`,
      `<div class="stage-art death-portrait">${portraitArt(d.job, { hp: 0, maxHp: d.maxHp })}</div><div class="stage-result">${escapeHTML(d.cause)}<br><small>Floor ${d.depth}. The party will carry their memory.</small></div>`,
      "death",
    );
    await eventChoice([
      { id: "death-confirm", label: "Remember " + d.name, value: true },
    ]);
    closeSpotlight();
    let survivors = state.party.filter(alive);
    if (survivors.length) {
      showSpotlight(
        "A burial in the margins",
        `${survivors.map((h) => h.name).join(" and ")} ${survivors.length === 1 ? "lays" : "lay"} a companion to rest.`,
        memorialMarkup(d),
        "burial",
      );
      await eventChoice([
        {
          id: "burial-confirm",
          label: "Lay " + d.name + " to rest · continue",
          value: true,
        },
      ]);
      closeSpotlight();
      d.buried = true;
      const targetId = state.party[state.target]?.id;
      state.party = state.party.filter((h) => h.id !== d.id);
      state.target = Math.max(
        0,
        state.party.findIndex((h) => h.id === targetId),
      );
      log(`${d.name} is buried. The survivors carry the story onward.`);
    }
    if (!state.graveyard.some((x) => x.id === d.id)) state.graveyard.push(d);
    state.pendingDeaths.shift();
    renderParty();
    renderTargets();
    renderMap();
    renderMemorialButton();
    save();
  }
}
function renderMemorialButton() {
  let b = $("#memorial");
  b.textContent = "Names remembered · " + state.graveyard.length;
  b.disabled = !state.graveyard.length || busy;
}
function inspectGraveyard() {
  if (busy || !state.graveyard.length) return;
  openModal(
    "The names we carry",
    state.graveyard.map(memorialMarkup).join("<hr>") +
      '<div class="modal-actions"><button class="primary" data-close>Keep their memory</button></div>',
    "memorial",
  );
}
function armourFX(spent, label) {
  floatAt($("#block"), label + " · −" + spent, false, true);
  burst($("#block"), "shield", 24);
  shakeElement($("#block"), 4);
  animate(
    $("#block"),
    [
      { background: "#c6d5ae", boxShadow: "0 0 0 0 #71865f88" },
      { background: "#e6ddc2", boxShadow: "0 0 0 14px #71865f00" },
    ],
    { duration: 450, juice: true },
  );
}
function stunHero(i, power) {
  let h = state.party[i];
  if (!alive(h)) return "no living target";
  if (h.stunGrace) return h.name + " resists a repeated stun";
  if (state.block > 0) {
    let cost = Math.min(
      state.block,
      BALANCE.rules.stunArmourCost * Math.max(1, power),
    );
    state.block -= cost;
    h.stats ??= emptyStats();
    h.stats.damageBlocked += cost;
    renderBlock();
    armourFX(cost, "STUN BLOCKED");
    shieldedFX($("#portrait-" + i));
    log(`Team armour blocks a stun on ${h.name}, consuming ${cost} armour.`);
    return h.name + " protected from stun (−" + cost + " armour)";
  }
  h.stun = 1;
  syncHero(i);
  floatAt($("#portrait-" + i), "Stunned · miss one go", false, true);
  log(
    `${h.name} is stunned. Missing this go will not advance the enemy clock.`,
  );
  return h.name + " stunned";
}
function stunEnemy(power, e = state.enemy) {
  if (e.block > 0) {
    let cost = Math.min(
      e.block,
      BALANCE.rules.stunArmourCost * Math.max(1, power),
    );
    e.block -= cost;
    shieldedFX(enemyArtEl(e));
    floatAt(enemyArtEl(e), "Stun blocked · −" + cost, false, true);
    log(`${e.name} blocks stun, spending ${cost} armour.`);
    return "stun blocked · −" + cost + " enemy armour";
  }
  e.stun = 1;
  burst(enemyArtEl(e), "gold", 12);
  log(`${e.name} is stunned and will miss one attack turn.`);
  return "one enemy turn stunned";
}
function scaleEffects(base, multiplier) {
  return Object.fromEntries(
    Object.entries(base).map(([k, n]) => [k, Math.ceil(n * multiplier)]),
  );
}
function effectDetails(base) {
  return Object.entries(base)
    .filter(([k, n]) => k !== "blank" && n > 0)
    .map(([k, value]) => ({
      label:
        {
          attack: "Damage power",
          magic: "Magic damage",
          poison: "Poison potency",
          stimulant: "Stimulant power",
          rage: "Rage",
          teamHeal: "Healing per ally",
          heal: "Healing power",
          block: "Armour",
          stun: "Stun power",
        }[k] || k,
      icon: ICONS[k] || k,
      value,
    }));
}

function moveRate() {
  let speed = skip ? 5 : Number(state?.speed) || 1;
  return 1 + 0.5 * (speed - 1);
}
function distanceBoost(tiles) {
  return 1 + Math.min(0.24, Math.max(0, tiles - 1) * 0.018);
}
async function waitMovement(ms, boost = 1) {
  let done = 0,
    last = performance.now(),
    version = animationVersion;
  await new Promise((resolve) => {
    const tick = () => {
      let now = performance.now();
      if (!Production.input.paused)
        done += (now - last) * (sceneFast ? 3 : moveRate()) * boost;
      last = now;
      if (version !== animationVersion || done >= ms) return resolve();
      setTimeout(tick, 10);
    };
    tick();
  });
}
function trapPower(depth) {
  return (
    balanceValue("trapPower.coefficient.1") +
    depth * balanceValue("trapPower.coefficient.2")
  );
}
function prepareRecruit(h) {
  const party = state.party.filter(alive);
  h.level = Math.max(
    1,
    Math.round(
      party.reduce((sum, p) => sum + p.level, 0) / Math.max(1, party.length),
    ),
  );
  h.maxHp += (h.level - 1) * BALANCE.rules.levelHp;
  h.hp = h.maxHp;
  const earned = (h.level - 1) * BALANCE.rules.levelPoints,
    budget = Math.floor(earned / balanceValue("prepareRecruit.budget.1"));
  let remaining = budget;
  // Prefer the class's specialty; fill blanks when the remaining budget is small.
  const specialty =
    h.job === "healer" ? "heal" : h.job === "mage" ? "magic" : "attack";
  while (remaining > 0) {
    const upgrades = h.reels
      .flatMap((r, reel) => r.map((f, index) => ({ f, reel, index })))
      .filter(
        ({ f }) => f.type === specialty && faceUpgradeCost(f) <= remaining,
      )
      .sort((a, b) => a.f.tier - b.f.tier);
    const candidate =
      upgrades[0]?.f ||
      h.reels.flat().find((f) => f.type === "blank") ||
      h.reels
        .flat()
        .find(
          (f) =>
            f.type !== specialty &&
            f.type !== "class" &&
            FACE_COST[f.tier] <= remaining,
        );
    if (!candidate) break;
    const convert = ![specialty, "blank"].includes(candidate.type);
    const cost = convert
      ? FACE_COST[candidate.tier]
      : faceUpgradeCost(candidate);
    if (!cost || cost > remaining) break;
    if (candidate.type === "blank" || convert) {
      candidate.type = specialty;
      candidate.tier = 1;
    } else candidate.tier++;
    remaining -= cost;
  }
  h.inheritedUpgradeSpent = budget - remaining;
  h.points = BALANCE.rules.startingPoints + earned - h.inheritedUpgradeSpent;
  h.last = h.reels.map((r) => ({ type: r[0].type, tier: r[0].tier }));
  return h;
}
function runSummaryMarkup(all = false) {
  const fallen = [...state.graveyard];
  for (const h of state.party)
    if (h.death && !fallen.some((d) => d.id === h.id)) fallen.push(h.death);
  const living = state.party.filter(alive),
    retired = state.retired || [],
    roster = all ? [...living, ...retired, ...fallen] : fallen;
  const totals = [...living, ...retired, ...fallen].reduce((out, h) => {
    for (const key of Object.keys(emptyStats()))
      out[key] += h.stats?.[key] || 0;
    return out;
  }, emptyStats());
  const labels = {
    spins: "Spins",
    turnsMissed: "Turns missed",
    battles: "Victories",
    kills: "Kills",
    damageDealt: "Damage dealt",
    damageTaken: "Damage taken",
    damageBlocked: "Damage blocked",
    healingDone: "Healing given",
    healingReceived: "Healing received",
    xpEarned: "EXP earned",
    itemsUsed: "Items used",
    criticals: "Criticals",
    levelsGained: "Levels gained",
  };
  return `<div class="run-summary"><p>Floor <b>${state.depth} / 10</b> · <b>${state.battlesWon}</b> battles won · <b>${state.gold}</b> gold<br>${state.steps} steps · ${elapsedText((state.finishedAt || Date.now()) - (state.startedAt || Date.now()))}<br>${totals.damageDealt} damage dealt · ${totals.healingDone} healing · ${totals.kills} enemies slain</p><h3>${all ? "Every name in the story" : "The names we remember"} · ${roster.length}</h3><p class="roster-prompt">Scroll through their stories ↓</p><div class="fallen-roster" tabindex="0" role="region" aria-label="${all ? "All adventurers, living and fallen" : "All fallen party members"}">${
    roster
      .map((h) => {
        const dead = fallen.some((d) => d.id === h.id),
          away = !!h.retiredAt,
          stats = { ...emptyStats(), ...h.stats };
        return `<article class="fallen-entry"><div class="fallen-portrait">${dead ? corpseArt(h.job) : portraitArt(h.job, h)}</div><div class="memorial-stats"><p><b>${escapeHTML(h.name)}</b> · ${className(h.job)} · Lv.${h.level} · ${dead ? "FALLEN" : away ? "RETIRED" : "SURVIVOR"}</p><dl><dt>Health / EXP / points</dt><dd>${dead ? "0" : h.hp} / ${h.maxHp} HP · ${h.xp || 0} EXP · ${h.points ?? "—"} points</dd><dt>Found</dt><dd>${escapeHTML(foundText(h.origin))}</dd><dt>Time with party</dt><dd>${elapsedText((h.diedAt || h.retiredAt || state.finishedAt || Date.now()) - h.joinedAt)} · ${h.stepsWithParty ?? Math.max(0, state.steps - (h.joinedSteps || 0))} steps</dd>${dead ? `<dt>Cause / resting place</dt><dd>${escapeHTML(h.cause)} · floor ${h.depth}, column ${(h.tile % W) + 1}, row ${Math.floor(h.tile / W) + 1}</dd>` : ""}<dt>Equipment</dt><dd>${EQUIPMENT_DEFS[h.equipment]?.name || "None"}</dd>${Object.entries(
          labels,
        )
          .map(([key, label]) => `<dt>${label}</dt><dd>${stats[key]}</dd>`)
          .join(
            "",
          )}<dt>Reels</dt><dd>${h.reels ? h.reels.map((r, k) => `Reel ${k + 1}: ${r.map((f) => f.type + " " + tierName(f.tier) + " [" + (f.weight || 1) + "]").join(", ")}`).join("<br>") : "Recorded in the burial notes"}</dd></dl></div></article>`;
      })
      .join("") || "<p>No names have been lost.</p>"
  }</div></div>`;
}
function combatNumber(el, value, type) {
  if (!el || (type === "heal" && !value)) return;
  const rect = el.getBoundingClientRect(),
    node = document.createElement("div");
  node.className = "combat-number " + (type === "heal" ? "healing" : "damage");
  node.dataset.target = el.id;
  node.dataset.value = value;
  node.textContent = (type === "heal" ? "+" : "−") + value;
  node.style.left = rect.left + rect.width / 2 + "px";
  node.style.top = rect.top + rect.height * 0.3 + "px";
  document.body.append(node);
  setTimeout(() => node.remove(), 1450);
}
function popTitle(el) {
  animate(
    el,
    [
      { opacity: 0, transform: "translateY(12px) scale(.9)" },
      {
        opacity: 1,
        transform: "translateY(-2px) scale(1.045)",
        offset: 0.68,
      },
      { opacity: 1, transform: "translateY(0) scale(1)" },
    ],
    { duration: 520, juice: true },
  );
}
const MARGIN_HINTS = [
  "A beacon lights all eight neighbouring rooms.",
  "Leave a well untouched and return when you need it.",
  "Three alike on the reels can turn a battle.",
  "Mark a new destination at any time while walking.",
  "A cold draft may lead you to the stairs.",
  "Keep a Revive Stone close. Some stories deserve another page.",
];
let marginHintIndex = 0,
  hintChanging = false;
async function cycleMarginHint() {
  if (
    hintChanging ||
    busy ||
    state.enemy ||
    state.over ||
    !$("#spotlight").hidden ||
    !$("#overlay").hidden
  )
    return false;
  hintChanging = true;
  const el = $("#field-note"),
    doodle = $("#margin-doodle"),
    currentState = state;
  const fade = async (from, to, duration) => {
    await Promise.all(
      [el, doodle].map((node) =>
        animate(node, [{ opacity: from }, { opacity: to }], {
          duration,
          juice: true,
        })?.finished.catch(() => {}),
      ),
    );
  };
  await fade(1, 0, 350);
  if (
    state !== currentState ||
    busy ||
    state.enemy ||
    state.over ||
    !$("#spotlight").hidden ||
    !$("#overlay").hidden
  ) {
    hintChanging = false;
    return false;
  }
  marginHintIndex = (marginHintIndex + 1) % MARGIN_HINTS.length;
  el.innerHTML =
    icon("beacon") + " " + escapeHTML(MARGIN_HINTS[marginHintIndex]);
  $("#margin-doodle").innerHTML =
    icon("beacon") +
    "<span>" +
    escapeHTML(MARGIN_HINTS[marginHintIndex]) +
    "</span>";
  await fade(0, 1, 500);
  hintChanging = false;
  return true;
}
function recruitChance(
  partySize = state?.party.filter(alive).length || 1,
  missedFloors = state?.recruitPity || 0,
  depth = state?.depth || 1,
) {
  return Math.min(
    partySize === 1
      ? balanceValue("recruitChance.coefficient.1")
      : balanceValue("recruitChance.coefficient.2"),
    (partySize === 1
      ? balanceValue("recruitChance.coefficient.3")
      : balanceValue("recruitChance.coefficient.4")) +
      Math.max(0, balanceValue("recruitChance.coefficient.5") - depth) *
        balanceValue("recruitChance.coefficient.6") +
      missedFloors *
        (partySize === 1
          ? balanceValue("recruitChance.coefficient.7")
          : balanceValue("recruitChance.coefficient.8")),
  );
}
function mapDistances(map, start = pos(1, 7)) {
  const distances = new Map([[start, 0]]),
    queue = [start];
  for (const i of queue)
    for (const j of neighbors(i))
      if (!map[j].wall && !distances.has(j)) {
        distances.set(j, distances.get(i) + 1);
        queue.push(j);
      }
  return distances;
}
function ensureStairsPath(map, goal = null) {
  const stairs = goal ?? map.findIndex((c) => c.event === "stairs");
  if (stairs < 0) throw Error("A dungeon floor requires stairs");
  if (mapDistances(map).has(stairs)) return map;
  // Repair with the fewest terrain changes; rivers become bridges.
  let costs = new Map([[pos(1, 7), 0]]),
    came = new Map(),
    queue = [pos(1, 7)];
  while (queue.length) {
    queue.sort((a, b) => costs.get(a) - costs.get(b));
    let i = queue.shift();
    if (i === stairs) break;
    for (const j of neighbors(i)) {
      if (j % W === 0 || j % W === W - 1 || j < W || j >= W * (H - 1)) continue;
      const next =
        costs.get(i) + (map[j].wall ? (map[j].structure ? 10000 : 30) : 1);
      if (next < (costs.get(j) ?? Infinity)) {
        costs.set(j, next);
        came.set(j, i);
        queue.push(j);
      }
    }
  }
  for (let i = stairs; i !== pos(1, 7); i = came.get(i)) {
    if (i === undefined) throw Error("No staircase repair route");
    if (map[i].wall)
      Object.assign(map[i], {
        wall: false,
        terrain: map[i].terrain === "river" ? "bridge" : "floor",
      });
  }
  map[pos(1, 7)].wall = false;
  return map;
}

async function wellEncounter(c) {
  showSpotlight(
    "A healing fountain",
    "Leave it for later, or turn the little water wheel.",
    `<div class="stage-art">${icon("well")}</div><div class="stage-result">Each living hero receives 30% maximum HP<br>plus a healing reel roll. Triple matches can crit.</div>`,
    "well",
  );
  let choice = await eventChoice([
    { id: "well-use", label: "Use the fountain", value: true },
    { id: "well-decline", label: "Leave it untouched", value: false },
  ]);
  if (choice !== "true") {
    closeSpotlight();
    log("The fountain is left flowing. Its map marker remains active.");
    result(
      icon("well") + " Fountain left untouched · return whenever you need it.",
    );
    return false;
  }
  const faces = BALANCE.eventReels.well.faces;
  showSpotlight(
    "The water wheel turns",
    "A little mercy, rolled into the margins.",
    `<div class="trap-art">${icon("well")}</div>${drawMachine("fountain", [faces[0], faces[1], faces[3]], { title: `${Math.round(BALANCE.rules.fountainHealthFraction * 100)}% maximum HP + this roll` })}${criticalSpace()}<div class="stage-result" id="fountain-result">What will the water remember?</div>`,
    "well",
  );
  let symbols = await runMachine("fountain", [faces, faces, faces]),
    bonus = calculate(symbols).heal,
    details = state.party.filter(alive).map((h) => ({
      label: h.name + " · healing offered",
      icon: "heal",
      value: Math.ceil(h.maxHp * BALANCE.rules.fountainHealthFraction) + bonus,
    })),
    multiplier = await rollCritical("Healing fountain", symbols, false, {
      context: "well",
      details,
    });
  let planned = details.map((d) => ({
    ...d,
    value: Math.ceil(d.value * multiplier),
  }));
  $("#fountain-result").innerHTML =
    planned
      .map(
        (d, i) =>
          `<div class="well-heal-total" data-before="${details[i].value}" data-after="${d.value}">${escapeHTML(d.label)}: ${multiplier > 1 ? `<b>${details[i].value}</b> × ${multiplier} = ` : ""}<strong>${d.value} HP</strong></div>`,
      )
      .join("") + "<small>The water mends wounds up to full health.</small>";
  state.lastWellRoll = {
    symbols,
    bonus,
    multiplier,
    base: details,
    planned,
  };
  await eventChoice([
    {
      id: "stage-confirm",
      label: "Drink the rolled blessing",
      value: true,
    },
  ]);
  closeSpotlight();
  c.event = null;
  c.feature = "well";
  state.party.forEach((h, i) => {
    if (alive(h))
      healHero(
        i,
        Math.ceil(
          (Math.ceil(h.maxHp * BALANCE.rules.fountainHealthFraction) + bonus) *
            multiplier,
        ),
      );
  });
  result(
    icon("well") +
      " Fountain used · " +
      (multiplier > 1
        ? "×" + multiplier + " critical healing"
        : "30% health + " + bonus + " rolled HP"),
  );
  log("The fountain is spent. It cannot revive the dead.");
  await feedbackPause(500);
  return true;
}
function stopCoinRain() {
  if (coinRain) {
    clearInterval(coinRain.timer);
    coinRain = null;
  }
}
function startCoinRain(gold, massive = false, anchor = $("#stage-card")) {
  stopCoinRain();
  let remaining = Math.min(500, Math.max(100, gold * (massive ? 7 : 5)));
  coinRain = { remaining, timer: null };
  const shower = () => {
    if (!anchor?.isConnected || !anchor.getClientRects().length) {
      stopCoinRain();
      return;
    }
    let r = anchor.getBoundingClientRect(),
      count = Math.min(coinRain.remaining, massive ? 12 : 8);
    for (let j = 0; j < count; j++)
      particles.push({
        x: r.left + 20 + fxRandom() * (r.width - 40),
        y: r.bottom - 35 + fxRandom() * 12,
        vx: (fxRandom() - 0.5) * 2,
        vy: 3 + fxRandom() * 4,
        size: 7 + fxRandom() * 7,
        angle: fxRandom() * 6,
        spin: (fxRandom() - 0.5) * 0.25,
        life: 0,
        max: 1600 + fxRandom() * 1200,
        kind: "coin",
      });
    coinRain.remaining -= count;
    particles = particles.slice(-900);
    if (!fxFrame) fxFrame = requestAnimationFrame(drawParticles);
    if (coinRain.remaining <= 0) stopCoinRain();
  };
  coinRain.timer = setInterval(shower, massive ? 55 : 75);
  shower();
}
function goldCelebration(gold, massive = false) {
  Production.audio.play("sfx.coin");
  const anchor = !$("#spotlight").hidden
    ? $("#stage-card")
    : !$("#overlay").hidden
      ? $("#modal")
      : $("#book");
  const source =
    anchor.id === "stage-card" ? $("#treasure-result") || anchor : anchor;
  burst(source, "coin", Math.min(240, Math.max(55, gold * 3)));
  burst(anchor, "paper", massive ? 65 : 28);
  startCoinRain(gold, massive, anchor);
  shakeBook(massive ? 6 : 2.5);
}

$("#map").addEventListener("click", (e) => {
  let b = e.target.closest("[data-tile]");
  if (b) move(Number(b.dataset.tile));
});
$("#map").addEventListener("pointerover", (e) => {
  let b = e.target.closest("[data-tile]");
  if (!b) return;
  let n = Number(b.dataset.tile);
  $("#hover-name").textContent = tileName(state.map[n]);
  document
    .querySelectorAll(".tile.route")
    .forEach((el) => el.classList.remove("route"));
  if ((!busy || travel) && !state.enemy) {
    let route = shortestPath(n);
    route
      ?.slice(0, -1)
      .forEach((i) => $(`[data-tile="${i}"]`)?.classList.add("route"));
  }
});
$("#map").addEventListener("pointerleave", () => {
  document
    .querySelectorAll(".tile.route")
    .forEach((el) => el.classList.remove("route"));
  $("#hover-name").textContent = tileName(state.map[state.position]);
});
function startHero(i) {
  if (currentRoll?.id === "hero-" + i) {
    fastForward();
    return;
  }
  spin(i);
}
document.addEventListener("click", (e) => {
  let b = e.target.closest("button");
  if (!b || b.disabled) return;
  if (b.hasAttribute("data-enemy-target")) selectEnemy(b.dataset.enemyTarget);
  if (b.hasAttribute("data-spin")) startHero(Number(b.dataset.spin));
  if (b.hasAttribute("data-roll-area")) {
    let id = b.dataset.rollArea;
    if (currentRoll?.id === id || (id === "critical" && criticalHoldResolver))
      fastForward();
    else if (id.startsWith("hero-")) startHero(Number(id.slice(5)));
  }
  if (
    b.hasAttribute("data-fast-machine") &&
    (currentRoll?.id === b.dataset.fastMachine ||
      (b.dataset.fastMachine === "critical" && criticalHoldResolver))
  )
    fastForward();
  if (b.hasAttribute("data-fast")) fastForward();
  if (b.hasAttribute("data-stage-choice") && stageResolver) {
    let done = stageResolver;
    stageResolver = null;
    $("#stage-actions")
      .querySelectorAll("button")
      .forEach((el) => (el.disabled = true));
    done(b.dataset.stageChoice);
  }
  if (b.hasAttribute("data-use-item")) useItem(b.dataset.useItem);
  if (b.hasAttribute("data-toss-item") && !busy) {
    const type = b.dataset.tossItem;
    delete state.bag[type];
    log(ITEM_DEFS[type].name + " left behind.");
    renderInventory();
    inspectBag();
    save();
  }
  if (b.hasAttribute("data-buy")) buyShop(b.dataset.buy);
  if (b.hasAttribute("data-equip")) equipArtefact(b.dataset.equip);
  if (b.id === "artefact-slot") inspectArtefacts();
  if (b.hasAttribute("data-edit")) editor(Number(b.dataset.edit));
  if (b.hasAttribute("data-target") && !busy) {
    state.target = Number(b.dataset.target);
    renderParty();
    renderTargets();
    save();
  }
  if (b.hasAttribute("data-close")) {
    if (modalKind === "equipment") equipmentCancel?.();
    else closeModal();
  }
  if (b.hasAttribute("data-restart")) chooseStartingClass(false);
  if (b.hasAttribute("data-start-job")) startNewBook(b.dataset.startJob);
  if (b.hasAttribute("data-gear-hero") && !busy) {
    const h = state.party[Number(b.dataset.gearHero)];
    toast(
      h.equipment
        ? EQUIPMENT_DEFS[h.equipment].description
        : "Drag matching class equipment from your satchel, or click its item card.",
    );
  }
  if (b.id === "memorial") inspectGraveyard();
  for (let op of ["cycle", "upgrade", "weaken"])
    if (b.hasAttribute("data-" + op)) editFace(b.dataset[op], op);
});
$("#stage-card").addEventListener("click", (e) => {
  if (!e.target.closest("button,input,label")) fastForward();
});
$("#autoresolve").onchange = (e) => setAutoresolve(e.target.checked);
$("#options-tab").onclick = optionsPage;
$("#guide-tab").onclick = () => {
  if (!busy) help();
};
document.addEventListener("dragstart", (e) => {
  const item = e.target.closest("[data-drag-item]");
  if (!item || busy || !EQUIPMENT_DEFS[item.dataset.dragItem]) return;
  e.dataTransfer.setData("text/plain", item.dataset.dragItem);
  e.dataTransfer.effectAllowed = "move";
});
document.addEventListener("dragover", (e) => {
  const hero = e.target.closest("[data-gear-target]");
  if (hero && !busy) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    hero.classList.add("gear-hover");
  }
});
document.addEventListener("dragleave", (e) =>
  e.target.closest("[data-gear-target]")?.classList.remove("gear-hover"),
);
document.addEventListener("drop", (e) => {
  document
    .querySelectorAll(".gear-hover")
    .forEach((el) => el.classList.remove("gear-hover"));
  const hero = e.target.closest("[data-gear-target]");
  if (hero) {
    e.preventDefault();
    equipCharacter(
      e.dataTransfer.getData("text/plain"),
      Number(hero.dataset.gearTarget),
    );
  }
});
$("#palette").onchange = (e) => setPalette(e.target.value);
$("#animation-speed").onchange = (e) => setPace(e.target.value);
$("#help").onclick = () => {
  if (busy) {
    toast("Let this moment land, or press Space to hurry it along.");
    return;
  }
  help();
};
$("#reveal-help").onclick = help;
$("#exit-found").onclick = stairs;
$("#manage-bag").onclick = inspectBag;
$("#toggle-log").onclick = () => $("#log").focus();
$("#new-game").onclick = () => {
  if (busy) {
    toast("Finish the current action first, or fast-forward it.");
    return;
  }
  chooseStartingClass(false);
};
$("#download").onclick = () => {
  let blob = new Blob([HTML_BACKUP], { type: "text/html;charset=utf-8" }),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = "Scratchpad-Dungeon.html";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("Your complete offline notebook is downloading.");
};
function trapFocus(e, container) {
  if (e.key !== "Tab") return;
  let nodes = [
    ...container.querySelectorAll("button:not(:disabled),input,select"),
    $("#animation-speed"),
    $("#palette"),
  ];
  if (!nodes.length) return;
  let first = nodes[0],
    last = nodes.at(-1);
  if (
    e.shiftKey &&
    (document.activeElement === first || document.activeElement === container)
  ) {
    e.preventDefault();
    last.focus();
  } else if (
    !e.shiftKey &&
    (document.activeElement === last || document.activeElement === container)
  ) {
    e.preventDefault();
    first.focus();
  }
}
document.addEventListener("keydown", (e) => {
  if (keyboardShortcut(e)) return;
  if (
    document.activeElement.id === "log" &&
    ["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"].includes(
      e.key,
    )
  )
    return;
  if (!$("#spotlight").hidden) {
    trapFocus(e, $("#stage-card"));
    if (
      e.key === "Escape" ||
      (e.code === "Space" &&
        !["INPUT", "BUTTON", "SELECT"].includes(document.activeElement.tagName))
    ) {
      e.preventDefault();
      fastForward();
    }
    return;
  }
  if (!$("#overlay").hidden) {
    trapFocus(e, $("#modal"));
    if (e.key === "Escape") {
      e.preventDefault();
      if (modalKind === "starter" && !state.steps && !state.battlesWon) return;
      if (modalKind === "equipment") {
        equipmentCancel?.();
        return;
      }
      closeModal();
    }
    return;
  }
  if ((e.code === "Space" || e.key === "Escape") && busy) {
    e.preventDefault();
    fastForward();
    return;
  }
  if (
    e.key.toLowerCase() === "m" &&
    !["INPUT", "SELECT"].includes(document.activeElement.tagName)
  ) {
    $("#toggle-log").click();
    return;
  }
  if (["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement.tagName))
    return;
  let d = {
    ArrowUp: -W,
    ArrowDown: W,
    ArrowLeft: -1,
    ArrowRight: 1,
    w: -W,
    s: W,
    a: -1,
    d: 1,
  }[e.key];
  if (d !== undefined) {
    e.preventDefault();
    let n = state.position + d;
    if (neighbors(state.position).includes(n)) move(n);
  }
});
addEventListener("resize", () => {
  sizeCanvas();
  fitNotebook();
  positionPlayer(false);
  fitDialogs();
  requestFitUI();
});
document.fonts.ready.then(() => {
  fitNotebook();
  requestFitUI();
});
const panelObserver = new MutationObserver(requestFitUI);
panelObserver.observe($("#stage-card"), {
  subtree: true,
  childList: true,
  characterData: true,
});
panelObserver.observe($("#modal"), {
  subtree: true,
  childList: true,
  characterData: true,
});
sizeCanvas();
setInterval(() => {
  if (
    refreshStaleMap() ||
    (canExplore() && state.exploreTime - (state.lastExploreSave || 0) > 5000)
  ) {
    state.lastExploreSave = state.exploreTime;
    save();
  }
}, 250);
setInterval(
  () =>
    autoresolveTick().catch((error) => {
      state.autoresolve = false;
      save();
      console.error(error);
    }),
  180,
);
setInterval(() => {
  if (fxRandom() < 0.3) idleChatter();
}, 24000);
setInterval(() => {
  if (fxRandom() < 0.65) cycleMarginHint();
}, 19000);
$("#legend").innerHTML = [
  ["eye", "Unknown"],
  ["skull", "Enemy"],
  ["treasure", "Treasure"],
  ["trap", "Trap"],
  ["shop", "Shop"],
  ["recruit", "Wanderer"],
  ["well", "Well"],
  ["beacon", "Beacon"],
  ["stairs", "Stairs"],
  ["wall", "Wall"],
  ["river", "River"],
  ["bridge", "Bridge"],
  ["ruin", "Ruins"],
  ["stronghold", "Stronghold"],
]
  .map(([i, t]) => `<span>${icon(i)}${t}</span>`)
  .join("");
$("#margin-doodle").innerHTML =
  icon("beacon") +
  "<span>A beacon wakes the eight squares around it. Even the diagonal ones.</span>";
// Exploration time advances only while the map is available.
function lineOfSight(from, to) {
  let x = from % W,
    y = Math.floor(from / W),
    tx = to % W,
    ty = Math.floor(to / W);
  const dx = Math.abs(tx - x),
    dy = Math.abs(ty - y),
    sx = x < tx ? 1 : -1,
    sy = y < ty ? 1 : -1;
  let err = dx - dy;
  while (x !== tx || y !== ty) {
    const twice = 2 * err,
      oldX = x,
      oldY = y;
    if (twice > -dy) {
      err -= dy;
      x += sx;
    }
    if (twice < dx) {
      err += dx;
      y += sy;
    }
    if (
      x !== oldX &&
      y !== oldY &&
      state.map[pos(x, oldY)]?.terrain === "stone" &&
      state.map[pos(oldX, y)]?.terrain === "stone"
    )
      return false;
    if (x === tx && y === ty) return true;
    if (state.map[pos(x, y)]?.wall && state.map[pos(x, y)].terrain !== "river")
      return false;
  }
  return true;
}
function beaconTiles(origin) {
  const near = neighbors(origin, true).filter((i) => lineOfSight(origin, i));
  if (Math.random() < balanceValue("beaconTiles.coefficient.1")) {
    const ring = state.map
      .map((_, i) => i)
      .filter(
        (i) =>
          tileDistance(i, origin) === balanceValue("beaconTiles.ring.1") &&
          lineOfSight(origin, i),
      );
    const extra = Math.min(
      ring.length,
      1 + rand(balanceValue("beaconTiles.extra.1")),
    );
    for (let k = 0; k < extra; k++)
      near.push(ring.splice(rand(ring.length), 1)[0]);
  }
  return near;
}
function enemyEligible(id, depth) {
  const e = BALANCE.enemies[id];
  return !!e && depth >= e.minFloor && depth <= e.maxFloor;
}
function enemyDefinition(id) {
  const e = BALANCE.enemies[id];
  if (!e) throw Error("Unknown enemy ID: " + id);
  return { name: e.name, art: e.art, typeId: id };
}
function stairBossType(depth) {
  return enemyDefinition(BALANCE.bosses[depth - 1]);
}
function fadeDiscoveryHints() {
  document
    .querySelectorAll(".discovery-whisper,.speech-bubble")
    .forEach((el) => {
      setTimeout(() => el.remove(), 160);
      el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120 })
        .finished.then(() => el.remove())
        .catch(() => el.remove());
    });
}
function pursuerRoute(start, goal) {
  const costs = new Map([[start, 0]]),
    came = new Map(),
    queue = [start];
  while (queue.length) {
    queue.sort((a, b) => costs.get(a) - costs.get(b));
    const i = queue.shift();
    if (i === goal) break;
    for (const j of neighbors(i)) {
      if (state.map[j].wall) continue;
      const next =
        costs.get(i) +
        (state.map[j].seen ? 1 : balanceValue("pursuerRoute.next.1"));
      if (next < (costs.get(j) ?? Infinity)) {
        costs.set(j, next);
        came.set(j, i);
        if (!queue.includes(j)) queue.push(j);
      }
    }
  }
  if (!costs.has(goal)) return [];
  const path = [];
  for (let i = goal; i !== start; i = came.get(i)) {
    if (i === undefined) return [];
    path.unshift(i);
  }
  return path;
}
function renderPursuer() {
  document.querySelectorAll(".pursuer-token").forEach((e) => e.remove());
  const p = state.pursuer;
  if (!p || !state.map[p.position]?.seen) return;
  const cell = $(`[data-tile="${p.position}"]`);
  if (!cell) return;
  const marker = document.createElement("span");
  marker.className = "pursuer-token";
  marker.innerHTML = icon("pursuer");
  marker.title = "The Unwritten is hunting you";
  cell.append(marker);
  cell.setAttribute(
    "aria-label",
    cell.getAttribute("aria-label") + " · The Unwritten is here",
  );
}
async function advancePursuer() {
  if (
    state.depth < balanceValue("advancePursuer.coefficient.1") ||
    state.enemy ||
    state.over
  )
    return false;
  let p = state.pursuer;
  if (
    !p &&
    !state.pursuerSpawned &&
    state.map.filter((c) => c.seen && !c.wall).length >=
      balanceValue("advancePursuer.coefficient.2")
  ) {
    const reach = mapDistances(state.map, state.position);
    let far = [...reach.keys()].filter(
      (i) =>
        reach.get(i) >= balanceValue("advancePursuer.far.1") &&
        !state.map[i].event,
    );
    const visible = far.filter((i) => state.map[i].seen);
    if (visible.length) far = visible;
    if (far.length) {
      p = state.pursuer = { position: pick(far), beat: 0 };
      state.pursuerSpawned = true;
      log("Something is scratching toward you: The Unwritten.");
      toast("THE UNWRITTEN · Something has begun to follow.");
    }
  }
  if (!p) return false;
  const oldPosition = p.position;
  let contact = p.position === state.position;
  if (
    !contact &&
    ++p.beat % balanceValue("advancePursuer.coefficient.3") === 0
  ) {
    // Aim one step ahead when a walkable interception route exists.
    const ahead =
      travel && travel.goal !== state.position
        ? shortestPath(travel?.goal)?.[0]
        : null;
    let route = pursuerRoute(p.position, ahead ?? state.position);
    if (route.length) p.position = route[0];
    contact = p.position === state.position;
  }
  renderPursuer();
  if (
    oldPosition !== p.position &&
    state.map[oldPosition].seen &&
    state.map[p.position].seen
  ) {
    const marker = $(".pursuer-token"),
      from = $(`[data-tile="${oldPosition}"]`)?.getBoundingClientRect(),
      to = marker?.getBoundingClientRect();
    if (marker && from && to) {
      const scale = to.width / (marker.offsetWidth || to.width);
      animate(
        marker,
        [
          {
            transform: `translate(${(from.left - to.left) / scale}px,${(from.top - to.top) / scale}px) rotate(-5deg)`,
          },
          { transform: "translate(0,0) rotate(3deg)" },
        ],
        { duration: 400 / moveRate() },
      );
    }
  }
  if (!contact) return false;
  state.pursuer = null;
  travel = null;
  beginEncounter(false, { pursuer: true, count: 1 });
  renderEncounter();
  renderMap();
  smokePoof($(`[data-tile="${state.position}"]`), true);
  await encounterEntrance();
  return true;
}
async function minorTravelEvent(c) {
  if (
    state.steps -
      (state.lastMinorEventStep ??
        -balanceValue("minorTravelEvent.coefficient.1")) <
      balanceValue("minorTravelEvent.coefficient.2") ||
    Math.random() >= balanceValue("minorTravelEvent.coefficient.3")
  )
    return false;
  state.lastMinorEventStep = state.steps;
  if (Math.random() < balanceValue("minorTravelEvent.coefficient.4")) {
    showSpotlight(
      "A forgotten traveller",
      "A quiet life, ended between the pages.",
      `<div class="stage-art">${corpseArt("fighter")}</div><div class="stage-result">A worn satchel rests beside the body.</div>`,
      "body",
    );
    await eventChoice([
      { id: "stage-confirm", label: "Search the satchel", value: true },
      { id: "body-leave", label: "Let them rest", value: false },
    ]).then(async (choice) => {
      closeSpotlight();
      if (choice === "true") await treasureRoll("body");
    });
    c.corpses.push({
      kind: "fighter",
      name: "A forgotten traveller",
      enemy: false,
    });
    return true;
  }
  showSpotlight(
    "ROCKFALL!",
    "The ceiling answers your footsteps.",
    `<div class="rockfall-scene">${Array.from({ length: 8 }, (_, i) => `<span style="--rock:${i}">${icon("wall")}</span>`).join("")}</div>${drawMachine(
      "rockfall",
      [
        { type: "safe", tier: 1 },
        { type: "trap", tier: 1 },
        { type: "safe", tier: 1 },
      ],
    )}${criticalSpace()}<div class="stage-result" id="rockfall-result">Keep your head down…</div>`,
    "rockfall",
  );
  shakeBook(9);
  burst($("#stage-card"), "dust", 85);
  const faces = BALANCE.eventReels.rockfall.faces,
    symbols = await runMachine("rockfall", [faces, faces, faces]);
  const danger = symbols.reduce(
      (n, f) => n + (f.type === "trap" ? f.tier : 0),
      0,
    ),
    base = danger
      ? danger +
        Math.floor(state.depth / balanceValue("minorTravelEvent.base.1"))
      : 0;
  const mult = await rollCritical("Rockfall", symbols, false, {
    context: "rockfall",
    details: [{ label: "Falling stone", value: base, icon: "trap" }],
  });
  const target = state.party.findIndex(alive),
    damage = base ? Math.ceil(base * mult) : 0;
  $("#rockfall-result").textContent = damage
    ? `${state.party[target].name} is caught beneath ${damage} damage worth of falling stone.`
    : "The rocks miss the party. A dusty escape.";
  await eventChoice([
    { id: "stage-confirm", label: "Find solid ground", value: true },
  ]);
  closeSpotlight();
  if (damage) damageHero(target, damage, "A sudden rockfall");
  await processDeaths();
  checkDefeat();
  return true;
}
function levelUpFX(h) {
  Production.audio.play("sfx.level-up");
  h.levelUpAt = Date.now();
  const i = state.party.indexOf(h),
    hero = $("#hero-" + i),
    portrait = $("#portrait-" + i),
    machine = $("#machine-hero-" + i);
  [portrait, machine].forEach((el) => {
    burst(el, "gold", 45);
    animate(
      el,
      [
        { transform: "scale(1)" },
        { transform: "scale(1.12)", filter: "brightness(1.35)" },
        { transform: "scale(1)" },
      ],
      { duration: 900, juice: true },
    );
  });
  actionLabel(
    hero,
    "LEVEL " +
      h.level +
      " · +" +
      BALANCE.rules.levelHp +
      " HP · +" +
      BALANCE.rules.levelPoints +
      " points",
  );
  shakeElement(hero, 3);
}
function finishVictory() {
  Production.audio.play("sfx.victory");
  state.over = true;
  state.won = true;
  state.enemy = null;
  state.enemies = [];
  state.block = 0;
  state.finishedAt = Date.now();
  state.gold +=
    BALANCE.rules.victoryGoldBase +
    state.depth * BALANCE.rules.victoryGoldPerDepth;
  log("The Last Redaction falls. All ten pages belong to your party.");
  closeSpotlight();
  render();
  save();
  openModal(
    "YOU WROTE THE ENDING!",
    `<div class="victory-heading">TEN FLOORS CONQUERED</div>${runSummaryMarkup(true)}<div class="modal-actions"><button class="primary" data-restart>A fresh page</button><button data-close>Keep this story</button></div>`,
    "end",
  );
  popTitle($("#modal-title"));
  goldCelebration(300, true);
  shakeBook(9);
  for (let k = 0; k < 5; k++)
    setTimeout(() => {
      if (modalKind === "end" && state.won) {
        burst($("#modal-title"), "confetti", 75);
        burst($("#book"), "paper", 55);
        shakeElement($("#modal-title"), 5);
      }
    }, k * 260);
  setTimeout(stopCoinRain, 4200);
}
const EQUIPMENT_DEFS = Production.balance.equipment();
for (const [type, def] of Object.entries(EQUIPMENT_DEFS))
  ITEM_DEFS[type] = { ...def, equipment: true };
function equipmentBonus(entity, key) {
  return EQUIPMENT_DEFS[entity?.equipment]?.[key] || 0;
}
function equipmentMarkup(h, i) {
  const e = EQUIPMENT_DEFS[h.equipment];
  return `<button class="equipment-slot ${e ? "equipped" : ""}" data-gear-hero="${i}" title="${e ? e.description : "Drag matching class equipment here, or select it in your satchel."}" aria-label="${h.name}'s equipment: ${e ? e.name : "empty"}">${icon(e?.icon || "bag")}<span>${e ? e.name : "Equipment"}</span></button>`;
}
async function equipCharacter(
  type,
  index,
  { free = false, internal = false } = {},
) {
  const h = state.party[index],
    gear = EQUIPMENT_DEFS[type];
  if (
    !h ||
    !alive(h) ||
    !gear ||
    h.job !== gear.job ||
    state.over ||
    (busy && !internal) ||
    (!free && !state.bag[type])
  )
    return false;
  if (!free) {
    state.bag[type]--;
    if (!state.bag[type]) delete state.bag[type];
  }
  const previous = h.equipment;
  h.equipment = type;
  if (previous) state.pendingItems.push({ type: previous, count: 1 });
  closeModal();
  renderParty();
  syncStatusFX();
  renderInventory();
  save();
  actionLabel($("#portrait-" + index), gear.name + " equipped");
  burst($("#portrait-" + index), "gold", 30);
  if (previous && !processingItems) {
    const wasBusy = busy;
    busy = true;
    try {
      await processPendingItems();
    } finally {
      busy = wasBusy;
      render();
      save();
    }
  }
  return true;
}
function selectEquipment(type, options = {}) {
  const gear = EQUIPMENT_DEFS[type];
  if (!gear) return Promise.resolve(false);
  return new Promise((resolve) => {
    openModal(
      gear.name,
      `<p>${gear.description}</p><div class="equipment-choices">${state.party.map((h, i) => `<button data-gear-choice="${i}" ${alive(h) && h.job === gear.job ? "" : "disabled"}>${portraitArt(h.job, h)}<b>${h.name} · ${className(h.job)}</b><small>${h.equipment ? "Replace " + EQUIPMENT_DEFS[h.equipment].name : "Empty equipment slot"}</small></button>`).join("")}</div><div class="modal-actions"><button id="gear-cancel">Keep it in the bag</button></div>`,
      "equipment",
    );
    let done = false;
    const finish = async (index) => {
      if (done) return;
      done = true;
      closeModal();
      resolve(
        index === null ? false : await equipCharacter(type, index, options),
      );
    };
    document
      .querySelectorAll("[data-gear-choice]")
      .forEach((b) => (b.onclick = () => finish(Number(b.dataset.gearChoice))));
    $("#gear-cancel").onclick = () => finish(null);
    equipmentCancel = () => finish(null);
  });
}
let equipmentCancel = null;
function setAutoresolve(value) {
  state.autoresolve = !!value;
  $("#autoresolve").checked = state.autoresolve;
  save();
}
let autoActing = false,
  autoNextAt = 0;
async function autoresolveTick() {
  if (
    !state?.autoresolve ||
    state.over ||
    autoActing ||
    Production.input.paused
  )
    return;
  if (!$("#spotlight").hidden) {
    if (
      $("#spotlight").dataset.kind === "enemy-intro" ||
      document.body.dataset.scene === "enemy-intro"
    )
      $("#stage-confirm:not(:disabled)")?.click();
    // Event rewards and decisions remain yours; only combat presentation is automated.
    return;
  }
  if (!state.enemy || busy || !$("#overlay").hidden || Date.now() < autoNextAt)
    return;
  const living = state.party
    .map((h, i) => ({ h, i }))
    .filter(({ h }) => alive(h));
  if (!living.length) return;
  autoActing = true;
  try {
    const weakest = living.reduce((a, b) =>
      a.h.hp / a.h.maxHp < b.h.hp / b.h.maxHp ? a : b,
    );
    state.target = weakest.i;
    const foe = livingEnemies().sort((a, b) => a.hp - b.hp)[0];
    if (foe) state.enemy = foe;
    const due = livingEnemies().some((e) => e.countdown <= 1);
    const healer = living.find(({ h }) => h.job === "healer" && !h.stun);
    let actor =
      healer &&
      weakest.h.hp / weakest.h.maxHp < BALANCE.autoresolve.healThreshold
        ? healer
        : living
            .filter(({ h }) => !h.stun)
            .sort((a, b) => autoDamageScore(b.h) - autoDamageScore(a.h))[0] ||
          living[0];
    const itemReady =
      state.actionSerial -
        (state.lastAutoItemAction ?? -BALANCE.autoresolve.itemInterval) >=
      BALANCE.autoresolve.itemInterval;
    if (
      itemReady &&
      weakest.h.hp / weakest.h.maxHp < BALANCE.autoresolve.potionThreshold
    ) {
      const item = ["potion", "ration", "bandage", "salve", "antidote"].find(
        (t) => state.bag[t] && canUseItem(t),
      );
      if (item) {
        state.lastAutoItemAction = state.actionSerial;
        await useItem(item);
        return;
      }
    }
    if (
      due &&
      state.block < 1 &&
      weakest.h.hp / weakest.h.maxHp < BALANCE.autoresolve.wardThreshold &&
      itemReady &&
      state.bag.ward
    ) {
      state.lastAutoItemAction = state.actionSerial;
      await useItem("ward");
      return;
    }
    await spin(actor.i);
  } finally {
    autoActing = false;
    autoNextAt = Date.now() + Math.max(90, 320 / pace());
  }
}
function autoDamageScore(h) {
  return (
    h.reels.reduce(
      (n, r) =>
        n +
        r.reduce(
          (a, f) =>
            a +
            (f.weight || 1) *
              (["attack", "magic"].includes(f.type)
                ? ATTACK_POWER[f.tier]
                : f.type === "class"
                  ? h.job === "rogue"
                    ? BALANCE.autoresolve.sealScores.rogue
                    : h.job === "mage"
                      ? BALANCE.autoresolve.sealScores.mage
                      : BALANCE.autoresolve.sealScores.other
                  : f.type === "poison"
                    ? BALANCE.autoresolve.poisonScore
                    : 0),
          0,
        ) /
          r.reduce((a, f) => a + (f.weight || 1), 0),
      0,
    ) + attackBonus(h)
  );
}
function optionsPage() {
  if (busy) {
    toast("Finish this moment before turning the options page.");
    return;
  }
  openModal(
    "A few notes in the margin",
    `<div class="options-grid"><label>Animation speed<select id="option-speed">${["1", "2", "3", "5", "skip"].map((v) => `<option value="${v}" ${v === state.speed ? "selected" : ""}>${v === "skip" ? "Skip cinematics" : v + "×"}</option>`).join("")}</select><small>Shakes and hit feedback remain at every speed.</small></label><label>Paper & ink<select id="option-palette">${["default", "dark", "warm"].map((v) => `<option value="${v}" ${v === state.palette ? "selected" : ""}>${v[0].toUpperCase() + v.slice(1)}</option>`).join("")}</select></label><label class="auto-option"><input type="checkbox" id="option-auto" ${state.autoresolve ? "checked" : ""}> Autoresolve battles<small>Chooses heroes, targets and occasional emergency supplies. Rewards and choices still wait for you.</small></label></div><div class="modal-actions"><button id="option-guide">Read the field guide</button><button id="option-download">Download HTML backup</button><button class="primary" data-close>Back to this page</button></div>`,
    "options",
  );
  $("#option-speed").onchange = (e) => setPace(e.target.value);
  $("#option-palette").onchange = (e) => setPalette(e.target.value);
  $("#option-auto").onchange = (e) => setAutoresolve(e.target.checked);
  $("#option-guide").onclick = help;
  $("#option-download").onclick = () => $("#download").click();
  Production.ui.extendOptions();
}
function chooseStartingClass(initial = false) {
  if (initial) {
    state.awaitingStarter = true;
    save();
  }
  openModal(
    initial ? "Who opens the notebook?" : "Turn to a fresh page?",
    `<p>${initial ? "Choose the first name in your story." : "Choose a new adventurer. This replaces the current expedition."}</p><div class="starter-grid">${[
      "fighter",
      "healer",
      "rogue",
      "mage",
    ]
      .map((job) => {
        const h = makeHero(
          {
            fighter: "Alden",
            healer: "Mira",
            rogue: "Wren",
            mage: "Orin",
          }[job],
          job,
        );
        return `<button data-start-job="${job}">${portraitArt(job, h)}<b>${className(job)}</b><small>${h.maxHp} HP · ${classAbilityName(job)}</small><span>${classAbilityDescription(job)}</span></button>`;
      })
      .join(
        "",
      )}</div>${initial ? "" : '<div class="modal-actions"><button data-close>Keep this story</button></div>'}`,
    "starter",
  );
  if (initial) $("#modal .close").hidden = true;
}
function openBook(initial = false) {
  Production.audio.play("sfx.page-turn");
  const book = $("#book");
  book.classList.remove("book-closed");
  if (skip) {
    shakeElement(book, 2);
    return;
  }
  const overlay = document.createElement("div");
  overlay.className = initial ? "book-cover" : "turning-page";
  overlay.innerHTML = initial
    ? "<span>SCRATCHPAD<br>DUNGEON<small>A little courage between the covers.</small>✧</span>"
    : "";
  book.append(overlay);
  animate(
    overlay,
    [
      { transform: "rotateY(0deg)", opacity: 1 },
      { transform: "rotateY(-165deg)", opacity: 0 },
    ],
    {
      duration: initial ? 1250 : 850,
      easing: "cubic-bezier(.2,.65,.25,1)",
      fill: "forwards",
    },
  )
    .finished.then(() => overlay.remove())
    .catch(() => overlay.remove());
  burst(book, "paper", 32);
}
function startNewBook(job) {
  newRun(job);
  openBook(false);
}

if (!load()) {
  newRun();
  openBook(true);
  chooseStartingClass(true);
} else {
  render();
  if (state.awaitingStarter) {
    openBook(true);
    chooseStartingClass(true);
  }
  toast(
    state.over
      ? "A finished expedition. A fresh page is waiting."
      : "Your notebook remembers. Welcome back.",
  );
  if (!state.pendingDeaths.length && state.pendingItems.length) {
    busy = true;
    render();
    processPendingItems().then(() => {
      busy = false;
      render();
      save();
    });
  }
  if (state.pendingDeaths.length) {
    busy = true;
    render();
    processDeaths().then(() => {
      checkDefeat();
      busy = false;
      render();
      save();
    });
  }
}

// The production bridge exposes actions, never a second simulation loop.
const productionBridge = {
  width: W,
  context: () => ({
    party: state.party,
    target: state.target,
    position: state.position,
    busy,
    dialog: !$("#overlay").hidden || !$("#spotlight").hidden,
  }),
  prompts: updateKeyboardBar,
  fit: () => {
    fitNotebook();
    fitDialogs();
    positionPlayer(false);
  },
  fitDialogs,
  move: (direction) => {
    const next =
      state.position + { up: -W, down: W, left: -1, right: 1 }[direction];
    if (neighbors(state.position).includes(next)) move(next);
  },
  spin: (i) => startHero(i),
  target: (i) => {
    if (busy || !alive(state.party[i])) return;
    state.target = i;
    renderParty();
    renderTargets();
    save();
  },
  enemyTarget: (delta) => {
    if (busy) return;
    const list = livingEnemies();
    if (list.length)
      selectEnemy(
        list[(list.indexOf(state.enemy) + delta + list.length) % list.length]
          .id,
      );
  },
  inventory: inspectBag,
  guide: help,
  options: optionsPage,
  fastForward,
  pace: () => {
    const rates = ["1", "2", "3", "5", "skip"];
    setPace(rates[(rates.indexOf(state.speed) + 1) % rates.length]);
  },
  palette: () => {
    const colors = ["default", "dark", "warm"];
    setPalette(colors[(colors.indexOf(state.palette) + 1) % colors.length]);
  },
  edit: () => editor(state.target),
  potion: usePotion,
  bomb: useBomb,
  ward: useWard,
  stairs,
  revisit: () => move(state.position),
  download: () => $("#download").click(),
  newRun: () => $("#new-game").click(),
};
Production.input.init(productionBridge);
Production.ui.init(productionBridge);
