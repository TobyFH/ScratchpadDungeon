#!/usr/bin/env node
const fs = require("node:fs/promises"),
  path = require("node:path"),
  acorn = require("acorn");
const { ROOT, readJSON, assertValid } = require("./balance-lib.cjs");
const { validate } = require("./assets.cjs"),
  { readWorkbook } = require("./balance.cjs"),
  { buildHTML } = require("./build.cjs");
(async () => {
  const data = assertValid(readJSON("data/balance.json")),
    manifest = readJSON("data/assets.json"),
    audit = validate(manifest);
  if (audit.errors.length || audit.unused.length)
    throw Error(
      [
        ...audit.errors,
        ...audit.unused.map((p) => "Unlisted asset: " + p),
      ].join("\n"),
    );
  const generated = await buildHTML(),
    current = await fs.readFile(path.join(ROOT, "index.html"), "utf8");
  if (current !== generated)
    throw Error(
      "index.html is stale. Run npm run build and commit the generated file.",
    );
  acorn.parse(current.match(/<script>([\s\S]*?)<\/script>/)[1], {
    ecmaVersion: "latest",
  });
  await readWorkbook(
    path.join(ROOT, "balance/Scratchpad-Dungeon-Balance.xlsx"),
  );
  console.log(
    `Validated balance revision ${data.revision}, ${Object.keys(data.enemies).length} enemies, ${Object.keys(data.items).length + Object.keys(data.equipment).length} items, ${manifest.assets.length} assets, workbook and offline HTML.`,
  );
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
