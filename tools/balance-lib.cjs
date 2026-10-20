const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const ROOT = path.resolve(__dirname, "..");
const readJSON = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
const get = (o, p) =>
  p
    .split("/")
    .filter(Boolean)
    .reduce((a, k) => a?.[k], o);
const set = (o, p, v) => {
  const a = p.split("/").filter(Boolean),
    k = a.pop();
  get(o, a.join("/"))[k] = v;
};
const digest = (o) =>
  crypto.createHash("sha256").update(JSON.stringify(o)).digest("hex");
function fields(data) {
  const out = [];
  const visit = (v, p = "") => {
    if (Array.isArray(v)) {
      v.forEach((x, i) => visit(x, p + "/" + i));
      return;
    }
    if (v && typeof v === "object") {
      for (const [k, x] of Object.entries(v)) visit(x, p + "/" + k);
      return;
    }
    out.push({ id: p, value: v, type: typeof v });
  };
  visit(data);
  return out;
}
function makeSchema(data) {
  return {
    schemaVersion: 1,
    fields: fields(data).map((f) => {
      const a = f.id.split("/").filter(Boolean),
        top = a[0],
        leaf = a.at(-1),
        entity = [
          "classes",
          "items",
          "equipment",
          "enemies",
          "abilities",
          "reelSets",
          "eventReels",
        ].includes(top)
          ? data[top][a[1]].id
          : top === "artefacts"
            ? data.artefacts[a[1]].id
            : top === "elites"
              ? data.elites[a[1]].id
              : "rule." + a.slice(0, -1).join(".");
      let sheet =
        {
          classes: "Classes",
          enemies: "Enemies",
          items: "Items",
          equipment: "Equipment",
          abilities: "Abilities",
          loot: "Loot",
          artefacts: "Artefacts",
          elites: "Enemies",
          rules: "Progression",
          slots: "Slots",
          enemyReels: "Reels",
          bosses: "Enemies",
          encounterPools: "Enemies",
          engine: "Engine",
          tuning: data.tuning[a[1]]?.category || "World",
        }[top] || "World";
      if (
        a.includes("reels") ||
        a.includes("reel") ||
        top === "reelSets" ||
        top === "eventReels"
      )
        sheet = "Reels";
      const readonly =
        ["schemaVersion", "revision", "engine"].includes(top) ||
        leaf === "id" ||
        (top === "tuning" && leaf !== "value") ||
        (top === "slots" && ["types", "icons"].includes(a[1])) ||
        a.includes("last") ||
        top === "enemyReelRefs";
      let min = 0,
        max = 100000,
        integer = Number.isInteger(f.value),
        unit = "";
      if (top === "tuning") {
        const t = data.tuning[a[1]];
        min = t.min;
        max = t.max;
        integer = t.integer;
        unit = t.unit;
      }
      if (top === "loot") {
        min = 0.0001;
        max = 100000;
        integer = false;
      }
      if (leaf === "weight") {
        min = 0.0001;
        max = 100000;
        integer = false;
        unit = "relative weight";
      }
      if (leaf === "tier") {
        integer = true;
        min = 1;
        max = 4;
        unit = "tier";
      }
      if (leaf === "maxHp") {
        min = 1;
        max = 100000;
        unit = "HP";
      }
      if (/Multiplier|Fraction/.test(leaf)) {
        min = 0.0001;
        max = /Fraction/.test(leaf) ? 1 : 100;
        integer = false;
      }
      if (["minFloor", "maxFloor"].includes(leaf)) {
        min = 1;
        max = data.rules.floors;
      }
      if (leaf === "maxParty") {
        min = 1;
        max = data.engine.maxSupportedParty;
      }
      if (leaf === "bagTypes") {
        min = 1;
        max = 3;
      }
      if (top === "world" && a[1] === "events") {
        min = 0;
        max = 30;
      }
      if (top === "tuning" && integer) {
        min = Math.max(1, min);
        max = Math.min(100, max);
      }
      if (top === "tuning" && a[1] === "world.ambushAgeMs") {
        min = 1000;
        max = 3600000;
      }
      if (top === "tuning" && a[1].startsWith("addCaveRooms.") && integer) {
        min = f.value;
        max = f.value;
      }
      if (
        top === "tuning" &&
        a[1].startsWith("generateFloor.") &&
        integer &&
        !a[1].includes("riverCount")
      ) {
        min = f.value;
        max = f.value;
      }
      if (top === "tuning" && a[1] === "generateFloor.riverCount.2") {
        min = 1;
        max = 2;
      }
      if (top === "tuning" && a[1] === "beaconTiles.extra.1") {
        min = 1;
        max = 5;
      }
      if (top === "tuning" && a[1] === "beginEncounter.count.6") {
        min = 1;
        max = 2;
      }
      if (top === "tuning" && a[1] === "beginEncounter.band.1") {
        min = 0;
        max = data.encounterPools.bands.length - 1;
      }
      if (top === "tuning" && a[1] === "makeArtefact.name.1") {
        min = 0;
        max = 3;
      }
      if (top === "rules" && leaf === "areaAttackTier") {
        min = 1;
        max = 4;
      }
      if (top === "world" && leaf === "mimicChance") {
        min = 0;
        max = 1;
        integer = false;
      }
      if (top === "world" && leaf === "shopExtraStock") {
        min = 0;
        max = Object.keys(data.items).length - 3;
      }
      if (leaf === "frequencyOverride" || leaf === "strikesOverride") {
        min = 0;
        max = 10;
      }
      if (leaf === "floors") {
        min = data.bosses.length;
        max = data.bosses.length;
      }
      if (/Divisor|Threshold/.test(leaf)) {
        min = integer ? 1 : 0;
        max = integer ? 10000 : 1;
      }
      if (
        [
          "levelHp",
          "levelPoints",
          "xpPerLevel",
          "blankInscriptionCost",
          "stunArmourCost",
        ].includes(leaf)
      ) {
        min = 1;
        max = 1000;
      }
      return {
        ...f,
        value: undefined,
        ...(readonly && top !== "revision" ? { expected: f.value } : {}),
        sheet,
        entity,
        label:
          top === "tuning"
            ? data.tuning[a[1]].label
            : a.slice(2).join(" · ") || leaf,
        readonly,
        min,
        max,
        integer,
        unit,
        description: top === "tuning" ? data.tuning[a[1]].description : "",
      };
    }),
  };
}
function validate(data, schema = readJSON("data/balance.schema.json")) {
  const errors = [],
    all = fields(data),
    actual = new Map(all.map((f) => [f.id, f]));
  for (const spec of schema.fields) {
    const f = actual.get(spec.id);
    if (!f) {
      errors.push(spec.id + ": missing required field");
      continue;
    }
    actual.delete(spec.id);
    if (Object.hasOwn(spec, "expected") && f.value !== spec.expected)
      errors.push(spec.id + ": protected structure or identity was changed");
    if (f.type !== spec.type) {
      errors.push(spec.id + ": expected " + spec.type);
      continue;
    }
    if (spec.readonly) continue;
    if (
      spec.type === "number" &&
      (!Number.isFinite(f.value) ||
        f.value < spec.min ||
        f.value > spec.max ||
        (spec.integer && !Number.isInteger(f.value)))
    )
      errors.push(
        spec.id +
          `: expected ${spec.integer ? "integer" : "number"} in [${spec.min}, ${spec.max}]`,
      );
    if (
      spec.type === "string" &&
      !spec.readonly &&
      (f.value.length > 4096 ||
        /[<>\u0000-\u001f]/.test(f.value) ||
        /^=/.test(f.value))
    )
      errors.push(
        spec.id +
          ": invalid text (markup, control characters and formulas are not allowed)",
      );
  }
  for (const id of actual.keys()) errors.push(id + ": unknown field");
  if (errors.length) return errors;
  const symbols = new Set([
    ...data.slots.types,
    "miss",
    "coin",
    "safe",
    "trap",
    "artefact",
    "point",
    "multiplier",
    ...Object.keys(data.items),
    ...Object.keys(data.equipment),
  ]);
  function reels(
    rs,
    hero = false,
    where = "reels",
    allowed = new Set([
      ...data.slots.types.filter((type) => hero || type !== "class"),
      ...(!hero ? ["miss"] : []),
    ]),
  ) {
    if (rs.length !== data.engine.reelsPerMachine)
      errors.push(where + ": exactly three reels required");
    rs.forEach((r, k) => {
      if (!r.length || r.reduce((n, f) => n + (f.weight ?? 1), 0) <= 0)
        errors.push(where + ": empty/zero-weight reel");
      if (
        hero &&
        ((k !== 1 && r.some((f) => f.type === "class")) ||
          r.filter((f) => f.type === "class").length > 1)
      )
        errors.push(
          where + ": class seal is permitted once, on the middle reel only",
        );
      r.forEach((f) => {
        if (!symbols.has(f.type) || !allowed.has(f.type))
          errors.push(where + ": unknown symbol " + f.type);
        const max = ["attack", "magic"].includes(f.type)
          ? 4
          : ["class", "blank", "miss"].includes(f.type)
            ? 1
            : 3;
        if (!Number.isInteger(f.tier) || f.tier < 1 || f.tier > max)
          errors.push(where + ": invalid " + f.type + " tier");
        if (f.job && !data.classes[f.job])
          errors.push(where + ": unknown class " + f.job);
      });
    });
  }
  for (const [job, c] of Object.entries(data.classes))
    reels(c.reels, true, c.id);
  for (const e of Object.values(data.enemies)) {
    if (!data.reelSets[e.reelSet])
      errors.push(e.id + ": unknown reel set " + e.reelSet);
    if (e.minFloor > e.maxFloor)
      errors.push(e.id + ": minFloor exceeds maxFloor");
  }
  for (const r of Object.values(data.reelSets)) reels(r.reels, false, r.id);
  reels(
    [data.loot.coins, data.loot.coins, data.loot.coins],
    false,
    "loot.coins",
    new Set(["coin"]),
  );
  const eventSymbols = {
    trap: ["safe", "trap", "block"],
    ruin: ["coin", "trap", "safe"],
    well: ["heal", "blank"],
    inkBomb: ["attack", "poison", "blank"],
    rockfall: ["safe", "trap"],
  };
  for (const [key, r] of Object.entries(data.eventReels))
    reels([r.faces, r.faces, r.faces], false, r.id, new Set(eventSymbols[key]));
  reels(
    [
      data.abilities.rogue.reel,
      data.abilities.rogue.reel,
      data.abilities.rogue.reel,
    ],
    false,
    "ability.flurry",
    new Set(["attack"]),
  );
  for (const id of [
    ...data.bosses,
    ...Object.values(data.encounterPools).flat(),
  ])
    if (!data.enemies[id]) errors.push("Unknown enemy reference " + id);
  for (const [type, e] of Object.entries(data.equipment))
    if (!data.classes[e.job])
      errors.push("equipment." + type + ": unknown class " + e.job);
  const assetIds = new Set(
    readJSON("data/assets.json").assets.map((a) => a.id),
  );
  for (const e of Object.values(data.enemies))
    for (const kind of ["portrait", "corpse"])
      if (!assetIds.has(kind + "." + e.art))
        errors.push(e.id + ": missing " + kind + " asset " + e.art);
  for (const e of [
    ...Object.values(data.items),
    ...Object.values(data.equipment),
  ])
    if (!assetIds.has("icon." + e.icon))
      errors.push(e.id + ": missing icon asset " + e.icon);
  const ids = [
    ...Object.values(data.classes),
    ...Object.values(data.items),
    ...Object.values(data.equipment),
    ...Object.values(data.enemies),
    ...Object.values(data.abilities),
    ...Object.values(data.reelSets),
    ...Object.values(data.eventReels),
    ...data.artefacts,
    ...data.elites,
  ].map((e) => e.id);
  if (new Set(ids).size !== ids.length)
    errors.push("Entity IDs must be unique");
  if (data.slots.criticalMultipliers.some((n) => n <= 1))
    errors.push("Critical multipliers must exceed one");
  if (data.slots.attackPower.some((n, i, a) => i && n < a[i - 1]))
    errors.push("Attack tier power must be nondecreasing");
  const t = data.tuning;
  if (
    t["generateFloor.riverCount.1"] &&
    t["generateFloor.riverCount.3"] &&
    t["generateFloor.riverCount.1"].value >
      t["generateFloor.riverCount.3"].value
  )
    errors.push("Double river threshold must not exceed river threshold");

  if (
    t["addCaveRooms.desired.1"].value > t["addCaveRooms.desired.2"].value ||
    t["addCaveRooms.desired.2"].value > t["addCaveRooms.desired.3"].value
  )
    errors.push("Room probability thresholds must be ascending");
  for (let depth = 1; depth <= data.rules.floors; depth++) {
    const pool =
      depth >= t["beginEncounter.pools.1"].value
        ? data.encounterPools.deep
        : depth >= t["beginEncounter.pools.2"].value
          ? data.encounterPools.middle
          : data.encounterPools.early;
    const band =
      data.encounterPools.bands[
        Math.min(
          t["beginEncounter.band.1"].value,
          Math.floor((depth - 1) / t["beginEncounter.band.2"].value),
        )
      ];
    if (
      ![...pool, band].some(
        (id) =>
          data.enemies[id] &&
          depth >= data.enemies[id].minFloor &&
          depth <= data.enemies[id].maxFloor,
      )
    )
      errors.push("No eligible encounter on floor " + depth);
  }
  for (const [job, c] of Object.entries(data.classes))
    for (const f of c.reels[1])
      if (f.type === "class" && f.job !== job)
        errors.push(c.id + ": middle seal must match its class");
  return errors;
}
function assertValid(data) {
  const e = validate(data);
  if (e.length)
    throw Error(
      "Balance validation failed:\n" + e.map((x) => "  • " + x).join("\n"),
    );
  return data;
}
module.exports = {
  ROOT,
  readJSON,
  get,
  set,
  digest,
  fields,
  makeSchema,
  validate,
  assertValid,
};
