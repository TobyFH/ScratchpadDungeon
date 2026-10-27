const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), http = require("node:http");
const { chromium } = require("playwright");
const { loadAudioBank } = require("../tools/audio-bank.cjs");
const { renderSfxReview } = require("../tools/review-sfx.cjs");
const root = path.resolve(__dirname, "..");
let browser, server, url;
before(async () => {
  const html = fs.readFileSync(path.join(root, "index.html")), review = renderSfxReview();
  server = http.createServer((req, res) => {
    res.setHeader("Content-Type", "text/html");
    res.end(req.url === "/preview" ? review.html : html);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  url = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium", args: ["--no-sandbox"],
  });
});
after(async () => { await browser?.close(); if (server) await new Promise((r) => server.close(r)); });
async function game(t, preview = false, tapAudio = false) {
  const p = await browser.newPage({ viewport: { width: 1280, height: 800 } }), errors = [], external = [];
  p.on("pageerror", (e) => errors.push(e.message));
  if (tapAudio) await p.addInitScript(() => {
    const create = AudioContext.prototype.createDynamicsCompressor;
    AudioContext.prototype.createDynamicsCompressor = function () {
      const limiter = create.call(this);
      window.sfxSignal = this.createAnalyser();
      sfxSignal.fftSize = 2048;
      limiter.connect(sfxSignal);
      return limiter;
    };
  });
  await p.route("**/*", (route) => {
    if (!route.request().url().startsWith(url) && !route.request().url().startsWith("data:")) {
      external.push(route.request().url()); return route.abort();
    }
    return route.continue();
  });
  await p.goto(url + (preview ? "/preview" : ""));
  if (!preview) {
    await p.evaluate(() => {
      newRun("fighter"); setPace("skip");
      setPreference("musicVolume", 0); setPreference("ambienceVolume", 0);
      characterLuck = () => .999999;
    });
    await p.locator("#options-tab").click();
    await p.evaluate(() => GameSound.unlock());
  }
  t.after(async () => { await p.close(); assert.deepEqual(errors, []); assert.deepEqual(external, []); });
  return p;
}

test("every rendered sound has pinned provenance, reviewed licence evidence, headroom and a real use; steps stay quiet", () => {
  const { bank, metrics } = loadAudioBank();
  assert.equal(Object.keys(bank.assets).length, 32);
  assert.equal(Object.keys(bank.cues).length, 45);
  for (const source of Object.values(bank.sources)) {
    const collection = bank.collections[source.collection];
    assert.ok(fs.existsSync(path.join(root, collection.licensePath)));
    if (source.collection !== "user") {
      assert.equal(collection.license, "CC0-1.0");
      assert.ok(source.url.includes(collection.revision));
    }
  }
  const energy = (cueId) => {
    const c = bank.cues[cueId];
    return metrics[c.samples[0]].rms * c.gain;
  };
  assert.ok(energy("step") < energy("hit") * .15, "quiet movement does not compete with an attack");
  assert.ok(energy("critical") > energy("step") * 8, "criticals have a meaningful dynamic contrast");
  for (const info of Object.values(metrics)) {
    assert.equal(info.rate, 24000); assert.equal(info.channels, 1);
    assert.ok(info.peak <= .83 && info.rms > .0001);
  }
});

test("the catalogue rejects missing files, stale audio, unreviewed licences, unsafe paths and unused mixes before shipping", () => {
  const { bank } = loadAudioBank();
  const changed = (edit) => { const copy = structuredClone(bank); edit(copy); return copy; };
  assert.throws(() => loadAudioBank(changed((b) => b.cues.hit.samples = ["missing"])), /refers to missing/);
  assert.throws(() => loadAudioBank(changed((b) => b.assets["paper-heal"].sha256 = "0".repeat(64))), /stale mix/);
  assert.throws(() => loadAudioBank(changed((b) => b.assets["paper-heal"].layers[0].gain = .8)), /mix recipe changed/);
  assert.throws(() => loadAudioBank(changed((b) => b.assets["paper-heal"].path = "ui/assets/audio/living-sketchbook/missing.wav")), /missing/);
  assert.throws(() => loadAudioBank(changed((b) => b.collections.rpg.license = "unknown")), /unreviewed licence/);
  assert.throws(() => loadAudioBank(changed((b) => b.collections.rpg.licenseSha256 = "0".repeat(64))), /licence evidence changed/);
  assert.throws(() => loadAudioBank(changed((b) => b.sources["user.SFX_Erase"].path = "ui/assets/audio/../../index.html")), /invalid local path/);
  assert.throws(() => loadAudioBank(changed((b) => b.assets.orphan = structuredClone(b.assets["paper-heal"]))), /unused rendered asset/);
});

test("every game cue and every variation really plays recorded audio offline without gameplay RNG", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(async () => {
    const random = Math.random, before = { ...GameSound.stats.samplePlays }, calls = [], failed = [];
    let randomCalls = 0;
    Math.random = () => { randomCalls++; return .5; };
    try {
      for (const [id, cue] of Object.entries(SOUND_SAMPLES))
        for (let n = 0; n < cue.samples.length; n++) {
          if (!GameSound.play(id)) failed.push(id);
          calls.push({ id, ...GameSound.stats.lastSample });
          await new Promise((r) => setTimeout(r, Math.max(55, cue.cooldown + 5)));
        }
      const missing = Object.keys(SOUND_CUES).filter((id) => !SOUND_SAMPLES[id]);
      await new Promise((r) => setTimeout(r, 1300));
      return { failed, calls, missing, randomCalls, decoded: GameSound.samplesReady,
        expected: Object.keys(SFX_ASSETS).length, played: GameSound.stats.samplePlays,
        before, assets: Object.keys(GameSound.stats.sampleAssets), errors: GameSound.stats.sampleErrors,
        active: GameSound.activeVoices, peak: GameSound.stats.peakVoices };
    } finally { Math.random = random; }
  });
  assert.deepEqual(r.failed, []); assert.deepEqual(r.missing, []); assert.deepEqual(r.errors, []);
  assert.equal(r.decoded, r.expected); assert.equal(r.assets.length, r.expected);
  assert.equal(r.randomCalls, 0); assert.equal(r.active, 0); assert.ok(r.peak <= 20);
  for (const [id, plays] of Object.entries(r.played)) assert.ok(plays > (r.before[id] || 0), id);
  assert.ok(r.calls.every((c) => c.id === c.cue));
});

test("sample priority and creature cries share one bounded pool; deterministic variants and mute retain their rules", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(async () => {
    const variants = [];
    for (let n = 0; n < 3; n++) {
      GameSound.play("hit"); variants.push(GameSound.stats.lastSample.asset);
      await new Promise((r) => setTimeout(r, 45));
    }
    await new Promise((r) => setTimeout(r, 1100));
    const random = Math.random; let calls = 0;
    Math.random = () => { calls++; return .5; };
    try {
      const ids = Object.entries(SOUND_SAMPLES).filter(([, cue]) => !cue.priority).map(([id]) => id).slice(0, 20);
      ids.forEach((id) => GameSound.play(id));
      const full = GameSound.activeVoices;
      const critical = GameSound.play("critical"), cry = GameSound.cry("rat", "appear");
      const peak = GameSound.stats.peakVoices;
      setPreference("muted", true);
      const muted = GameSound.play("lockBig");
      setPreference("muted", false); setPreference("sfxVolume", 0);
      const disabled = GameSound.cry("ghost");
      return { variants, full, critical, cry, peak, muted, disabled, calls };
    } finally { Math.random = random; }
  });
  assert.deepEqual(r.variants, ["paper-hit-a", "paper-hit-b", "paper-hit-a"]);
  assert.equal(r.full, 20); assert.equal(r.critical, true); assert.equal(r.cry, true);
  assert.ok(r.peak <= 20); assert.equal(r.muted, false); assert.equal(r.disabled, false); assert.equal(r.calls, 0);
});

test("a failed sample uses its decoded sibling once, and decoding is never retried on every click", async (t) => {
  const p = await browser.newPage(); t.after(() => p.close());
  await p.goto(url);
  const r = await p.evaluate(async () => {
    newRun("fighter"); setPreference("musicVolume", 0); setPreference("ambienceVolume", 0);
    const proto = AudioContext.prototype, decode = proto.decodeAudioData,
      binary = atob(SFX_ASSETS["reel-tick-a"].src.split(",")[1]),
      wanted = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    let attempts = 0;
    proto.decodeAudioData = function (bytes) {
      attempts++;
      const actual = new Uint8Array(bytes);
      if (actual.length === wanted.length && actual.every((n, i) => n === wanted[i]))
        return Promise.reject(new Error("Fixture: first tick unsupported"));
      return decode.call(this, bytes);
    };
    try {
      await GameSound.unlock();
      const played = GameSound.play("tick"), asset = GameSound.stats.lastSample?.asset;
      await GameSound.unlock();
      return { played, asset, attempts, errors: GameSound.stats.sampleErrors,
        decoded: GameSound.samplesReady, expected: Object.keys(SFX_ASSETS).length };
    } finally { proto.decodeAudioData = decode; }
  });
  assert.equal(r.played, true); assert.equal(r.asset, "reel-tick-b");
  assert.equal(r.attempts, r.expected); assert.equal(r.decoded, r.expected - 1);
  assert.deepEqual(r.errors, ["reel-tick-a"]);
});

test("recorded impacts reach the real output, remain unclipped and become silent through both effects volume and master mute", async (t) => {
  const p = await game(t, false, true);
  const r = await p.evaluate(async () => {
    setPreference("sfxVolume", 1); setPreference("masterVolume", 1);
    const signal = () => {
      const samples = new Float32Array(sfxSignal.fftSize);
      sfxSignal.getFloatTimeDomainData(samples);
      return { rms: Math.sqrt(samples.reduce((sum, n) => sum + n * n, 0) / samples.length),
        peak: Math.max(...samples.map(Math.abs)) };
    };
    GameSound.play("explosion");
    let loud = 0, peak = 0;
    for (let i = 0; i < 6; i++) {
      await new Promise((r) => setTimeout(r, 45));
      const reading = signal(); loud = Math.max(loud, reading.rms); peak = Math.max(peak, reading.peak);
    }
    setPreference("sfxVolume", 0);
    await new Promise((r) => setTimeout(r, 400));
    const effectsOff = signal().rms, sourcesStillActive = GameSound.activeVoices;
    setPreference("sfxVolume", 1);
    GameSound.play("critical");
    await new Promise((r) => setTimeout(r, 220));
    const restored = signal().rms;
    setPreference("muted", true);
    await new Promise((r) => setTimeout(r, 400));
    return { loud, peak, effectsOff, sourcesStillActive, restored, muted: signal().rms };
  });
  assert.ok(r.loud > .001, "sample reaches the post-limiter output");
  assert.ok(r.peak < .98, "impact has output headroom");
  assert.ok(r.sourcesStillActive > 0, "silence is measured while a recording is still playing");
  assert.ok(r.effectsOff < .00001, "effects slider fades actual sample output");
  assert.ok(r.restored > .001, "restoring effects volume restores real output");
  assert.ok(r.muted < .00001, "master mute silences real sample output");
  fs.writeFileSync(path.join(root, "test-results/living-sketchbook/output-signal.json"), JSON.stringify(r, null, 2));
});

test("the offline audition sheet plays individual cues and the montage, and its volume and Stop controls work", async (t) => {
  const p = await game(t, true);
  assert.equal(await p.locator("[data-cue]").count(), 45);
  await p.locator('[data-cue="erase"]').click();
  await p.waitForFunction(() => playing.size > 0);
  assert.equal(await p.evaluate(() => buffers.size), 32);
  await p.locator("#volume").fill("25"); await p.locator("#volume").dispatchEvent("input");
  assert.equal(await p.locator("audio").evaluate((a) => a.volume), .25);
  await p.locator("audio").evaluate((a) => a.play());
  await p.waitForFunction(() => !document.querySelector("audio").paused);
  await p.locator("#stop").click();
  await p.waitForFunction(() => playing.size === 0 && document.querySelector("audio").paused);
  for (const width of [1280, 390]) {
    await p.setViewportSize({ width, height: 800 });
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await p.screenshot({ path: path.join(root, `test-results/living-sketchbook/audition-${width}.png`) });
  }
});
