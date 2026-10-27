#!/usr/bin/env node
// The checked-in HTML is the distributable. UI sources are embedded, never fetched.
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const { loadAudioBank, credits } = require("./audio-bank.cjs");
const { bank: audioBank } = loadAudioBank();
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const assets = (name) => {
  if (!/^[\w./-]+$/.test(name) || name.includes(".."))
    throw Error(`Invalid UI asset: ${name}`);
  const file = path.join(root, "ui/assets", name);
  if (!fs.existsSync(file)) throw Error(`Missing UI asset: ${name}`);
  const mime = name.endsWith(".svg")
    ? "image/svg+xml"
    : name.endsWith(".ttf")
      ? "font/ttf"
      : name.endsWith(".png")
        ? "image/png"
        : name.endsWith(".wav")
          ? "audio/wav"
          : null;
  if (!mime) throw Error(`Unsupported UI asset: ${name}`);
  return `data:${mime};base64,${fs.readFileSync(file).toString("base64")}`;
};
const css = ["layout.css", "notebook.css", "combat-life.css", "terrain-motion.css"]
  .map((name) => {
    const content = read("ui/" + name).replace(
      /@asset\(([^)]+)\)/g,
      (_, asset) => assets(asset),
    );
    // Presentation wins without a growing specificity contest against legacy skins.
    return name === "layout.css" ? `@layer legacy {\n${content}\n}` : content;
  })
  .join("\n");
const license = ["OFL-Caveat.txt", "OFL-CabinSketch.txt"]
  .map((name) => read("ui/assets/fonts/" + name))
  .join("\n\n");
let html = read("index.html");
function embed(start, end, content) {
  const a = html.indexOf(start),
    b = html.indexOf(end, a);
  if (a < 0 || b < 0 || html.indexOf(start, a + 1) >= 0)
    throw Error(`Missing or duplicate marker: ${start}`);
  html =
    html.slice(0, a + start.length) +
    "\n" +
    content.trimEnd() +
    "\n" +
    html.slice(b);
}
embed(
  "/* BEGIN GENERATED NOTEBOOK CSS */",
  "/* END GENERATED NOTEBOOK CSS */",
  `/* Caveat and Cabin Sketch. Font credits and SIL Open Font License 1.1.\n${license}\n*/\n${css}`,
);
embed(
  "// BEGIN GENERATED NOTEBOOK ART",
  "// END GENERATED NOTEBOOK ART",
  read("ui/drawings.js").replace(/@asset\(([^)]+)\)/g, (_, asset) =>
    assets(asset),
  ),
);
embed(
  "// BEGIN GENERATED CAMP PROGRESSION",
  "// END GENERATED CAMP PROGRESSION",
  read("game/progression.js"),
);
let audioTemplate = read("ui/audio-samples.js");
for (const [token, data] of [
  ["/* @audioAssets */ {}", Object.fromEntries(Object.entries(audioBank.assets).map(([id, asset]) => [id, {
    src: assets(asset.path.replace(/^ui\/assets\//, "")), description: asset.description,
  }]))],
  ["/* @audioCues */ {}", audioBank.cues],
  ["/* @audioCredits */ {}", credits(audioBank)],
]) {
  if (audioTemplate.split(token).length !== 2) throw Error(`Missing or duplicate audio template marker: ${token}`);
  audioTemplate = audioTemplate.replace(token, JSON.stringify(data));
}
embed(
  "// BEGIN GENERATED AUDIO SAMPLES",
  "// END GENERATED AUDIO SAMPLES",
  audioTemplate,
);
for (const [label, file] of [
  ["BALANCE", "game/balance.js"],
  ["BIOME ENEMIES", "game/biome-enemies.js"],
  ["ENCOUNTER JOURNAL", "game/encounter-journal.js"],
  ["ECONOMY", "game/economy.js"],
  ["HERO BUILDS", "game/hero-builds.js"],
  ["BATTLE TACTICS", "game/battle-tactics.js"],
  ["WORLD EVENTS", "game/world-events.js"],
  ["BIOMES", "game/biomes.js"],
  ["LIVING DUNGEON", "game/living-dungeon.js"],
  ["REEL UPGRADES", "game/reel-upgrades.js"],
  ["ENCOUNTER PRESENTATION", "game/encounter-presentation.js"],
  ["COMBAT FEEDBACK", "ui/combat-feedback.js"],
  ["AUTOMATION PACING", "game/automation-pacing.js"],
  ["CHARACTER EVENTS", "game/character-events.js"],
  ["AUTO BUILDS", "game/auto-builds.js"],
  ["JESTER", "game/jester.js"],
  ["COMBAT CLARITY", "game/combat-clarity.js"],
  ["EXPLORATION RULES", "game/exploration-rules.js"],
  ["REWARD AUDIO", "ui/reward-audio.js"],
  ["MUSIC", "ui/music.js"],
  ["AUDIO ENGINE", "ui/audio-engine.js"],
  ["NOTEBOOK PAGES", "ui/notebook-pages.js"],
  ["COMBAT LIFE", "ui/combat-life.js"],
  ["FIELD GUIDE", "ui/field-guide.js"],
]) {
  embed(`// BEGIN GENERATED ${label}`, `// END GENERATED ${label}`, read(file));
}
if (process.argv.includes("--check")) {
  if (html !== read("index.html")) {
    console.error(
      "Notebook sources differ from index.html. Run npm run build:ui.",
    );
    process.exitCode = 1;
  } else
    console.log(
      "Notebook styles, illustrations and embedded assets are up to date.",
    );
} else {
  fs.writeFileSync(path.join(root, "index.html"), html);
  console.log("Embedded notebook UI into the standalone index.html.");
}
