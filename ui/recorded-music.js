// User-supplied music; originals and encoding instructions live in assets/audio/music.
// Only the active two looping decks and one stinger decode, through native media
// playback. Never decode every long recording into a permanent Web Audio buffer.
const MUSIC_RECORDINGS = Object.freeze({
  title: { src: "@asset(audio/music/TitleMusic.mp3)", gain: .8 },
  peaceful: { src: "@asset(audio/music/PeacefulCave.mp3)", gain: .8 },
  chill: { src: "@asset(audio/music/ChillCave.mp3)", gain: .8 },
  mysterious: { src: "@asset(audio/music/MysteriousCave.mp3)", gain: .8 },
  ominous: { src: "@asset(audio/music/OminiousCave.mp3)", gain: .8 },
  battle: { src: "@asset(audio/music/BattleMusic_01.mp3)", gain: .8 },
  victory: { src: "@asset(audio/music/VictoryJingle.mp3)", gain: 1 },
  failure: { src: "@asset(audio/music/FailureJingle.mp3)", gain: 1 },
});
const BIOME_MUSIC = Object.freeze({
  cave: "chill", overgrown: "peaceful", fungal: "mysterious",
  ice: "chill", crystal: "mysterious", maze: "ominous",
  unstable: "ominous", shadow: "ominous", lava: "ominous",
});
function musicSelection() {
  // A utility sheet preserves the menu beneath it, including its music.
  const kind = utilityOpen ? utilityContext?.kind : modalKind;
  if (!state || state.awaitingStarter || ["starter", "camp"].includes(kind))
    return { id: "title", key: "title", scene: "title" };
  if (state.enemy && !state.over && preferences().battleMusic !== false)
    return { id: "battle", key: "battle", scene: "battle" };
  const id = BIOME_MUSIC[floorBiome()] || "chill";
  return { id, key: `${state.runId}:${state.depth}:${id}`, scene: "exploration" };
}
function createRecordedMusic(context, bus) {
  const duck = context.createGain(), errors = new Set(), playedJingles = new Set();
  duck.connect(bus);
  let current = null, activeJingle = null, blocked = false, suspended = false;
  const decks = [];
  const ramp = (param, value, seconds) => {
    const now = context.currentTime;
    if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(now);
    else { param.cancelScheduledValues(now); param.setValueAtTime(param.value, now); }
    param.linearRampToValueAtTime(value, now + seconds);
  };
  function failed(id, error) {
    if (errors.has(id)) return;
    errors.add(id);
    const fallback = ["victory", "failure"].includes(id)
      ? "continuing the background music" : "using the fallback score";
    console.warn(`Music recording ${id} could not play; ${fallback}.`, error);
  }
  function deck() {
    const audio = new Audio();
    audio.preload = "metadata";
    const source = context.createMediaElementSource(audio), gain = context.createGain();
    source.connect(gain); gain.connect(duck); gain.gain.value = 0;
    const d = { audio, source, gain, id: null, key: null, retirement: null, generation: 0, fadingIn: false };
    audio.addEventListener("error", () => {
      if (d.id) failed(d.id, audio.error?.message || "Unsupported recording");
      audio.pause();
    });
    decks.push(d);
    return d;
  }
  function start(d) {
    if (suspended || document.hidden || blocked) return;
    const generation = d.generation;
    d.audio.play().then(() => {
      // Start the fade when decoded playback actually begins, even on slow devices.
      if (generation === d.generation && d === current && d.fadingIn) {
        d.fadingIn = false;
        ramp(d.gain.gain, MUSIC_RECORDINGS[d.id].gain, d.fadeSeconds);
      }
    }).catch(error => {
      if (generation !== d.generation || error.name === "AbortError") return;
      if (error.name === "NotAllowedError") blocked = true;
      else failed(d.id, error.message);
    });
  }
  function update(selection) {
    const asset = MUSIC_RECORDINGS[selection.id];
    if (!asset || errors.has(selection.id)) return false;
    if (current?.key === selection.key) return true;
    const previous = current;
    current = decks.find(d => d !== previous) || deck();
    clearTimeout(current.retirement);
    current.generation++;
    current.audio.pause();
    current.gain.gain.cancelScheduledValues(context.currentTime);
    current.gain.gain.value = 0;
    current.id = selection.id; current.key = selection.key;
    current.fadingIn = true; current.fadeSeconds = previous ? .65 : .35;
    current.audio.src = asset.src;
    current.audio.loop = true;
    current.audio.load();
    start(current);
    if (previous) {
      ramp(previous.gain.gain, 0, .45);
      const retiring = previous;
      retiring.retirement = setTimeout(() => {
        if (retiring !== current) retiring.audio.pause();
      }, 500);
    }
    return true;
  }
  function stopJingle() {
    if (!activeJingle) return;
    const old = activeJingle; activeJingle = null;
    old.audio.pause(); old.source.disconnect(); old.gain.disconnect();
    old.audio.removeAttribute("src"); old.audio.load();
    ramp(duck.gain, 1, .3);
  }
  function stinger(id, token) {
    if (!["victory", "failure"].includes(id) || playedJingles.has(token) ||
        preferences().muted || !preferences().musicVolume || !preferences().masterVolume ||
        document.hidden || context.state !== "running") return false;
    playedJingles.add(token);
    if (playedJingles.size > 32) playedJingles.delete(playedJingles.values().next().value);
    stopJingle();
    const audio = new Audio(MUSIC_RECORDINGS[id].src),
      source = context.createMediaElementSource(audio), gain = context.createGain();
    gain.gain.value = MUSIC_RECORDINGS[id].gain;
    source.connect(gain); gain.connect(bus); // Jingles bypass background ducking.
    const cue = { id, audio, source, gain };
    activeJingle = cue;
    ramp(duck.gain, .14, .065);
    const finish = () => { if (activeJingle === cue) stopJingle(); };
    audio.addEventListener("ended", finish, { once: true });
    audio.addEventListener("error", () => { failed(id, audio.error?.message); finish(); }, { once: true });
    audio.play().catch(error => {
      if (activeJingle !== cue) return;
      if (error.name !== "NotAllowedError" && error.name !== "AbortError") failed(id, error.message);
      finish();
    });
    return true;
  }
  return {
    update, stinger,
    pause() { suspended = true; decks.forEach(d => d.audio.pause()); activeJingle?.audio.pause(); },
    resume() {
      suspended = false; blocked = false;
      if (current && !errors.has(current.id) && current.audio.paused) start(current);
      const cue = activeJingle;
      if (cue?.audio.paused) cue.audio.play().catch(() => { if (activeJingle === cue) stopJingle(); });
    },
    get status() {
      return { id: current?.id, key: current?.key,
        playing: !!current && !current.audio.paused && current.audio.readyState >= 3,
        position: current?.audio.currentTime || 0, duration: current?.audio.duration || 0,
        decks: decks.length, jingle: activeJingle?.id || null,
        duck: duck.gain.value, errors: [...errors] };
    },
    get output() { return duck; },
  };
}
