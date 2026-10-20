#!/usr/bin/env node
const fs = require("node:fs/promises"),
  path = require("node:path"),
  ExcelJS = require("exceljs");
const lib = require("./balance-lib.cjs");
const { ROOT, readJSON, get, set, digest, assertValid } = lib;
const VALUE_COLUMN = 4,
  HEADER = [
    "Stable field ID",
    "Entity ID",
    "Field / label",
    "Value (edit blue cells)",
    "Type",
    "Unit",
    "Minimum",
    "Maximum",
    "Notes",
  ];
async function exportWorkbook(
  destination = path.join(ROOT, "balance/Scratchpad-Dungeon-Balance.xlsx"),
  data = readJSON("data/balance.json"),
) {
  assertValid(data);
  const schema = readJSON("data/balance.schema.json"),
    book = new ExcelJS.Workbook();
  book.creator = "Scratchpad Dungeon";
  book.created = new Date("2026-01-01T00:00:00Z");
  book.modified = new Date("2026-01-01T00:00:00Z");
  book.calcProperties.fullCalcOnLoad = true;
  const help = book.addWorksheet("Readme");
  [
    ["Scratchpad Dungeon · authoritative balance workbook"],
    [
      "Edit blue Value cells only. IDs, columns, sheets and protected metadata must stay intact.",
    ],
    ["Import: npm run balance:import -- path/to/edited.xlsx"],
    [
      "Validate without writing: npm run balance:validate -- path/to/edited.xlsx",
    ],
    ["Export fresh after an import: npm run balance:export"],
    [
      "The importer rejects formulas in input cells, unknown/missing/duplicate fields, invalid types, unsafe text and broken references.",
    ],
    [
      "All sheets are validated together before any source or build is replaced.",
    ],
    [
      "data/balance.json is the runtime source. This workbook is an editable export.",
    ],
    [
      "Statistics recalculate in Excel/LibreOffice; import recomputes build data from input cells, never cached formula results.",
    ],
    [
      "Reel statistics: level-one base face power and triple-match probability; excludes class powers, buffs, gear and target armour.",
    ],
    [
      "Enemy HP statistics use the normal/boss/stronghold curve plus per-type multiplier. Other figures are baseline snapshots regenerated after import.",
    ],
    ["Schema", String(schema.schemaVersion)],
    ["Schema digest", digest(schema)],
    ["Balance revision", String(data.revision)],
    ["Source digest", digest(data)],
  ].forEach((r) => help.addRow(r));
  help.columns = [{ width: 145 }, { width: 75 }];
  const sheets = {},
    refs = {};
  for (const spec of schema.fields) {
    if (["schemaVersion", "revision"].includes(spec.id.slice(1))) continue;
    let ws = sheets[spec.sheet];
    if (!ws) {
      ws = book.addWorksheet(spec.sheet);
      sheets[spec.sheet] = ws;
      ws.addRow(HEADER);
      ws.views = [{ state: "frozen", ySplit: 1 }];
      ws.columns = [
        { width: 67 },
        { width: 30 },
        { width: 40 },
        { width: 40 },
        { width: 12 },
        { width: 24 },
        { width: 12 },
        { width: 12 },
        { width: 94 },
      ];
      ws.autoFilter = "A1:I1";
      ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      ws.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF42533C" },
      };
    }
    const row = ws.addRow([
      spec.id,
      spec.entity,
      spec.label,
      get(data, spec.id),
      spec.type,
      spec.unit,
      spec.type === "number" ? spec.min : "",
      spec.type === "number" ? spec.max : "",
      spec.readonly ? "READ ONLY" : spec.description,
    ]);
    const cell = row.getCell(VALUE_COLUMN);
    cell.font = { color: { argb: spec.readonly ? "FF777777" : "FF125BB0" } };
    cell.protection = { locked: spec.readonly };
    refs[spec.id] = `'${spec.sheet}'!D${row.number}`;
    if (!spec.readonly && spec.type === "number")
      cell.dataValidation = {
        type: spec.integer ? "whole" : "decimal",
        operator: "between",
        formulae: [spec.min, spec.max],
        showErrorMessage: true,
        errorStyle: "stop",
        errorTitle: "Invalid balance value",
        error: `Use ${spec.integer ? "an integer" : "a number"} between ${spec.min} and ${spec.max}.`,
      };
    if (!spec.readonly && spec.type === "boolean")
      cell.dataValidation = {
        type: "list",
        formulae: ['"TRUE,FALSE"'],
        showErrorMessage: true,
        error: "Use TRUE or FALSE.",
      };
  }
  const formulaSheet = book.addWorksheet("Roll Analysis");
  formulaSheet.addRow([
    "Class",
    "Outcome",
    "Probability",
    "Base damage",
    "Base healing",
    "Base block",
    "Three alike?",
    "Critical probability",
  ]);
  formulaSheet.columns = [
    { width: 20 },
    { width: 45 },
    { width: 22 },
    { width: 22 },
    { width: 22 },
    { width: 22 },
    { width: 20 },
    { width: 22 },
  ];
  formulaSheet.views = [{ state: "frozen", ySplit: 1 }];
  const stats = book.addWorksheet("Statistics");
  stats.addRow([
    "Entity ID",
    "Name",
    "Metric",
    "Calculated value",
    "Definition",
  ]);
  stats.columns = [
    { width: 35 },
    { width: 30 },
    { width: 38 },
    { width: 24 },
    { width: 98 },
  ];
  stats.views = [{ state: "frozen", ySplit: 1 }];
  const r = (p) => refs[p],
    cv = (row, col) => `${col}${row}`;
  for (const [job, c] of Object.entries(data.classes)) {
    const first = formulaSheet.rowCount + 1;
    let expected = [0, 0, 0],
      critical = 0;
    for (let a = 0; a < c.reels[0].length; a++)
      for (let b = 0; b < c.reels[1].length; b++)
        for (let z = 0; z < c.reels[2].length; z++) {
          const idx = [a, b, z],
            faces = idx.map((j, k) => c.reels[k][j]),
            prob = faces.reduce(
              (p, f, k) =>
                (p * (f.weight ?? 1)) /
                c.reels[k].reduce((n, x) => n + (x.weight ?? 1), 0),
              1,
            ),
            match =
              faces[0].type !== "blank" &&
              faces[0].type !== "class" &&
              faces[0].type === faces[2].type &&
              faces[0].tier === faces[2].tier &&
              (faces[1].type === "class" ||
                (faces[1].type === faces[0].type &&
                  faces[1].tier === faces[0].tier));
          const base = faces.reduce(
            (out, f) => {
              if (["attack", "magic"].includes(f.type))
                out[0] += data.slots.attackPower[f.tier];
              if (f.type === "heal") out[1] += data.slots.power.heal * f.tier;
              if (f.type === "block") out[2] += data.slots.power.block * f.tier;
              return out;
            },
            [0, 0, 0],
          );
          expected = expected.map((x, i) => x + prob * base[i]);
          if (match) critical += prob;
          const pfx = (k) => `/classes/${job}/reels/${k}/${idx[k]}`,
            type = (k) => r(pfx(k) + "/type"),
            tier = (k) => r(pfx(k) + "/tier"),
            weight = (k) => r(pfx(k) + "/weight");
          const probFormula = [0, 1, 2]
            .map(
              (k) =>
                `(${weight(k)}/(${c.reels[k].map((_, j) => r(`/classes/${job}/reels/${k}/${j}/weight`)).join("+")}))`,
            )
            .join("*");
          const powerFormula = (types, kind) =>
            [0, 1, 2]
              .map((k) =>
                kind === "damage"
                  ? `IF(OR(${type(k)}="attack",${type(k)}="magic"),CHOOSE(${tier(k)}+1,${data.slots.attackPower.map((_, j) => r("/slots/attackPower/" + j)).join(",")}),0)`
                  : `IF(${type(k)}="${kind}",${tier(k)}*${r("/slots/power/" + kind)},0)`,
              )
              .join("+");
          const row = formulaSheet.addRow([
            c.id,
            faces.map((f) => f.type + f.tier).join(" / "),
            { formula: probFormula, result: prob },
            { formula: powerFormula(null, "damage"), result: base[0] },
            { formula: powerFormula(null, "heal"), result: base[1] },
            { formula: powerFormula(null, "block"), result: base[2] },
            {
              formula: `AND(${type(0)}<>"blank",${type(0)}<>"class",${type(0)}=${type(2)},${tier(0)}=${tier(2)},OR(${type(1)}="class",AND(${type(1)}=${type(0)},${tier(1)}=${tier(0)})))`,
              result: match,
            },
            {
              formula: `IF(G${formulaSheet.rowCount + 1},C${formulaSheet.rowCount + 1},0)`,
              result: match ? prob : 0,
            },
          ]);
          row.getCell(3).numFmt = "0.000000%";
        }
    const last = formulaSheet.rowCount;
    for (const [label, col, value] of [
      ["Expected base damage", "D", expected[0]],
      ["Expected base healing", "E", expected[1]],
      ["Expected base block", "F", expected[2]],
    ])
      stats.addRow([
        c.id,
        c.name,
        label,
        {
          formula: `SUMPRODUCT('Roll Analysis'!C${first}:C${last},'Roll Analysis'!${col}${first}:${col}${last})`,
          result: value,
        },
        "Per spin, before class powers, criticals, armour, gear or buffs.",
      ]);
    const row = stats.addRow([
      c.id,
      c.name,
      "Triple / class-wild probability",
      { formula: `SUM('Roll Analysis'!H${first}:H${last})`, result: critical },
      "Type and tier must match. Blanks excluded; middle class seal is wild.",
    ]);
    row.getCell(4).numFmt = "0.00%";
  }
  const t = (id) => r("/tuning/" + id + "/value");
  for (const e of Object.values(data.enemies))
    for (let d = e.minFloor; d <= e.maxFloor; d++) {
      const boss = e.id.startsWith("boss."),
        strong = e.id === data.encounterPools.stronghold,
        elite = boss || strong;
      const growth = `MAX(0,${d}-${t("enemy.growthStartDepth")})`;
      const hp = boss
        ? `${t("enemy.bossHpBase")}+${d}*${t("enemy.bossHpPerDepth")}+${growth}^2*${t("enemy.bossHpQuadratic")}`
        : `(${t("enemy.hpBase")}+${d}*${t("enemy.hpPerDepth")}+${growth}^2*${t("enemy.hpQuadratic")})${elite ? "*" + t("enemy.eliteHpMultiplier") : ""}${strong ? "*" + t("enemy.strongholdHpMultiplier") : ""}${e.id === data.encounterPools.mimic ? "*" + t("enemy.mimicHpMultiplier") : ""}`;
      const formula = `ROUNDUP(ROUNDUP(${hp},0)*${r("/enemies/" + e.id + "/hpMultiplier")},0)`;
      const g = Math.max(0, d - data.tuning["enemy.growthStartDepth"].value);
      let base = boss
        ? data.tuning["enemy.bossHpBase"].value +
          d * data.tuning["enemy.bossHpPerDepth"].value +
          g * g * data.tuning["enemy.bossHpQuadratic"].value
        : (data.tuning["enemy.hpBase"].value +
            d * data.tuning["enemy.hpPerDepth"].value +
            g * g * data.tuning["enemy.hpQuadratic"].value) *
          (elite ? data.tuning["enemy.eliteHpMultiplier"].value : 1) *
          (strong ? data.tuning["enemy.strongholdHpMultiplier"].value : 1) *
          (e.id === data.encounterPools.mimic
            ? data.tuning["enemy.mimicHpMultiplier"].value
            : 1);
      stats.addRow([
        e.id,
        e.name,
        "Maximum HP · floor " + d,
        { formula, result: Math.ceil(Math.ceil(base) * e.hpMultiplier) },
        "Base normal / guardian / stronghold curve; rare random elite and paired modifiers excluded.",
      ]);
      const v = (id) => data.tuning[id].value,
        ep = "/enemies/" + e.id;
      const damageBase = boss
        ? v("enemyBalance.damage.1") +
          Math.floor(d / v("enemyBalance.damage.2"))
        : Math.max(
            1,
            Math.floor(
              v("enemyBalance.damage.3") +
                Math.floor((d - 1) / v("enemyBalance.damage.4")) +
                (elite ? 1 : 0) +
                (strong ? 1 : 0),
            ),
          );
      const damageFormula = boss
        ? `${t("enemyBalance.damage.1")}+ROUNDDOWN(${d}/${t("enemyBalance.damage.2")},0)`
        : `MAX(1,ROUNDDOWN(${t("enemyBalance.damage.3")}+ROUNDDOWN((${d}-1)/${t("enemyBalance.damage.4")},0)+${elite ? 1 : 0}+${strong ? 1 : 0},0))`;
      const damage = Math.max(1, Math.floor(damageBase * e.damageMultiplier)),
        dr = stats.addRow([
          e.id,
          e.name,
          "Damage rating · floor " + d,
          {
            formula: `MAX(1,ROUNDDOWN((${damageFormula})*${r(ep + "/damageMultiplier")},0))`,
            result: damage,
          },
          "A rating used to scale attack faces; not damage per hit. Random elite affixes excluded.",
        ]).number;
      const frequency = strong
        ? v("enemyBalance.frequency.1")
        : boss
          ? d >= v("enemyBalance.frequency.2")
            ? 1
            : v("enemyBalance.frequency.3")
          : d < v("enemyBalance.frequency.4")
            ? v("enemyBalance.frequency.5")
            : d < v("enemyBalance.frequency.6")
              ? v("enemyBalance.frequency.7")
              : 1;
      const frequencyFormula = strong
        ? t("enemyBalance.frequency.1")
        : boss
          ? `IF(${d}>=${t("enemyBalance.frequency.2")},1,${t("enemyBalance.frequency.3")})`
          : `IF(${d}<${t("enemyBalance.frequency.4")},${t("enemyBalance.frequency.5")},IF(${d}<${t("enemyBalance.frequency.6")},${t("enemyBalance.frequency.7")},1))`;
      stats.addRow([
        e.id,
        e.name,
        "Player actions per turn · floor " + d,
        {
          formula: `IF(${r(ep + "/frequencyOverride")}>0,${r(ep + "/frequencyOverride")},${frequencyFormula})`,
          result: e.frequencyOverride || frequency,
        },
        "Lower means more frequent enemy turns; Frenzied elites reduce this further.",
      ]);
      const strikes =
        (boss && d >= v("enemyBalance.strikes.1")) ||
        (strong && d >= v("enemyBalance.strikes.2"))
          ? v("enemyBalance.strikes.3")
          : 1;
      stats.addRow([
        e.id,
        e.name,
        "Strikes per enemy turn · floor " + d,
        {
          formula: `IF(${r(ep + "/strikesOverride")}>0,${r(ep + "/strikesOverride")},IF(OR(AND(${boss ? "TRUE" : "FALSE"},${d}>=${t("enemyBalance.strikes.1")}),AND(${strong ? "TRUE" : "FALSE"},${d}>=${t("enemyBalance.strikes.2")})),${t("enemyBalance.strikes.3")},1))`,
          result: e.strikesOverride || strikes,
        },
        "Each strike makes a separate roll.",
      ]);
      const reels = data.reelSets[e.reelSet].reels,
        maxAttack = reels.reduce(
          (n, reel) =>
            n +
            Math.max(
              0,
              ...reel.map((f) =>
                ["attack", "magic"].includes(f.type)
                  ? data.slots.attackPower[f.tier]
                  : 0,
              ),
            ),
          0,
        ),
        maxMultiplier = Math.max(...data.slots.criticalMultipliers);
      const maxFaceFormula = reels
        .map(
          (reel, k) =>
            `MAX(${reel
              .map((f, j) => {
                const p = "/reelSets/" + e.reelSet + "/reels/" + k + "/" + j;
                return `IF(OR(${r(p + "/type")}="attack",${r(p + "/type")}="magic"),CHOOSE(${r(p + "/tier")}+1,${data.slots.attackPower.map((_, i) => r("/slots/attackPower/" + i)).join(",")}),0)`;
              })
              .join(",")})`,
        )
        .join("+");
      stats.addRow([
        e.id,
        e.name,
        "Upper bound critical · floor " + d,
        {
          formula: `ROUNDUP(ROUNDUP((${maxFaceFormula})*D${dr}/${t("enemyTurn.attack.1")},0)*MAX(${data.slots.criticalMultipliers.map((_, i) => r("/slots/criticalMultipliers/" + i)).join(",")}),0)`,
          result: Math.ceil(
            Math.ceil((maxAttack * damage) / v("enemyTurn.attack.1")) *
              maxMultiplier,
          ),
        },
        "Conservative raw damage bound for one attack, before armour, buffs, affixes or target defence. The maximum faces may not all match.",
      ]);
    }
  for (const ws of Object.values(sheets))
    await ws.protect("scratchpad-layout", {
      selectLockedCells: true,
      selectUnlockedCells: true,
      formatCells: false,
    });
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await book.xlsx.writeFile(destination);
  return destination;
}

// Check central-directory limits before ExcelJS expands any worksheet XML.
async function inspectWorkbookZip(file) {
  const yauzl = require("yauzl");
  return new Promise((resolve, reject) =>
    yauzl.open(
      file,
      { lazyEntries: true, validateEntrySizes: true },
      (error, zip) => {
        if (error)
          return reject(Error("Invalid XLSX archive: " + error.message));
        let expanded = 0,
          count = 0;
        const fail = (message) => {
          zip.close();
          reject(Error(message));
        };
        zip.on("error", reject);
        zip.on("entry", (entry) => {
          expanded += entry.uncompressedSize;
          count++;
          if (
            count > 300 ||
            expanded > 32 * 1024 * 1024 ||
            entry.uncompressedSize > 12 * 1024 * 1024
          )
            return fail("Workbook expands beyond safe XLSX limits");
          if (
            entry.generalPurposeBitFlag & 1 ||
            /externalLinks|vbaProject|\.bin$|(?:^|\/)\.\.(?:\/|$)/i.test(
              entry.fileName,
            )
          )
            return fail(
              "Encrypted, macro-enabled and externally linked workbooks are not supported",
            );
          zip.readEntry();
        });
        zip.on("end", resolve);
        zip.readEntry();
      },
    ),
  );
}
async function readWorkbook(file) {
  const stat = await fs.stat(file);
  if (stat.size > 8 * 1024 * 1024) throw Error("Workbook exceeds 8 MiB limit");
  await inspectWorkbookZip(file);
  const book = new ExcelJS.Workbook();
  await book.xlsx.readFile(file);
  const schema = readJSON("data/balance.schema.json"),
    data = structuredClone(readJSON("data/balance.json")),
    specs = new Map(schema.fields.map((f) => [f.id, f])),
    seen = new Set(),
    errors = [];
  const sheets = new Set(schema.fields.map((f) => f.sheet));
  const help = book.getWorksheet("Readme"),
    metadata = new Map();
  help?.eachRow((row) =>
    metadata.set(row.getCell(1).value, row.getCell(2).value),
  );
  if (metadata.get("Schema digest") !== digest(schema))
    errors.push(
      "Workbook schema is obsolete. Export a fresh workbook and transfer the edited values.",
    );
  if (metadata.get("Source digest") !== digest(data))
    errors.push(
      "Workbook was exported from a different balance revision. Export fresh before editing to avoid overwriting newer changes.",
    );
  for (const ws of book.worksheets)
    if (
      !sheets.has(ws.name) &&
      !["Readme", "Statistics", "Roll Analysis"].includes(ws.name)
    )
      errors.push("Unknown sheet " + ws.name);
  for (const name of sheets) {
    const ws = book.getWorksheet(name);
    if (!ws) {
      errors.push("Missing sheet " + name);
      continue;
    }
    if (HEADER.some((h, i) => ws.getRow(1).getCell(i + 1).value !== h)) {
      errors.push(name + ": column headings changed");
      continue;
    }
    ws.eachRow((row, n) => {
      if (n === 1 || row.getCell(1).value == null) return;
      const id = row.getCell(1).value,
        spec = specs.get(id),
        where = name + "!D" + n;
      if (!spec) {
        errors.push(where + ": unknown field ID " + id);
        return;
      }
      if (spec.sheet !== name) {
        errors.push(where + ": field is on the wrong sheet");
        return;
      }
      if (seen.has(id)) {
        errors.push(where + ": duplicate field " + id);
        return;
      }
      seen.add(id);
      let value = row.getCell(4).value;
      if (value && typeof value === "object") {
        errors.push(
          where +
            ": formulas and structured cells are forbidden in input values",
        );
        return;
      }
      if (spec.readonly) {
        if (value !== get(data, id))
          errors.push(where + ": read-only field was changed: " + id);
        return;
      }
      if (
        spec.type === "boolean" &&
        typeof value === "string" &&
        /^(true|false)$/i.test(value)
      )
        value = value.toLowerCase() === "true";
      set(data, id, value);
    });
  }
  for (const spec of schema.fields)
    if (
      !["/schemaVersion", "/revision"].includes(spec.id) &&
      !seen.has(spec.id)
    )
      errors.push("Missing field " + spec.id);
  errors.push(...lib.validate(data, schema));
  if (errors.length)
    throw Error(
      "Import rejected; no files changed:\n" +
        errors.map((e) => "  • " + e).join("\n"),
    );
  return data;
}
async function main() {
  const [cmd = "export", file] = process.argv.slice(2);
  if (cmd === "export") {
    console.log(await exportWorkbook(file && path.resolve(file)));
    return;
  }
  if (!file) throw Error("Usage: balance.cjs import|validate workbook.xlsx");
  const data = await readWorkbook(path.resolve(file));
  if (cmd === "validate") {
    console.log("Workbook valid. No files changed.");
    return;
  }
  if (cmd !== "import") throw Error("Unknown command " + cmd);
  data.revision++;
  const json = JSON.stringify(data, null, 2) + "\n";
  const build = require("./build.cjs");
  const html = await build.buildHTML({ balance: data }); // complete all validation before mutation
  const target = path.join(ROOT, "data/balance.json"),
    output = path.join(ROOT, "index.html"),
    backup = target + ".backup";
  const oldJSON = await fs.readFile(target),
    oldHTML = await fs.readFile(output);
  await fs.copyFile(target, backup);
  try {
    await fs.writeFile(target + ".tmp", json);
    await fs.writeFile(output + ".tmp", html);
    await fs.rename(target + ".tmp", target);
    await fs.rename(output + ".tmp", output);
  } catch (error) {
    await fs.writeFile(target, oldJSON);
    await fs.writeFile(output, oldHTML);
    throw Error("Import failed and prior files restored: " + error.message);
  } finally {
    await fs.rm(target + ".tmp", { force: true });
    await fs.rm(output + ".tmp", { force: true });
  }
  console.log(
    "Imported revision " +
      data.revision +
      ". Previous balance saved to " +
      backup +
      ". index.html rebuilt. Run balance:export to refresh statistics.",
  );
}
if (require.main === module)
  main().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
module.exports = { exportWorkbook, readWorkbook, inspectWorkbookZip };
