#!/usr/bin/env node
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { ROOT, readJSON } = require("./balance-lib.cjs");
const hash = (b) => crypto.createHash("sha256").update(b).digest("hex");
function safePath(file) {
  if (
    typeof file !== "string" ||
    !file.startsWith("assets/") ||
    file.includes("..") ||
    file.includes("\\") ||
    file.includes(":")
  )
    throw Error("Asset path must stay inside assets/: " + file);
  const p = path.resolve(ROOT, file);
  if (!p.startsWith(path.join(ROOT, "assets") + path.sep))
    throw Error("Asset path escapes project");
  return p;
}
function inspect(file, bytes) {
  const ext = path.extname(file).toLowerCase();
  if (bytes.length > 12 * 1024 * 1024)
    throw Error(file + ": asset exceeds 12 MiB limit");
  if (ext === ".svg") {
    const text = bytes.toString("utf8");
    if (!/^\s*<svg[\s>]/i.test(text)) throw Error(file + ": SVG root required");
    if (
      /<!DOCTYPE|<!ENTITY|<\s*(?:script|foreignObject|style|iframe|object|embed|animate|set|a|image)\b|\son\w+\s*=|\b(?:href|src|style)\s*=|@import|\\|&(?!(?:amp|lt|gt|quot|apos);)|url\(\s*[^#]/i.test(
        text,
      )
    )
      throw Error(
        file + ": unsafe SVG content (use basic drawing elements or PNG)",
      );
    const allowed = new Set(
      "svg g path rect circle ellipse polygon polyline line defs pattern linearGradient radialGradient stop clipPath mask filter feTurbulence title desc text tspan"
        .toLowerCase()
        .split(" "),
    );
    for (const tag of text.matchAll(/<\s*([\w:-]+)/g))
      if (!allowed.has(tag[1].toLowerCase()))
        throw Error(file + ": unsupported SVG element " + tag[1]);
    return "image/svg+xml";
  }
  if (ext === ".png") {
    if (
      !bytes
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    )
      throw Error(file + ": invalid PNG header");
    if (bytes.readUInt32BE(16) > 8192 || bytes.readUInt32BE(20) > 8192)
      throw Error(file + ": image dimensions exceed 8192");
    return "image/png";
  }
  if (ext === ".webp") {
    if (
      bytes.length < 25 ||
      bytes.toString("ascii", 0, 4) !== "RIFF" ||
      bytes.toString("ascii", 8, 12) !== "WEBP"
    )
      throw Error(file + ": invalid WebP header");
    return "image/webp";
  }
  if (ext === ".jpg" || ext === ".jpeg") {
    if (bytes[0] !== 255 || bytes[1] !== 216)
      throw Error(file + ": invalid JPEG");
    return "image/jpeg";
  }
  if (ext === ".wav") {
    if (
      bytes.toString("ascii", 0, 4) !== "RIFF" ||
      bytes.toString("ascii", 8, 12) !== "WAVE"
    )
      throw Error(file + ": invalid WAVE header");
    return "audio/wav";
  }
  if (ext === ".ogg") {
    if (bytes.toString("ascii", 0, 4) !== "OggS")
      throw Error(file + ": invalid Ogg");
    return "audio/ogg";
  }
  if (ext === ".mp3") return "audio/mpeg";
  if (ext === ".ttf") {
    if (bytes.readUInt32BE(0) !== 0x00010000)
      throw Error(file + ": invalid TTF");
    return "font/ttf";
  }
  if (ext === ".woff2") {
    if (bytes.toString("ascii", 0, 4) !== "wOF2")
      throw Error(file + ": invalid WOFF2");
    return "font/woff2";
  }
  throw Error(file + ": unsupported asset extension");
}
function validate(
  manifest = readJSON("data/assets.json"),
  { checkHashes = true } = {},
) {
  const errors = [],
    ids = new Set(),
    referenced = new Set(),
    embedded = {},
    fileCache = new Map();
  for (const a of manifest.assets) {
    try {
      if (!/^[A-Za-z0-9_.-]+$/.test(a.id) || ids.has(a.id))
        throw Error("Invalid or duplicate asset ID " + a.id);
      ids.add(a.id);
      if (!["image", "sprite", "font", "sound", "music"].includes(a.type))
        throw Error(a.id + ": unknown asset type");
      if (!a.usage?.length || !a.licence || !a.replacementStatus)
        throw Error(a.id + ": usage, licence and replacement status required");
      for (const ref of [
        a.path,
        a.originalPath,
        ...(a.previousPaths || []),
        ...(a.licenceFile ? [a.licenceFile] : []),
        ...(a.originalLicenceFile ? [a.originalLicenceFile] : []),
      ]) {
        const local = safePath(ref);
        if (!fs.existsSync(local)) throw Error(a.id + ": missing " + ref);
        if (
          !fs
            .realpathSync(local)
            .startsWith(fs.realpathSync(path.join(ROOT, "assets")) + path.sep)
        )
          throw Error(a.id + ": symlink escapes assets");
        referenced.add(ref);
      }
      let file = fileCache.get(a.path);
      if (!file) {
        const bytes = fs.readFileSync(safePath(a.path)),
          mime = inspect(a.path, bytes);
        file = {
          mime,
          sha256: hash(bytes),
          url: "data:" + mime + ";base64," + bytes.toString("base64"),
          text: mime === "image/svg+xml" ? bytes.toString("utf8") : undefined,
        };
        fileCache.set(a.path, file);
      }
      const { mime } = file;
      if (
        (a.type === "font" && !mime.startsWith("font/")) ||
        (["image", "sprite"].includes(a.type) && !mime.startsWith("image/")) ||
        (["sound", "music"].includes(a.type) && !mime.startsWith("audio/"))
      )
        throw Error(a.id + ": file content does not match manifest type");
      if (
        a.volume !== undefined &&
        (!Number.isFinite(a.volume) || a.volume < 0 || a.volume > 1)
      )
        throw Error(a.id + ": volume must be in [0,1]");
      if (
        a.loopStart !== undefined &&
        (!Number.isFinite(a.loopStart) ||
          a.loopStart < 0 ||
          a.loopEnd <= a.loopStart)
      )
        throw Error(a.id + ": invalid music loop points");
      if (checkHashes && a.sha256 !== file.sha256)
        throw Error(
          a.id + ": checksum mismatch; run assets:sync after intentional edits",
        );
      embedded[a.id] = {
        ...a,
        mime,
        url: file.url,
        text: file.text,
      };
    } catch (e) {
      errors.push(e.message);
    }
  }
  for (const a of manifest.assets) {
    if (a.renderMode !== "atlas") continue;
    for (const frame of [a.atlas, ...Object.values(a.states || {})]) {
      const sheet = manifest.assets.find((e) => e.id === frame?.asset),
        size = sheet?.dimensions;
      if (!sheet || !size || size.length !== 2) {
        errors.push(a.id + ": missing atlas sheet or dimensions");
        continue;
      }
      if (
        ![frame.x, frame.y, frame.width, frame.height, ...size].every(
          Number.isFinite,
        ) ||
        frame.x < 0 ||
        frame.y < 0 ||
        frame.width <= 0 ||
        frame.height <= 0 ||
        frame.x + frame.width > size[0] ||
        frame.y + frame.height > size[1]
      )
        errors.push(a.id + ": atlas frame is outside its sheet");
    }
  }
  const files = [];
  function visit(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) visit(p);
      else if (!/\.(?:md|txt)$/i.test(e.name))
        files.push(path.relative(ROOT, p));
    }
  }
  visit(path.join(ROOT, "assets"));
  const unused = files.filter((p) => !referenced.has(p));
  return {
    errors,
    unused,
    embedded,
    retained: manifest.assets
      .filter((a) => a.originalPath !== a.path)
      .map((a) => a.originalPath),
  };
}
// Conservative static audit: dynamic rendering families are resolved from balance IDs.
// Candidates are reported for review, never automatically deleted.
function unusedEntries(manifest = readJSON("data/assets.json")) {
  const balance = readJSON("data/balance.json"),
    source =
      fs.readFileSync(path.join(ROOT, "src/game.js"), "utf8") +
      fs.readFileSync(path.join(ROOT, "src/game.css"), "utf8") +
      JSON.stringify(balance) +
      ["core", "audio", "input", "ui"]
        .map((name) =>
          fs.readFileSync(
            path.join(ROOT, "src/production/" + name + ".js"),
            "utf8",
          ),
        )
        .join("\n");
  const art = new Set([
    ...Object.keys(balance.classes),
    ...Object.values(balance.enemies).map((e) => e.art),
  ]);
  const atlasReferences = new Set(
    manifest.assets
      .flatMap((a) => [a.atlas, ...Object.values(a.states || {})])
      .filter(Boolean)
      .map((f) => f.asset),
  );
  const referenced = (asset) => {
    if (atlasReferences.has(asset.id)) return true;
    if (source.includes(asset.id)) return true;
    if (asset.id.startsWith("icon.")) {
      const name = asset.alias;
      return (
        source.includes('"' + name + '"') ||
        source.includes("'" + name + "'") ||
        source.includes("paths." + name)
      );
    }
    if (/^(portrait|corpse)\./.test(asset.id)) {
      const name = asset.id.split(".")[1];
      return art.has(name) || source.includes('"' + name + '"');
    }
    if (/^floor\.[0-4]$/.test(asset.id)) return true;
    if (/^trap\.(spikes|arrow|boulder)$/.test(asset.id)) return true;
    return /^music\.(field|battle)$/.test(asset.id);
  };
  return manifest.assets
    .filter((a) => !referenced(a))
    .map((a) => ({
      id: a.id,
      path: a.path,
      reason:
        "No static reference or supported dynamic family; review before removing.",
    }));
}
function main() {
  const [cmd = "validate", ...args] = process.argv.slice(2);
  let m = readJSON("data/assets.json");
  if (cmd === "replace") {
    const opt = Object.fromEntries(
      args.reduce((a, x, i) => {
        if (x.startsWith("--")) a.push([x.slice(2), args[i + 1]]);
        return a;
      }, []),
    );
    const a = m.assets.find((a) => a.id === opt.id);
    if (!a || !opt.file || !opt.licence)
      throw Error(
        'Usage: assets.cjs replace --id ID --file replacement.png --licence "licence / source"',
      );
    const bytes = fs.readFileSync(path.resolve(opt.file)),
      mime = inspect(opt.file, bytes);
    if (
      (a.type === "font") !== mime.startsWith("font/") ||
      ["sound", "music"].includes(a.type) !== mime.startsWith("audio/")
    )
      throw Error("Replacement type does not match " + a.type);
    const target =
      "assets/replacements/" +
      a.id +
      "-" +
      hash(bytes).slice(0, 12) +
      path.extname(opt.file).toLowerCase();
    a.originalLicence ??= a.licence;
    a.originalLicenceFile ??= a.licenceFile;
    if (a.path !== a.originalPath && a.path !== target)
      a.previousPaths = [...new Set([...(a.previousPaths || []), a.path])];
    fs.mkdirSync(path.dirname(safePath(target)), { recursive: true });
    fs.writeFileSync(safePath(target), bytes);
    Object.assign(a, {
      path: target,
      renderMode: "file",
      replacementStatus: "replacement",
      licence: opt.licence,
      licenceFile: opt["licence-file"] || "assets/LICENCES.md",
      sha256: hash(bytes),
    });
    fs.writeFileSync(
      path.join(ROOT, "data/assets.json"),
      JSON.stringify(m, null, 2) + "\n",
    );
    console.log(
      "Replaced " +
        a.id +
        "; original retained at " +
        a.originalPath +
        ". Run npm run build.",
    );
    return;
  }
  if (cmd === "sync") {
    const r = validate(m, { checkHashes: false });
    if (r.errors.length) throw Error(r.errors.join("\n"));
    m.assets.forEach(
      (a) => (a.sha256 = hash(fs.readFileSync(safePath(a.path)))),
    );
    fs.writeFileSync(
      path.join(ROOT, "data/assets.json"),
      JSON.stringify(m, null, 2) + "\n",
    );
    console.log("Manifest checksums refreshed.");
    return;
  }
  if (!["validate", "audit"].includes(cmd))
    throw Error("Unknown asset command " + cmd);
  const r = validate(m);
  console.log(
    JSON.stringify(
      {
        assets: m.assets.length,
        missingOrInvalid: r.errors,
        unusedFiles: r.unused,
        unusedManifestCandidates: unusedEntries(m),
        retainedOriginals: r.retained,
      },
      null,
      2,
    ),
  );
  if (r.errors.length || r.unused.length) process.exitCode = 1;
}
if (require.main === module)
  try {
    main();
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
module.exports = { validate, inspect, safePath, unusedEntries };
