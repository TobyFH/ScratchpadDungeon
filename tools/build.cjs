#!/usr/bin/env node
const fs = require("node:fs/promises"),
  sync = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { ROOT, readJSON, assertValid, digest } = require("./balance-lib.cjs");
const assets = require("./assets.cjs");
const jsString = (o) =>
  JSON.stringify(o)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
async function buildHTML({ balance = readJSON("data/balance.json") } = {}) {
  assertValid(balance);
  const manifest = readJSON("data/assets.json"),
    result = assets.validate(manifest);
  if (result.errors.length || result.unused.length)
    throw Error(
      "Asset validation failed:\n" +
        [
          ...result.errors,
          ...result.unused.map((f) => "Unlisted file: " + f),
        ].join("\n"),
    );

  const requireAsset = (id, type) => {
    const a = result.embedded[id];
    if (
      !a ||
      (type === "image"
        ? !["image", "sprite"].includes(a.type)
        : a.type !== type)
    )
      throw Error(
        "Balance / runtime references missing " + type + " asset " + id,
      );
  };
  for (const e of Object.values(balance.enemies)) {
    requireAsset("portrait." + e.art, "image");
    requireAsset("corpse." + e.art, "image");
  }
  for (const job of Object.keys(balance.classes))
    requireAsset("portrait." + job, "image");
  for (const e of [
    ...Object.values(balance.items),
    ...Object.values(balance.equipment),
  ])
    requireAsset("icon." + e.icon, "image");
  for (const id of Object.values(balance.slots.icons))
    requireAsset("icon." + id, "image");
  const resolve = (id) => {
    const a = result.embedded[id];
    if (!a) throw Error("Unknown CSS asset " + id);
    return a.url;
  };
  const css = (
    await fs.readFile(path.join(ROOT, "src/game.css"), "utf8")
  ).replace(/\{\{asset:([^}]+)\}\}/g, (_, id) => resolve(id));
  const services = [];
  for (const name of ["core", "audio", "input", "ui"]) {
    const file = path.join(ROOT, "src/production/" + name + ".js");
    if (sync.existsSync(file)) services.push(await fs.readFile(file, "utf8"));
  }
  const game = await fs.readFile(path.join(ROOT, "src/game.js"), "utf8");
  const payload = {
    balance,
    assets: Object.values(result.embedded),
    build: {
      balanceRevision: balance.revision,
      balanceHash: digest(balance),
      assetHash: digest(manifest),
      version: readJSON("package.json").version,
    },
  };
  // Store shared sprite sheets once in the downloadable HTML. The constructed
  // runtime objects retain ordinary data URLs, including for offline backups.
  const resources = {},
    resourceKeys = new Map();
  const packedAssets = payload.assets.map((a) => {
    let key = resourceKeys.get(a.url);
    if (!key) {
      key = "r" + resourceKeys.size;
      resourceKeys.set(a.url, key);
      resources[key] = a.url;
    }
    const metadata = { ...a };
    delete metadata.url;
    return jsString(metadata).slice(0, -1) + ',"url":r[' + jsString(key) + "]}";
  });
  const packedPayload =
    "(()=>{const r=" +
    jsString(resources) +
    ";return {balance:" +
    jsString(balance) +
    ",assets:[" +
    packedAssets.join(",") +
    "],build:" +
    jsString(payload.build) +
    "};})()";
  const script = `"use strict";\nglobalThis.__PRODUCTION_DATA__=${packedPayload};\n${services.join("\n")}\n${game}`;
  new Function(script);
  const template = await fs.readFile(
    path.join(ROOT, "src/template.html"),
    "utf8",
  );
  if (
    !template.includes("{{GAME_SCRIPT}}") ||
    !template.includes("{{GAME_STYLE}}")
  )
    throw Error(
      "Template must contain the GAME_SCRIPT and GAME_STYLE build markers",
    );
  let html = template
    .replace("{{GAME_STYLE}}", () => css)
    .replace("{{GAME_SCRIPT}}", () => script);
  const notices = [];
  const escapeHTML = (text) =>
    text.replace(
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
  for (const file of new Set(
    manifest.assets
      .flatMap((a) => [a.licenceFile, a.originalLicenceFile])
      .filter(Boolean),
  )) {
    const bytes = await fs.readFile(assets.safePath(file));
    if (bytes.length > 1024 * 1024)
      throw Error("Licence notice exceeds 1 MiB: " + file);
    notices.push(
      '<pre data-licence="' +
        escapeHTML(file) +
        '">' +
        escapeHTML(bytes.toString("utf8")) +
        "</pre>",
    );
  }
  html = html.replace(
    "<script>",
    () =>
      '<template id="asset-licence-notices">' +
      notices.join("\n") +
      "</template>\n<script>",
  );
  const inline = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  if (!inline) throw Error("Template must contain the inline game script");
  const csp =
    "default-src 'none'; script-src 'sha256-" +
    crypto.createHash("sha256").update(inline).digest("base64") +
    "'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-src 'none'";
  return html.replace(
    "<head>",
    '<head>\n    <meta http-equiv="Content-Security-Policy" content="' +
      csp +
      '">',
  );
}

async function main() {
  const html = await buildHTML();
  await fs.writeFile(path.join(ROOT, "index.html.tmp"), html);
  await fs.rename(
    path.join(ROOT, "index.html.tmp"),
    path.join(ROOT, "index.html"),
  );
  console.log(
    "Built index.html: " +
      Buffer.byteLength(html).toLocaleString() +
      " bytes; self-contained and CSP protected.",
  );
}
if (require.main === module)
  main().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
module.exports = { buildHTML };
