// Original, deterministic miniature score: plucked melody, low strings
// and an airy harmony. MIDI pitches keep the composition easy to edit.
const MUSIC_SCORE = Object.freeze({
  stepSeconds: 0.42,
  chords: [
    [50, 53, 57],
    [46, 50, 53],
    [48, 52, 55],
    [45, 49, 52],
  ],
  melody: [
    62,
    null,
    65,
    69,
    67,
    65,
    62,
    null,
    60,
    62,
    65,
    null,
    69,
    67,
    65,
    null,
    65,
    null,
    69,
    70,
    69,
    65,
    62,
    null,
    60,
    null,
    62,
    65,
    64,
    61,
    57,
    null,
    74,
    69,
    65,
    null,
    67,
    69,
    65,
    62,
    65,
    62,
    60,
    null,
    62,
    65,
    69,
    null,
    70,
    69,
    65,
    null,
    67,
    65,
    62,
    60,
    64,
    null,
    61,
    57,
    61,
    64,
    69,
    null,
  ],
});
const BATTLE_MUSIC_SCORE = Object.freeze({
  stepSeconds: .24,
  chords:[[50,53,57],[48,52,55],[46,50,53],[45,49,52]],
  melody:[62,65,69,null,62,65,70,69,60,64,67,null,60,64,69,67,58,62,65,null,58,62,67,65,57,61,64,null,57,64,69,null],
});

// Deterministic arrangements feed the existing pooled music bus. Short bass
// notes leave room for battle cries; no gameplay randomness or external audio.
function musicVoices(scene, index) {
  const battle = scene === "battle",
    score = battle ? BATTLE_MUSIC_SCORE : MUSIC_SCORE,
    step = index % score.melody.length,
    chord = score.chords[Math.floor(step / (battle ? 8 : 16)) % score.chords.length],
    pitch = score.melody[step],
    hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12),
    parts = [];
  const add = (part, cue) => parts.push({ part, cue });
  if (pitch)
    add("melody", {
      frequencies: [hz(pitch)], duration: battle ? .34 : .75,
      gain: battle ? .038 : .045, type: "triangle", filter: battle ? 1800 : 1500,
    });
  if (!battle) {
    // Exploration retains its existing quiet plucks, drone and harmony.
    if (step % 4 === 0) {
      add("bass", { frequencies: [hz(chord[0] - 12)], duration: 1.55,
        gain: .035, type: "sine", attack: .08 });
      add("harmony", { frequencies: chord.map((n) => hz(n + 12)),
        duration: 1.65, gain: .012, type: "sine", attack: .22 });
    }
    return parts;
  }
  const accent = step % 8;
  add("bass", {
    frequencies: [hz(chord[0] - 12 + (accent === 3 || accent === 7 ? 7 : 0))],
    duration: .29, gain: .095, type: "triangle", filter: 650, attack: .008,
  });
  if ([0, 3, 4, 6].includes(accent))
    add("kick", { frequencies: [100], contour: [1, .56, .36],
      duration: .2, gain: .12, type: "sine", attack: .004 });
  if (accent === 2 || accent === 6)
    add("snare", { frequencies: [120], duration: .13, gain: .038,
      noise: true, noiseFilter: true, filter: 2200, attack: .004 });
  else if (accent % 2)
    add("brush", { frequencies: [180], duration: .065, gain: .013,
      noise: true, noiseFilter: true, filter: 6000, attack: .003 });
  if (accent === 0) {
    add("sub", { frequencies: [hz(chord[0] - 24)], duration: .7,
      gain: .075, type: "sine", attack: .018 });
    add("harmony", { frequencies: chord.map((n) => hz(n)), duration: .85,
      gain: .012, type: "triangle", filter: 1100, attack: .06 });
  }
  return parts;
}
