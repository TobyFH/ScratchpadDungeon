// Standalone listening sheet and a short montage, made from the actual mixes.
// It has no dependencies or external requests and is not part of the game UI.
const fs = require("node:fs"), path = require("node:path");
const { loadAudioBank, credits } = require("./audio-bank.cjs");
const root = path.resolve(__dirname, "..");
function renderSfxReview() {
  const { bank, metrics } = loadAudioBank(),
    out = path.join(root, "test-results/living-sketchbook"),
    uri = (name, mime) => `data:${mime};base64,${fs.readFileSync(path.join(root, name)).toString("base64")}`,
    escape = (s) => s.replace(/[&<>"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[c]);
  fs.mkdirSync(out, { recursive: true });
  const sequence = ["erase", "step", "step", "lever", "tick", "tick", "tick", "lock", "hit", "shield", "heal", "critical", "lockBig", "reward", "jackBox", "pageTurn"],
    frames = [];
  for (const cueId of sequence) {
    const cue = bank.cues[cueId], asset = bank.assets[cue.samples[0]], bytes = fs.readFileSync(path.join(root, asset.path));
    if (bytes.toString("ascii", 36, 40) !== "data") throw Error("Montage expects the canonical generated WAV header");
    const pcm = bytes.subarray(44), count = Math.floor(pcm.length / 2 / cue.rate);
    for (let i = 0; i < count; i++) {
      const p = Math.min(pcm.length / 2 - 1, i * cue.rate), k = Math.floor(p),
        a = pcm.readInt16LE(k * 2), b = pcm.readInt16LE(Math.min(k + 1, pcm.length / 2 - 1) * 2);
      frames.push(Math.round((a + (b - a) * (p - k)) * cue.gain * .75));
    }
    for (let i = 0; i < bank.sampleRate * .12; i++) frames.push(0);
  }
  const wav = Buffer.alloc(44 + frames.length * 2);
  wav.write("RIFF", 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(bank.sampleRate, 24); wav.writeUInt32LE(bank.sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write("data", 36); wav.writeUInt32LE(frames.length * 2, 40);
  frames.forEach((n, i) => wav.writeInt16LE(Math.max(-32767, Math.min(32767, n)), 44 + i * 2));
  fs.writeFileSync(path.join(out, "Living-Sketchbook-preview.wav"), wav);
  const embedded = Object.fromEntries(Object.entries(bank.assets).map(([id, a]) => [id, {
    src: uri(a.path, "audio/wav"), description: a.description,
  }]));
  const fontLicenses = ["OFL-Caveat.txt", "OFL-CabinSketch.txt"].map((name) =>
    fs.readFileSync(path.join(root, "ui/assets/fonts", name), "utf8")).join("\n\n").replace(/\*\//g, "* /");
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>The Living Sketchbook — sound audition</title>
<style>/* Embedded fonts: SIL Open Font License 1.1.\n${fontLicenses}\n*/
@font-face{font-family:Hand;src:url(${uri("ui/assets/fonts/Caveat.ttf", "font/ttf")})}@font-face{font-family:Sketch;src:url(${uri("ui/assets/fonts/CabinSketch-Bold.ttf", "font/ttf")})}
:root{color-scheme:light;--paper:#f2ead9;--ink:#35342e}*{box-sizing:border-box}body{margin:0;background:#403b32;color:var(--ink);font:22px Hand,cursive}main{max-width:1050px;margin:20px auto;padding:24px;background:var(--paper);border:3px double var(--ink)}h1{font:32px Sketch,cursive;margin:0 0 12px}p{margin:10px 0;line-height:1.25}header{position:sticky;top:0;background:var(--paper);padding:12px 0;border-bottom:1px solid var(--ink);z-index:1}.controls{display:flex;gap:15px;flex-wrap:wrap;align-items:center}button{font:inherit;cursor:pointer;border:1px solid var(--ink);border-radius:2px;background:#f7f0df;color:var(--ink);padding:8px 12px}button:focus-visible{outline:3px solid #7d6740;outline-offset:2px}button[data-playing]{background:#d9dec9}#sounds{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px;margin-top:20px}#sounds button{text-align:left;min-height:100px;display:grid;align-content:start;gap:5px}#sounds b{font:22px Sketch,cursive}small{display:block;font-size:18px}audio{max-width:100%}a{color:inherit}footer{margin-top:22px;border-top:1px solid var(--ink)}@media(max-width:500px){main{margin:8px;padding:14px}h1{font-size:27px}}</style>
<main><header><h1>The Living Sketchbook</h1><p>Sound audition · ${Object.keys(bank.assets).length} mixes / ${Object.keys(bank.cues).length} game cues</p><div class="controls"><label>Audition volume <input aria-label="Audition volume" id="volume" type="range" min="0" max="100" value="50"></label><button id="stop">Stop all sounds</button></div><p><audio controls aria-label="Short sound montage" src="data:audio/wav;base64,${wav.toString("base64")}"></audio></p></header>
<section id="sounds" aria-label="Individual game sounds">${Object.entries(bank.cues).map(([id, cue]) => `<button data-cue="${id}"><b>${escape(id.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()))}</b><small>${escape(bank.assets[cue.samples[0]].description)}</small></button>`).join("")}</section><footer><p>Source audio: Kenney, CC0 1.0 (Interface Sounds, RPG Audio and Impact Sounds). Original mixes made for Scratchpad Dungeon.</p><p>The erase mix also uses the user's original uploaded recording, authorised for this game; it is not a CC0 standalone sample.</p><p><a href="https://creativecommons.org/publicdomain/zero/1.0/">CC0 licence</a> · <a href="https://github.com/TobyFH/ScratchpadDungeon/blob/main/docs/AUDIO_ASSETS.md">Source credits and replacement instructions</a></p></footer></main>
<script>const assets=${JSON.stringify(embedded)},cues=${JSON.stringify(bank.cues)};let context,master,loading;const buffers=new Map(),cycles=new Map(),playing=new Set();
async function unlock(){if(!context){context=new AudioContext();master=context.createGain();master.gain.value=+document.querySelector('#volume').value/100;master.connect(context.destination);loading=Promise.all(Object.entries(assets).map(async([id,a])=>{const binary=atob(a.src.split(',')[1]),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));buffers.set(id,await context.decodeAudioData(bytes.buffer))}));}await context.resume();await loading;}
document.querySelector('audio').volume=.5;
document.querySelector('#volume').oninput=e=>{const value=+e.target.value/100;if(master)master.gain.setTargetAtTime(value,context.currentTime,.02);document.querySelector('audio').volume=value};
document.querySelector('#stop').onclick=()=>{for(const source of playing)source.stop();const montage=document.querySelector('audio');montage.pause();montage.currentTime=0};
document.querySelectorAll('[data-cue]').forEach(button=>button.onclick=async()=>{await unlock();const id=button.dataset.cue,cue=cues[id],cycle=cycles.get(id)||0,asset=cue.samples[cycle%cue.samples.length];cycles.set(id,cycle+1);if(playing.size>=12)[...playing][0].stop();const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffers.get(asset);source.playbackRate.value=cue.rate;gain.gain.value=cue.gain;source.connect(gain);gain.connect(master);playing.add(source);button.dataset.playing='true';source.onended=()=>{playing.delete(source);source.disconnect();gain.disconnect();delete button.dataset.playing};source.start()});</script></html>`;
  fs.writeFileSync(path.join(out, "Living-Sketchbook-sound-preview.html"), html);
  fs.writeFileSync(path.join(out, "mix-levels.json"), JSON.stringify(metrics, null, 2));
  fs.writeFileSync(path.join(out, "credits.json"), JSON.stringify(credits(bank), null, 2));
  console.log(`Saved the offline sound audition and ${Math.round(frames.length / bank.sampleRate)}-second montage to ${out}`);
  return { out, html };
}
module.exports = { renderSfxReview };
if (require.main === module) renderSfxReview();
