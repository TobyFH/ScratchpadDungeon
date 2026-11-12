// Original pencil silhouettes. No gameplay state mutation or randomness.
function summonPortraitArt(s) {
  if (s.summonKind === "zombie") {
    const art =
      s.hp <= 0
        ? corpseArt(s.job)
        : basePortraitArt(s.job, { ...s, summonKind: null });
    return art
      .replace(/<svg\b/, '<svg data-summon-art="zombie"')
      .replace(
        "</svg>",
        '<g fill="none" stroke="var(--poison-ink,#8253a1)" stroke-width="2"><path d="m40 48 14 7m-12-8-3 5m9-2-3 5m23 10 8-2m-5-3 1 7M44 120l18 5m-12-8-2 11m10-9-1 10"/></g></svg>',
      );
  }
  const skull =
    '<path d="M43 33q-5-24 17-25 26 1 18 27L70 47H51Z"/><path d="m47 25 9 3-2 7h-7m18-8 9-3-1 10-8 2m-5 0-4 5h8m-12 1v8m7-8v9m7-10v8" fill="none"/>';
  const drawings = {
    blade: `<path d="M25 138 33 85 46 58l14 6 18-12 11 38 9 45-24 6-15-24-12 27Z" fill="var(--paper-shade)"/>${skull}<path d="m48 53 12 13 13-15M60 69l-5 37m-11-29 32-3m-35 12 35-2m-37 13 35-3m-37 16 9 22m25-24 8 24M34 78 20 96m62-21 18 18"/><path d="m18 96-8-32-5-9-2 14 11 29m84-7 14-27 6-8-2 17-13 24m-92 4 15-5m65 0 16 6" fill="var(--paper)"/>`,
    guard: `<path d="M31 142 38 73l-9-20 20-13h25l18 18-8 20 10 64Z" fill="var(--paper-shade)"/>${skull}<path d="M37 22 43 6h37l7 17-20-7-29 6m7 29 30-3M46 75l28-1m-28 9 28-1m-17-13 2 39m-14 18-8 17m37-21 12 22"/><path d="M29 63 64 75l-5 42-25 24-22-27 1-43Z" fill="var(--paper)"/><path d="m20 77 12-6 23 9-4 31-16 17-15-19Zm14 0v45m-12-26 29 1"/><path d="m90 87 14-49 4-5 3 10-16 46m-9-4 14 6"/>`,
    wisp: `<path d="M18 139q25-19 10-42-9-18 9-35-6-25 12-44 25-23 39 5 14 19-1 39 24 22 2 42-13 18 10 31l-26-5-13 16-12-14Z" fill="var(--paper-shade)"/><path d="M43 43q5-26 24-22 22 8 11 30L64 71 46 61Z"/><path d="m46 46 11-4-1 12-9-1m18-9 11-3-4 14-8 4m-6 8 7-1M43 79l15 18-7 19m22-38-8 20 12 14M21 86 8 79m81 10 18-7m-74 30-8 11m66-14 11 9" fill="none"/><path d="m11 66 7-16 10 13-9 17ZM94 45l6-15 11 13-9 16Z" fill="var(--poison-ink,#8253a1)"/>`,
    cantor: `<path d="M21 145 29 86 41 61q-13-40 17-54 35 9 25 54l12 29 6 56Z" fill="var(--paper-shade)"/>${skull}<path d="M35 47q-4-30 23-36 27 7 27 33M40 53l20 16 20-16m-21 18 1 68m-29-42 14 14m45-14-14 14"/><path d="M26 88q18-8 32 3 17-13 35-6l-2 40q-19-7-33 5-14-9-33-4Z" fill="var(--paper)"/><path d="m58 94 1 31M34 100l15 3m-15 8 14 2m21-15 15-2m-15 13 14-3"/><path d="M100 137V40m-10-5 10-12 10 12v16H90Zm7 17 3 7 3-7"/>`,
    bomber: `<path d="M26 131q-17-15-9-48l18-18 14 5 17-7 26 16q22 38-4 57Z" fill="var(--paper-shade)"/>${skull}<path d="m36 56 10 22m31-22-6 22M29 79q34 15 63-1m-68 15q33 15 74-1m-76 17q36 15 75-2m-65-24 3 44m17-40 1 45m20-45-2 43m-34 5-8 13m45-14 12 12"/><path d="M45 105q-4-17 13-20 18 2 17 19-2 17-15 18-14-2-15-17Zm8-21 2-7h13l-2 8" fill="var(--paper)"/><path d="m62 77 4-14-6-8 10-8m-1-5 2-7m3 10 8-4m-16 2-5-6" fill="none" stroke="var(--gold)"/><path d="m12 77 9 6m73-10 12-6m-8 30 12 2"/>`,
  };
  let body = drawings[s.summonKind] || drawings.blade;
  if (s.hp <= 0 || s.dead)
    body = `<g transform="translate(-16 58) rotate(-68 60 90) scale(.8)">${body}</g><path d="M9 141 32 138l17 4 18-3 31 3" fill="none"/>`;
  else if (s.hp / s.maxHp < 0.35)
    body +=
      '<path d="m38 47 12 7m25 1 9-8m-38 65 9 6" stroke="var(--red)" fill="none"/>';
  return `<svg class="pencil-art summon-art" data-summon-art="${s.summonKind}" viewBox="0 0 120 150" fill="var(--paper)" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}
function summonSpeech(s, mood) {
  const banks = {
    attack: ["Rrraaah!", "Krrk!", "Hissss!"],
    hurt: ["Khh!", "Rrrgh!", "Crack!"],
    panic: ["K-k-k!", "Hssss!"],
    relief: ["Hhh…", "Rattle…"],
    block: ["Clack!", "Krrk!"],
    idle: ["Rattle…", "Hhh…", "Click…"],
  };
  return s.summonKind === "wisp"
    ? mood === "attack"
      ? ["Fsssh!", "Sssaaah!"]
      : ["Wooo…", "Hiss…"]
    : banks[mood] || banks.idle;
}
