// Original temporary Web Audio cues, mixed through the existing SFX bus/pool.
const REWARD_CUES = Object.freeze({
  iceSlide: { frequencies: [320,260,210], duration:.18,gain:.025,type:"sine",cooldown:180 },
  fuse: { frequencies: [900,1150,1300],duration:.3,gain:.06,noise:true,cooldown:250 },
  explosion: { frequencies: [100,55,32],duration:.65,gain:.17,noise:true,cooldown:300 },
  itemFind: {
    frequencies: [660, 880, 1320],
    duration: 0.28,
    gain: 0.065,
    type: "sine",
    cooldown: 160,
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
  if (options.context === "treasure" || mark === "coin") return;
  const cue = options.context === "well"
        ? "criticalHeal"
        : ["trap", "rockfall", "ruin"].includes(options.context)
          ? "criticalTrap"
          : {
              heal: "criticalHeal",
              blessing: "criticalHeal",
              magic: "criticalMagic",
              poison: "criticalPoison",
              block: "criticalBlock",
              ward: "criticalBlock",
              trap: "criticalTrap",
              stun: "criticalStun",
              flame: "criticalBuff",
              rally: "criticalBuff",
              trick: "jesterTrick",
              rage: "criticalBuff",
              bloodprice: "criticalBlood",
            }[mark] || "criticalBlade";
  GameSound.play(cue);
}
const shakeMotions = new WeakMap();
function shakeFrames(amount, style) {
  if (style === "explosion" || style === "critical") {
    const decay = style === "explosion" ? [0,1,-.85,.7,-.52,.35,-.22,.1,0] : [0,-.9,.65,-.4,.2,0];
    return decay.map((n,i)=>({transform:`translate(${n*amount*(i%2?.6:1)}px,${n*amount*(i%2?-1:.45)}px) rotate(${n*amount*.08}deg)`}));
  }
  if (style === "fuse") return [0,-.3,.4,-.6,.8,-1,0].map(n=>({transform:`translateX(${n*amount}px) scale(${1+Math.abs(n)*.025})`}));
  if (style === "healing") return [0,-.4,.2,0].map(n=>({transform:`translateY(${n*amount}px)`}));
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
