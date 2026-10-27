const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { readFileSync, existsSync } = require("node:fs");
const http = require("node:http");
const path = require("node:path");
let browser, server, url;
before(async () => {
  const html = readFileSync(path.resolve(__dirname, "../index.html"));
  server = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(html);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  url = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({
    executablePath:
      process.env.CHROMIUM_PATH ||
      (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
    args: ["--no-sandbox"],
  });
});
after(async () => {
  await browser?.close();
  if (server) await new Promise((resolve) => server.close(resolve));
});
async function notebook(t) {
  const page = await browser.newPage(),
    errors = [],
    external = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/*", (route) => {
    if (
      !route.request().url().startsWith(url) &&
      !route.request().url().startsWith("data:")
    ) {
      external.push(route.request().url());
      return route.abort();
    }
    return route.continue();
  });
  await page.addInitScript(() => {
    window.addEventListener("DOMContentLoaded", () => {
      characterLuck = () => 0.999999;
    });
  });
  await page.goto(url);
  await page.evaluate(() => {
    newRun("fighter");
    setPreference("musicVolume", 0);
    setPreference("ambienceVolume", 0);
  });
  t.after(async () => {
    await page.close();
    assert.deepEqual(errors, []);
    assert.deepEqual(external, [], "recordings need no external requests");
  });
  return page;
}

test("the complete recorded bank decodes offline; reveal/reel cues produce non-silent sources and share mute, gains and the voice limit", async (t) => {
  const page = await notebook(t);
  await page.locator("#options-tab").click();
  const result = await page.evaluate(async () => {
    await GameSound.unlock();
    await new Promise((r) => setTimeout(r, 300));
    const sources = [],
      create = GameSound.context.createBufferSource.bind(GameSound.context);
    GameSound.context.createBufferSource = () => {
      const source = create(),
        start = source.start.bind(source);
      source.start = (...args) => {
        sources.push({
          duration: source.buffer?.duration,
          nonSilent:
            source.buffer &&
            Array.from(source.buffer.getChannelData(0)).some(
              (n) => Math.abs(n) > 0.001,
            ),
        });
        return start(...args);
      };
      return source;
    };
    const random = Math.random;
    let randomCalls = 0;
    Math.random = () => {
      randomCalls++;
      return 0.5;
    };
    try {
      for (const id of ["erase", "poof", "tick", "lock", "lockBig"]) GameSound.play(id);
      for (let n = 0; n < 50; n++) GameSound.play("erase");
      const played = { ...GameSound.stats.samplePlays };
      // Test volume gates after every recording cooldown has elapsed, rather
      // than accepting a cooldown rejection as proof that mute works.
      await new Promise((r) => setTimeout(r, 110));
      setPreference("muted", true);
      const muted = GameSound.play("poof");
      setPreference("muted", false);
      setPreference("sfxVolume", 0);
      const effectsOff = GameSound.play("lockBig");
      await new Promise((r) => setTimeout(r, 950));
      setPreference("sfxVolume", 0.2);
      setPreference("masterVolume", 0.4);
      GameSound.play("lock");
      await new Promise((r) => setTimeout(r, 200));
      return {
        decoded: GameSound.samplesReady,
        expected: Object.keys(SFX_ASSETS).length,
        errors: GameSound.stats.sampleErrors,
        played,
        sources,
        muted,
        effectsOff,
        randomCalls,
        gains: GameSound.gains,
        peak: GameSound.stats.peakVoices,
      };
    } finally {
      Math.random = random;
    }
  });
  assert.equal(result.decoded, result.expected);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(Object.keys(result.played).sort(), [
    "erase",
    "lock",
    "lockBig",
    "poof",
    "tick",
  ]);
  assert.ok(
    result.sources.length >= 5 &&
      result.sources.every((s) => s.nonSilent && s.duration > 0.02),
  );
  assert.equal(result.randomCalls, 0);
  assert.equal(result.muted, false);
  assert.equal(result.effectsOff, false);
  assert.ok(result.peak <= 20);
  assert.ok(Math.abs(result.gains.sfx - 0.2) < 0.01);
  assert.ok(Math.abs(result.gains.master - 0.4) < 0.01);
  await page.waitForTimeout(850);
  assert.equal(await page.evaluate(() => GameSound.activeVoices), 0);
});

test("reveal and smoke hooks play recordings only for actual effects; reel ticks and normal versus large locks follow animation", async (t) => {
  const page = await notebook(t);
  const result = await page.evaluate(async () => {
    setPace("5");
    const sounds = [],
      original = GameSound.play;
    GameSound.play = (id) => {
      sounds.push(id);
      return true;
    };
    try {
      const i = state.map.findIndex((c) => !c.seen && !c.wall);
      await revealTile(i);
      await revealTile(i);
      smokePoof(document.querySelector(`[data-tile="${i}"]`));
      smokePoof(null);
      const reveal = sounds.splice(0);
      const faces = [{ type: "sword", tier: 1, weight: 1 }];
      const host = document.createElement("div");
      document.body.append(host);
      host.innerHTML = drawMachine("sample-test", [
        faces[0],
        faces[0],
        faces[0],
      ]);
      await runMachine("sample-test", [faces, faces, faces], {
        results: [faces[0], faces[0], faces[0]],
      });
      const normal = sounds.splice(0);
      host.innerHTML = drawMachine("sample-test", [faces[0]], { one: true });
      setPace("skip");
      await runMachine("sample-test", [faces], { results: [faces[0]] });
      const large = sounds.splice(0);
      host.innerHTML = drawMachine("sample-test", [
        faces[0],
        faces[0],
        faces[0],
      ]);
      await runMachine("sample-test", [faces, faces, faces], {
        results: [faces[0], faces[0], faces[0]],
      });
      const skipped = sounds.splice(0);
      host.remove();
      return { reveal, normal, large, skipped };
    } finally {
      GameSound.play = original;
    }
  });
  assert.deepEqual(result.reveal, ["erase", "poof"]);
  assert.equal(result.normal.filter((x) => x === "tick").length, 36);
  assert.equal(result.normal.filter((x) => x === "lock").length, 3);
  assert.equal(result.normal.includes("lockBig"), false);
  assert.deepEqual(result.large, ["lever", "lockBig"]);
  assert.deepEqual(result.skipped, ["lever", "lock", "lock", "lock"]);
});

test("unsupported recordings report once and use synthesis without blocking gameplay", async (t) => {
  const page = await notebook(t);
  const result = await page.evaluate(async () => {
    const proto = AudioContext.prototype,
      original = proto.decodeAudioData;
    proto.decodeAudioData = () =>
      Promise.reject(new Error("Fixture unsupported WAV"));
    try {
      await GameSound.unlock();
      const before = GameSound.stats.played;
      const first = GameSound.play("erase");
      await GameSound.unlock();
      return {
        first,
        decoded: GameSound.samplesReady,
        errors: GameSound.stats.sampleErrors,
        expectedErrors: Object.keys(SFX_ASSETS).length,
        synth: GameSound.stats.played - before,
        recordings: GameSound.stats.samplePlays,
      };
    } finally {
      proto.decodeAudioData = original;
    }
  });
  assert.equal(result.first, true);
  assert.equal(result.decoded, 0);
  assert.equal(
    result.errors.length,
    result.expectedErrors,
    "each failure is reported once, never retried on every click",
  );
  assert.equal(result.synth, 1);
  assert.deepEqual(result.recordings, {});
});
