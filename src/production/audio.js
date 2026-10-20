Production.audio = (() => {
  let context = null,
    master = null,
    sfxBus = null,
    musicBus = null,
    scene = "field",
    musicVoice = null,
    fadingVoice = null,
    musicRequest = 0,
    unlocked = false,
    ducked = false;
  const clips = new Map(),
    cooldowns = new Map(),
    voices = [],
    MAX_VOICES = 16;
  const settings = Production.settings.audio;
  async function buffer(id) {
    if (clips.has(id)) return clips.get(id);
    const asset = Production.assets.get(id);
    if (!asset || !["sound", "music"].includes(asset.type)) return null;
    const promise = (async () => {
      try {
        const bytes = Uint8Array.from(atob(asset.url.split(",")[1]), (c) =>
          c.charCodeAt(0),
        );
        return await context.decodeAudioData(bytes.buffer);
      } catch (error) {
        Production.report(
          "Audio asset could not be decoded: " + id,
          error.message,
        );
        return null;
      }
    })();
    clips.set(id, promise);
    return promise;
  }
  function refresh() {
    if (!context) return;
    const now = context.currentTime;
    master.gain.setTargetAtTime(
      settings.muted || document.hidden ? 0 : settings.master,
      now,
      0.025,
    );
    sfxBus.gain.setTargetAtTime(settings.sfx, now, 0.025);
    musicBus.gain.setTargetAtTime(
      settings.music * (ducked ? 0.2 : 1),
      now,
      0.08,
    );
  }
  async function unlock() {
    try {
      if (!context) {
        const C = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!C) return false;
        context = new C();
        master = context.createGain();
        sfxBus = context.createGain();
        musicBus = context.createGain();
        const limiter = context.createDynamicsCompressor();
        limiter.threshold.value = -8;
        limiter.ratio.value = 8;
        sfxBus.connect(master);
        musicBus.connect(master);
        master.connect(limiter);
        limiter.connect(context.destination);
        for (let i = 0; i < MAX_VOICES; i++) {
          const gain = context.createGain();
          gain.connect(sfxBus);
          voices.push({ gain, node: null, priority: 0, started: 0 });
        }
        refresh();
      }
      if (context.state === "suspended") await context.resume();
      unlocked = context.state === "running";
      if (unlocked) setScene(scene, true);
      return unlocked;
    } catch (error) {
      Production.report("Audio is unavailable", error.message);
      return false;
    }
  }
  async function play(id, { volume = 1, rate = 1 } = {}) {
    if (!unlocked || settings.muted || document.hidden || !context)
      return false;
    const asset = Production.assets.get(id);
    if (!asset || asset.type !== "sound") return false;
    const time = performance.now();
    if (time - (cooldowns.get(id) ?? -Infinity) < (asset.cooldownMs || 0))
      return false;
    cooldowns.set(id, time);
    const clip = await buffer(id);
    if (!clip || !unlocked || settings.muted) return false;
    let voice = voices.find((v) => !v.node);
    if (!voice) {
      voice = [...voices].sort(
        (a, b) => a.priority - b.priority || a.started - b.started,
      )[0];
      if (voice.priority > (asset.priority || 1)) return false;
      voice.node.stop();
    }
    const node = context.createBufferSource();
    node.buffer = clip;
    node.playbackRate.value = Math.max(0.5, Math.min(2, rate));
    voice.gain.gain.setValueAtTime(
      Math.min(1, Math.max(0, volume)) * (asset.volume ?? 1),
      context.currentTime,
    );
    node.connect(voice.gain);
    voice.node = node;
    voice.priority = asset.priority || 1;
    voice.started = performance.now();
    node.onended = () => {
      node.disconnect();
      if (voice.node === node) voice.node = null;
    };
    node.start();
    return true;
  }
  async function setScene(next, force = false) {
    if (!["field", "battle"].includes(next)) next = "field";
    const changed = next !== scene;
    scene = next;
    if (!unlocked || !context || (!changed && !force && musicVoice)) return;
    const request = ++musicRequest,
      id = "music." + next,
      asset = Production.assets.get(id),
      clip = await buffer(id);
    if (request !== musicRequest || !clip || !asset) return;
    if (musicVoice?.id === id && !force) return;
    if (musicVoice?.id === id && force) {
      refresh();
      return;
    }
    const now = context.currentTime,
      old = musicVoice,
      node = context.createBufferSource(),
      gain = context.createGain();
    if (fadingVoice) {
      fadingVoice.node.stop(now);
      fadingVoice.node.disconnect();
      fadingVoice.gain.disconnect();
      fadingVoice = null;
    }
    if ((asset.loopStart || 0) >= clip.duration) {
      Production.report("Music loop starts beyond its clip: " + id);
      return;
    }
    node.buffer = clip;
    node.loop = true;
    node.loopStart = asset.loopStart || 0;
    node.loopEnd = Math.min(clip.duration, asset.loopEnd || clip.duration);
    node.connect(gain);
    gain.connect(musicBus);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(asset.volume ?? 0.32, now + 0.8);
    node.start();
    musicVoice = { id, node, gain };
    if (old) {
      fadingVoice = old;
      old.gain.gain.cancelScheduledValues(now);
      old.gain.gain.setValueAtTime(old.gain.gain.value, now);
      old.gain.gain.linearRampToValueAtTime(0, now + 0.8);
      old.node.stop(now + 0.85);
      old.node.onended = () => {
        old.node.disconnect();
        old.gain.disconnect();
        if (fadingVoice === old) fadingVoice = null;
      };
    }
  }
  function update(values) {
    for (const key of ["master", "sfx", "music"])
      if (values[key] !== undefined) {
        const value = Number(values[key]);
        if (!Number.isFinite(value) || value < 0 || value > 1)
          throw Error("Volume must be between zero and one");
        settings[key] = value;
      }
    if (values.muted !== undefined) settings.muted = !!values.muted;
    Production.persist();
    refresh();
  }
  function duck(value) {
    ducked = !!value;
    refresh();
  }
  function stop() {
    musicRequest++;
    for (const v of voices) {
      v.node?.stop();
      v.node = null;
    }
    for (const voice of [musicVoice, fadingVoice])
      if (voice) {
        voice.node.stop();
        voice.node.disconnect();
        voice.gain.disconnect();
      }
    musicVoice = null;
    fadingVoice = null;
  }
  document.addEventListener("pointerdown", unlock, { once: true });
  document.addEventListener("keydown", unlock, { once: true });
  document.addEventListener("visibilitychange", refresh);
  return {
    unlock,
    play,
    setScene,
    update,
    duck,
    stop,
    settings,
    get status() {
      return {
        unlocked,
        state: context?.state || "uninitialised",
        activeVoices: voices.filter((v) => v.node).length,
        poolSize: MAX_VOICES,
        scene,
        music: musicVoice?.id || null,
        musicVoices: Number(!!musicVoice) + Number(!!fadingVoice),
      };
    },
  };
})();
