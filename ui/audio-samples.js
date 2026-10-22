// User-supplied recordings. Original WAVs stay replaceable; the builder embeds
// their bytes so file:// play and Save HTML never require an asset server.
// Gain is a mix trim, before the existing SFX and master volume controls.
const SOUND_SAMPLES = Object.freeze({
  erase: { src: "@asset(audio/SFX_Erase.wav)", gain: 0.35, cooldown: 90 },
  poof: { src: "@asset(audio/SFX_Poof.wav)", gain: 0.55, cooldown: 80 },
  tick: { src: "@asset(audio/SFX_SlotClick.wav)", gain: 0.28, cooldown: 35 },
  lock: { src: "@asset(audio/SFX_SlotEnd.wav)", gain: 0.6, cooldown: 30 },
  lockBig: {
    src: "@asset(audio/SFX_SlotEndBig.wav)",
    gain: 0.75,
    cooldown: 30,
  },
});
