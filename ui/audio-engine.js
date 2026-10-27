const GameSound = (() => {
  let context = null,
    master = null,
    buses = {},
    noise = null,
    timer = null,
    note = 0,
    nextBeat = 0,
    sampleLoading = null;
  const sampleBuffers = new Map(), sampleCycle = new Map();
  const active = new Set(),
    last = new Map(),
    gainTargets = new WeakMap();
  const stats = {
    played: 0,
    peakVoices: 0,
    musicNotes: 0,
    musicParts: {},
    cries: 0,
    lastCry: null,
    samplePlays: {},
    sampleAssets: {},
    lastSample: null,
    sampleErrors: [],
  };
  function configure(p) {
    if (!context) return;
    const now = context.currentTime;
    const update = (node, target) => {
      // Rendering damage/HP must not queue identical audio automation.
      if (gainTargets.get(node) === target) return;
      gainTargets.set(node, target);
      node.gain.cancelScheduledValues(now);
      node.gain.setTargetAtTime(target, now, 0.03);
    };
    update(master, p.muted ? 0 : p.masterVolume);
    for (const key of ["sfx", "music", "ambience"])
      update(buses[key], p[key + "Volume"]);
  }
  async function unlock() {
    try {
      if (!context) {
        const C = window.AudioContext || window.webkitAudioContext;
        if (!C) return;
        context = new C();
        master = context.createGain();
        const limiter = context.createDynamicsCompressor();
        limiter.threshold.value = -14;
        limiter.ratio.value = 8;
        master.connect(limiter);
        limiter.connect(context.destination);
        for (const key of ["sfx", "music", "ambience"]) {
          buses[key] = context.createGain();
          buses[key].connect(master);
        }
        noise = context.createBuffer(
          1,
          Math.floor(context.sampleRate * 0.5),
          context.sampleRate,
        );
        const data = noise.getChannelData(0);
        let seed = 1234567;
        for (let i = 0; i < data.length; i++) {
          seed ^= seed << 13;
          seed ^= seed >>> 17;
          seed ^= seed << 5;
          data[i] = (seed >>> 0) / 2147483648 - 1;
        }
        configure(preferences());
        sampleLoading = loadSamples();
      }
      if (document.hidden) return;
      await context.resume();
      if (!timer) {
        nextBeat = context.currentTime + 0.04;
        background();
        timer = setInterval(background, 180);
      }
      await sampleLoading;
    } catch {
      /* Audio is optional; the notebook remains playable. */
    }
  }
  function releaseVoice(group, stop = false) {
    if (!active.delete(group)) return;
    for (const node of group.nodes) {
      try {
        if (stop) node.stop?.();
        node.disconnect();
      } catch { /* A stopped one-shot may already have disconnected. */ }
    }
    group.gain.disconnect();
  }
  function reserveVoice(channel, priority = false) {
    if (
      !context ||
      context.state !== "running" ||
      document.hidden ||
      preferences().muted ||
      (!priority && active.size >= (channel === "sfx" ? 20 : 12)) ||
      preferences()[channel + "Volume"] === 0 ||
      preferences().masterVolume === 0
    )
      return false;
    if (priority && active.size >= 20) {
      const victim =
        [...active].find((v) => v.channel && v.channel !== "sfx") ||
        [...active][0];
      if (victim) releaseVoice(victim, true);
    }
    return true;
  }
  function voice(cue, channel = "sfx", when = null) {
    if (!cue?.frequencies?.length || !reserveVoice(channel, cue.priority)) return false;
    const now = Math.max(context.currentTime, when ?? context.currentTime),
      group = { nodes: [], gain: context.createGain(), channel };
    group.gain.connect(buses[channel]);
    group.gain.gain.setValueAtTime(0, now);
    group.gain.gain.linearRampToValueAtTime(
      cue.gain,
      now + (cue.attack || 0.012),
    );
    group.gain.gain.exponentialRampToValueAtTime(0.0001, now + cue.duration);
    const cleanup = () => releaseVoice(group);
    cue.frequencies.forEach((frequency, i) => {
      const node = cue.noise
        ? context.createBufferSource()
        : context.createOscillator();
      if (cue.noise) {
        node.buffer = noise;
        node.playbackRate.value = frequency / 120;
      } else {
        node.type = cue.type || "sine";
        node.frequency.setValueAtTime(frequency, now);
        if (cue.contour)
          cue.contour.forEach((ratio, k) => {
            node.frequency.exponentialRampToValueAtTime(
              Math.max(20, frequency * ratio),
              now + 0.01 + (k / (cue.contour.length - 1)) * (cue.duration - 0.04),
            );
          });
      }
      if (cue.filter && (!cue.noise || cue.noiseFilter)) {
        const filter = context.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = cue.filter;
        node.connect(filter);
        filter.connect(group.gain);
        group.nodes.push(filter);
      } else node.connect(group.gain);
      group.nodes.push(node);
      node.start(
        now + i * Math.min(0.075, cue.duration / cue.frequencies.length),
      );
      node.stop(now + cue.duration + 0.06);
      if (i === 0) node.onended = cleanup;
    });
    active.add(group);
    stats.played++;
    stats.peakVoices = Math.max(stats.peakVoices, active.size);
    return true;
  }
  async function loadSamples() {
    // Decode once, without fetch(), runtime URLs or gameplay randomness.
    // A failed/unsupported recording falls back to its synthesised cue.
    await Promise.all(
      Object.entries(SFX_ASSETS).map(async ([id, asset]) => {
        try {
          const binary = atob(asset.src.slice(asset.src.indexOf(",") + 1));
          const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
          sampleBuffers.set(id, await context.decodeAudioData(bytes.buffer));
        } catch (error) {
          stats.sampleErrors.push(id);
          console.warn(
            `Audio recording ${id} could not be decoded; using synthesis.`,
            error,
          );
        }
      }),
    );
  }
  function sampleVoice(id, cue, sampleId, buffer) {
    if (!reserveVoice("sfx", cue.priority)) return false;
    const source = context.createBufferSource(),
      gain = context.createGain(),
      group = { nodes: [source], gain, channel: "sfx" };
    source.buffer = buffer;
    source.playbackRate.value = cue.rate || 1;
    gain.gain.value = cue.gain;
    source.connect(gain);
    gain.connect(buses.sfx);
    source.onended = () => releaseVoice(group);
    active.add(group);
    source.start();
    stats.played++;
    stats.samplePlays[id] = (stats.samplePlays[id] || 0) + 1;
    stats.sampleAssets[sampleId] = (stats.sampleAssets[sampleId] || 0) + 1;
    stats.lastSample = { cue: id, asset: sampleId };
    stats.peakVoices = Math.max(stats.peakVoices, active.size);
    return true;
  }
  function play(id) {
    const asset = SOUND_SAMPLES[id],
      cue = asset || SOUND_CUES[id];
    if (!cue) return false;
    const now = performance.now();
    if (now - (last.get(id) || -Infinity) < (cue.cooldown || 0)) return false;
    last.set(id, now);
    if (asset) {
      // Round-robin variation is cosmetic and deterministic. A failed variant
      // can use a decoded sibling; never draw from the gameplay random stream.
      const cycle = sampleCycle.get(id) || 0;
      for (let offset = 0; offset < asset.samples.length; offset++) {
        const sampleId = asset.samples[(cycle + offset) % asset.samples.length],
          buffer = sampleBuffers.get(sampleId);
        if (!buffer) continue;
        const played = sampleVoice(id, asset, sampleId, buffer);
        if (played) sampleCycle.set(id, cycle + offset + 1);
        return played;
      }
    }
    return voice(SOUND_CUES[id]);
  }
  function cry(kind, mood = "appear", delay = 0, variant = 0) {
    const id = kind === "skeleton" ? "skull" : kind,
      punIndex = id.startsWith("pun-")
        ? Object.keys(PUN_ENEMIES).indexOf(id.slice(4))
        : -1,
      profile =
        punIndex >= 0
          ? [
              ["triangle", "sine", "sawtooth", "square"][punIndex % 4],
              120 + punIndex * 19,
              [
                1,
                1.1 + (punIndex % 5) * 0.15,
                0.6 + (punIndex % 7) * 0.12,
                1.4 + (punIndex % 3) * 0.1,
              ],
              0.3 + (punIndex % 4) * 0.06,
              0.05,
            ]
          : CRY_PROFILES[id] || CRY_PROFILES.skull,
      [type, pitch, contour, duration, roughness] = profile,
      dying = mood === "death";
    const played = voice(
      {
        frequencies: [pitch * (dying ? 0.68 : 1) * (1 + variant * 0.027)],
        priority: true,
        contour: dying ? [...contour].reverse().map((n) => n * 0.8) : contour,
        duration: duration * (dying ? 1.25 : 1),
        gain: 0.09,
        type,
        filter: 1800,
        attack: 0.025,
      },
      "sfx",
      (context?.currentTime || 0) + delay,
    );
    if (played) {
      stats.cries++;
      stats.lastCry = { kind: id, mood };
      if (roughness)
        voice(
          {
            frequencies: [80],
            duration: duration * 0.7,
            gain: roughness * 0.07,
            noise: true,
          },
          "sfx",
          context.currentTime + delay,
        );
    }
    return played;
  }
  function background() {
    if (!context || document.hidden || context.state !== "running") return;
    if (nextBeat < context.currentTime - 0.3)
      nextBeat = context.currentTime + 0.04;
    const scene = state?.enemy ? "battle" : "exploration";
    const score = scene === "battle" ? BATTLE_MUSIC_SCORE : MUSIC_SCORE;
    if (stats.musicScene !== scene) { stats.musicScene = scene; note = 0; }
    while (nextBeat < context.currentTime + 0.28) {
      const step = note++ % score.melody.length,
        beat = nextBeat;
      for (const { part, cue } of musicVoices(scene, step)) {
        if (voice(cue, "music", beat)) {
          if (part === "melody") stats.musicNotes++;
          stats.musicParts[part] = (stats.musicParts[part] || 0) + 1;
        }
      }
      if (step % 4 === 0)
        voice(
          { frequencies: [60], duration: 1.7, gain: 0.025, noise: true },
          "ambience", beat,
        );
      if (step % 8 === 0) {
        const depth = Math.min(1,Math.max(0,(state?.depth||1)-1)/9);
        stats.ambienceDepth=depth;
        voice({frequencies:[39+step%3*4],duration:2.2,gain:.004+depth*.023,type:"sine",attack:.3},"ambience",beat);
        voice({frequencies:[80],duration:2.4,gain:.003+depth*.014,noise:true,filter:180,attack:.45},"ambience",beat);
      }
      nextBeat += score.stepSeconds;
    }
  }
  document.addEventListener("pointerdown", unlock, { passive: true });
  document.addEventListener("keydown", (e) => {
    if (!e.repeat) unlock();
  });
  document.addEventListener("click", (e) => {
    if (
      !e.target.closest("[data-tile]") &&
      e.target.closest("button,input,select")
    )
      play("click");
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (timer) clearInterval(timer);
      timer = null;
      context?.suspend().catch(() => {});
    } else if (context) unlock();
  });
  return {
    unlock,
    play,
    cry,
    configure,
    stats,
    get samplesReady() {
      return sampleBuffers.size;
    },
    get activeVoices() {
      return active.size;
    },
    get context() {
      return context;
    },
    get gains() {
      return {
        master: master?.gain.value,
        ...Object.fromEntries(
          Object.entries(buses).map(([k, v]) => [k, v.gain.value]),
        ),
      };
    },
  };
})();
