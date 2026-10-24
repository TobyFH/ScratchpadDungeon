// Original temporary Web Audio cues, mixed through the existing SFX bus/pool.
const REWARD_CUES = Object.freeze({
  coinsRush: {
    frequencies: [930, 1420, 1130, 1780, 1240, 1520],
    duration: 0.48,
    gain: 0.035,
    type: "triangle",
    cooldown: 600,
  },
  itemFind: {
    frequencies: [660, 880, 1320],
    duration: 0.28,
    gain: 0.065,
    type: "sine",
    cooldown: 160,
  },
  criticalGold: {
    frequencies: [980, 1470, 1960],
    duration: 0.36,
    gain: 0.055,
    type: "triangle",
    cooldown: 220,
  },
  criticalHeal: {
    frequencies: [440, 660, 880],
    duration: 0.43,
    gain: 0.055,
    type: "sine",
    cooldown: 220,
  },
  criticalBlade: {
    frequencies: [130, 260, 520],
    duration: 0.22,
    gain: 0.06,
    type: "triangle",
    cooldown: 220,
  },
  criticalMagic: {
    frequencies: [330, 495, 990],
    duration: 0.38,
    gain: 0.06,
    type: "sine",
    cooldown: 220,
  },
  criticalPoison: {
    frequencies: [220, 277, 185],
    duration: 0.38,
    gain: 0.045,
    type: "sawtooth",
    cooldown: 220,
  },
  criticalBlock: {
    frequencies: [180, 360, 540],
    duration: 0.32,
    gain: 0.055,
    type: "triangle",
    cooldown: 220,
  },
  criticalTrap: {
    frequencies: [85, 62],
    duration: 0.4,
    gain: 0.055,
    noise: true,
    cooldown: 220,
  },
  criticalStun: {
    frequencies: [360, 720, 180],
    duration: 0.3,
    gain: 0.05,
    type: "square",
    cooldown: 220,
  },
  criticalBuff: {
    frequencies: [220, 440, 660],
    duration: 0.4,
    gain: 0.05,
    type: "triangle",
    cooldown: 220,
  },
  criticalBlood: {
    frequencies: [80, 160, 100],
    duration: 0.3,
    gain: 0.05,
    type: "triangle",
    cooldown: 220,
  },
  jesterTrick: {
    frequencies: [392, 494, 440, 659],
    duration: 0.36,
    gain: 0.065,
    type: "triangle",
    cooldown: 180,
  },
  jesterFail: {
    frequencies: [440, 370, 294, 220],
    duration: 0.45,
    gain: 0.07,
    type: "triangle",
    cooldown: 220,
  },
  tunnel: {
    frequencies: [180, 270, 405, 540],
    duration: 0.5,
    gain: 0.05,
    type: "sine",
    cooldown: 220,
  },
});
function playCriticalTheme(options, details) {
  const mark = details.find((d) => d.value > 0)?.icon;
  const cue = options.jackpot
    ? "jesterTrick"
    : options.context === "treasure"
      ? "criticalGold"
      : options.context === "well"
        ? "criticalHeal"
        : ["trap", "rockfall", "ruin"].includes(options.context)
          ? "criticalTrap"
          : {
              coin: "criticalGold",
              heal: "criticalHeal",
              blessing: "criticalHeal",
              magic: "criticalMagic",
              poison: "criticalPoison",
              block: "criticalBlock",
              ward: "criticalBlock",
              trap: "criticalTrap",
              stun: "criticalStun",
              flame: "criticalBuff",
              rage: "criticalBuff",
              bloodprice: "criticalBlood",
            }[mark] || "criticalBlade";
  GameSound.play(cue);
}
const shakeMotions = new WeakMap();
function shakeFrames(amount, style) {
  const horizontal = style === "rumble",
    recoil = style === "recoil",
    vertical = style === "jolt",
    settle = style === "settle",
    celebrate = style === "celebrate";
  const signs = horizontal
    ? [0, -0.25, 0.55, -0.9, 1, -0.8, 0.6, -0.4, 0.2, 0]
    : recoil
      ? [0, -1, 0.3, -0.2, 0]
      : settle
        ? [0, 0.6, -0.3, 0.14, 0]
        : [0, -1, 0.8, -0.38, 0.16, 0];
  return signs.map((n, i) => ({
    transform: `translate(${vertical ? n * amount * 0.15 : n * amount}px,${horizontal ? n * amount * 0.12 : vertical ? n * amount : settle ? -Math.abs(n) * amount * 0.6 : (i % 2 ? 1 : -1) * Math.abs(n) * amount * 0.24}px) rotate(${horizontal ? 0 : n * amount * (celebrate ? 0.22 : 0.07)}deg)`,
  }));
}
Object.assign(SOUND_CUES, REWARD_CUES);
