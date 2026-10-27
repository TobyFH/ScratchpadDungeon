// One validated audio catalogue feeds the offline builder, audit and auditions.
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
const root = path.resolve(__dirname, "..");
const digest = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
function recipeHash(bank, recipe) {
  const payload = Object.fromEntries(["seconds", "targetRmsDb", "peakLimit", "layers", "tone"].map((key) => [key, recipe[key] ?? null]));
  payload.sources = Object.fromEntries(recipe.layers.map((layer) => [layer.source, bank.sources[layer.source]?.sha256 ?? null]));
  const canonical = (value) => typeof value === "number" ? value.toFixed(9)
    : Array.isArray(value) ? value.map(canonical)
    : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]))
    : value;
  return digest(JSON.stringify(canonical(payload)));
}
function file(name) {
  if (typeof name !== "string" || !/^[\w./-]+$/.test(name) || name.split("/").includes(".."))
    throw Error(`Audio catalogue: invalid local path ${name}`);
  const resolved = path.join(root, name);
  if (!fs.existsSync(resolved)) throw Error(`Audio catalogue: missing ${name}`);
  return fs.readFileSync(resolved);
}
function wavInfo(bytes) {
  if (bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WAVE")
    throw Error("Audio catalogue: expected a PCM WAV");
  let format, data;
  for (let p = 12; p + 8 <= bytes.length;) {
    const id = bytes.toString("ascii", p, p + 4), length = bytes.readUInt32LE(p + 4);
    if (p + 8 + length > bytes.length) throw Error("Audio catalogue: truncated WAV chunk");
    if (id === "fmt ") {
      if (length < 16) throw Error("Audio catalogue: invalid WAV format");
      format = { encoding: bytes.readUInt16LE(p + 8), channels: bytes.readUInt16LE(p + 10),
        rate: bytes.readUInt32LE(p + 12), bits: bytes.readUInt16LE(p + 22) };
    }
    if (id === "data") data = bytes.subarray(p + 8, p + 8 + length);
    p += 8 + length + (length % 2);
  }
  if (!format || !data || format.encoding !== 1 || format.channels !== 1 || format.bits !== 16 || data.length % 2)
    throw Error("Audio catalogue: mixes must be mono signed 16-bit PCM");
  let peak = 0, power = 0;
  for (let i = 0; i < data.length; i += 2) {
    const n = data.readInt16LE(i) / 32768;
    peak = Math.max(peak, Math.abs(n)); power += n * n;
  }
  return { ...format, frames: data.length / 2, seconds: data.length / 2 / format.rate,
    peak, rms: Math.sqrt(power / (data.length / 2)) };
}
function loadAudioBank(override = null) {
  const bank = override || JSON.parse(file("audio/manifest.json"));
  if (bank.schemaVersion !== 1 || bank.sampleRate !== 24000) throw Error("Audio catalogue: unsupported schema/sample rate");
  const validId = (id) => /^[a-z][a-zA-Z0-9._-]*$/.test(id);
  for (const [id, collection] of Object.entries(bank.collections)) {
    if (!validId(id) || !["CC0-1.0", "user-authorized"].includes(collection.license))
      throw Error(`Audio catalogue: unreviewed licence for ${id}`);
    const license = file(collection.licensePath);
    if (digest(license) !== collection.licenseSha256)
      throw Error(`Audio catalogue: licence evidence changed for ${id}`);
    if (collection.license === "CC0-1.0" && (!/^[0-9a-f]{40}$/.test(collection.revision) || !collection.licenseEvidence))
      throw Error(`Audio catalogue: missing pinned licence evidence for ${id}`);
  }
  for (const [id, source] of Object.entries(bank.sources)) {
    if (!validId(id) || !bank.collections[source.collection] || !["source", "archive"].includes(source.role))
      throw Error(`Audio catalogue: invalid source ${id}`);
    if (!source.path.startsWith("ui/assets/audio/")) throw Error(`Audio catalogue: source outside audio directory ${id}`);
    const collection = bank.collections[source.collection];
    if (collection.repository && !source.url?.startsWith(collection.repository + "/blob/" + collection.revision + "/"))
      throw Error(`Audio catalogue: source has no pinned provenance ${id}`);
    if (digest(file(source.path)) !== source.sha256) throw Error(`Audio catalogue: source hash changed for ${id}`);
  }
  const usedSources = new Set(), usedAssets = new Set(), metrics = {};
  for (const [id, asset] of Object.entries(bank.assets)) {
    if (!validId(id) || !asset.path.startsWith("ui/assets/audio/living-sketchbook/") || !asset.layers?.length)
      throw Error(`Audio catalogue: invalid mix ${id}`);
    if (!Number.isFinite(asset.seconds) || asset.seconds < .02 || asset.seconds > 2 ||
        !Number.isFinite(asset.targetRmsDb) || asset.targetRmsDb < -45 || asset.targetRmsDb > -10 ||
        !(asset.peakLimit > 0 && asset.peakLimit <= .83))
      throw Error(`Audio catalogue: invalid mix target for ${id}`);
    if (asset.tone && (!(asset.tone.hz >= 30 && asset.tone.hz <= 500) ||
        !(asset.tone.gain > 0 && asset.tone.gain <= .25) ||
        !(asset.tone.seconds > 0 && asset.tone.seconds <= asset.seconds)))
      throw Error(`Audio catalogue: invalid original thump in ${id}`);
    const bytes = file(asset.path), info = wavInfo(bytes);
    if (digest(bytes) !== asset.sha256) throw Error(`Audio catalogue: stale mix ${id}; run npm run build:sfx`);
    if (recipeHash(bank, asset) !== asset.recipeHash) throw Error(`Audio catalogue: mix recipe changed for ${id}; run npm run build:sfx`);
    if (info.rate !== bank.sampleRate || info.frames !== asset.frames || info.seconds < .02 || info.seconds > 2 || info.rms < .0001 || info.peak > .83)
      throw Error(`Audio catalogue: invalid duration, level or format for ${id}`);
    if (Math.abs(info.seconds - asset.seconds) > 1 / bank.sampleRate)
      throw Error(`Audio catalogue: recipe length mismatch for ${id}`);
    for (const layer of asset.layers) {
      if (!bank.sources[layer.source] || !(layer.gain > 0 && layer.gain <= 2) || !(layer.rate >= .5 && layer.rate <= 2))
        throw Error(`Audio catalogue: invalid source/rate/gain in ${id}`);
      if ((layer.delay || 0) < 0 || (layer.delay || 0) >= asset.seconds || (layer.start || 0) < 0 || (layer.length !== undefined && layer.length <= 0))
        throw Error(`Audio catalogue: invalid timing in ${id}`);
      usedSources.add(layer.source);
    }
    metrics[id] = info;
  }
  for (const [id, cue] of Object.entries(bank.cues)) {
    if (!validId(id) || !Array.isArray(cue.samples) || !cue.samples.length || !(cue.gain > 0 && cue.gain <= 1) || !(cue.rate >= .5 && cue.rate <= 2) || !(cue.cooldown >= 0 && cue.cooldown <= 5000))
      throw Error(`Audio catalogue: invalid cue ${id}`);
    for (const asset of cue.samples) {
      if (!bank.assets[asset]) throw Error(`Audio catalogue: cue ${id} refers to missing ${asset}`);
      usedAssets.add(asset);
    }
  }
  for (const id of Object.keys(bank.assets))
    if (!usedAssets.has(id)) throw Error(`Audio catalogue: unused rendered asset ${id}`);
  for (const [id, source] of Object.entries(bank.sources))
    if (source.role !== "archive" && !usedSources.has(id)) throw Error(`Audio catalogue: unused source ${id}`);
  const known = new Set([...Object.values(bank.sources), ...Object.values(bank.assets)].map((v) => v.path));
  function inspect(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) inspect(absolute);
      else if (/\.(wav|ogg|mp3)$/i.test(entry.name) && !known.has(path.relative(root, absolute).split(path.sep).join("/")))
        throw Error(`Audio catalogue: unlisted audio file ${absolute}`);
    }
  }
  inspect(path.join(root, "ui/assets/audio"));
  return { bank, metrics };
}
function credits(bank) {
  return Object.fromEntries(Object.entries(bank.collections).map(([id, c]) => [id, {
    creator: c.creator, title: c.title, license: c.license,
    homepage: c.homepage || "", licenseUrl: c.licenseUrl || "", evidence: c.licenseEvidence || "",
  }]));
}
module.exports = { loadAudioBank, wavInfo, credits };
if (require.main === module) {
  try {
    const { bank, metrics } = loadAudioBank();
    console.log(`Validated ${Object.keys(bank.assets).length} mixes, ${Object.keys(bank.cues).length} cue mappings and ${Object.keys(bank.sources).length} licensed/archived sources.`);
    if (process.argv.includes("--json")) console.log(JSON.stringify(metrics, null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
