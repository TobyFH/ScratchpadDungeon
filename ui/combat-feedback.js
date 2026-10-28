function contributionType(symbol, owner) {
  if (symbol.type !== "class") return symbol.type;
  if (owner?.job === "mage")
    return owner.lastResonance || mageResonance(owner, owner.last);
  if (owner?.job === "berserker") return "attack";
  if (owner?.job === "fighter") return "block";
  if (owner?.job === "rogue") return "attack";
  if (owner?.job === "ranger") return "attack";
  return "class";
}
function contributes(symbol, wanted, owner) {
  const type = contributionType(symbol, owner);
  if(wanted === "heal")return ["heal","selfheal"].includes(type);
  return ["attack", "magic"].includes(wanted)
    ? ["attack", "magic"].includes(type)
    : type === wanted;
}
// Presentation uses its own FX randomness and never changes damage calculations.
const numberBursts = new WeakMap();
function effectSymbols(from, type, impact = {}) {
  const hero = state.party.findIndex((_, i) => from?.id === "portrait-" + i),
    enemy = battleEnemies().find((e) => enemyArtEl(e) === from),
    machine = impact.fromPortrait
      ? null
      : impact.machineId
        ? $("#machine-" + impact.machineId)
        : hero >= 0
          ? $("#machine-hero-" + hero)
          : enemy
            ? $("#machine-" + enemyMachine(enemy))
            : null,
    symbols =
      impact.symbols ||
      machine?.rolledSymbols ||
      (hero >= 0 ? state.party[hero].last : enemy?.last);
  const wanted = impact.sourceType || type,
    accepts = (s) =>
      contributes(s, wanted, hero >= 0 ? state.party[hero] : enemy);
  const matches = (symbols || [])
    .map((s, i) => ({
      symbol: s,
      origin: machine?.querySelector(`[data-reel="${impact.reelIndex ?? i}"] .slot-symbol`),
    }))
    .filter((v) => accepts(v.symbol));
  return matches.length
    ? matches
    : [
        {
          symbol: { type: wanted === "attack" ? "attack" : wanted, tier: 1 },
          origin: from,
        },
      ];
}
function launchRolledSymbols(from, to, type, impact = {}) {
  const run = state,
    destination = to.getBoundingClientRect(),
    end = {
      x: destination.left + destination.width / 2,
      y: destination.top + destination.height / 2,
    },
    reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  return Promise.all(
    effectSymbols(from, type, impact)
      .slice(0, 3)
      .map(({ symbol, origin }, i) => {
        const rect = (origin || from).getBoundingClientRect(),
          start = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
          },
          node = document.createElement("div");
        node.className =
          "rolled-projectile " +
          type +
          (impact.critical ? " critical-projectile" : "");
        node.innerHTML = symbolMarkup(symbol);
        node.dataset.target = to.id;
        node.dataset.symbol = symbol.type;
        if (impact.kind) node.dataset.effect = impact.kind;
        node.setAttribute("aria-hidden", "true");
        Object.assign(node.style, {
          left: start.x + "px",
          top: start.y + "px",
        });
        document.body.append(node);
        const dx = end.x - start.x,
          dy = end.y - start.y,
          arc = Math.min(100, Math.max(28, Math.abs(dx) * 0.18)),
          duration =
            reduced || skip ? 100 : Math.max(210, 520 / Math.sqrt(pace())),
          frames = [];
        for (let k = 0; k <= 12; k++) {
          const t = k / 12,
            e = t * t * (3 - 2 * t);
          frames.push({
            offset: t,
            transform: `translate(${dx * e}px,${dy * e - Math.sin(e * Math.PI) * arc}px) scale(${0.8 + Math.sin(t * Math.PI) * 0.35}) rotate(${(i % 2 ? 1 : -1) * t * 28}deg)`,
            opacity: k === 12 ? 0 : 1,
          });
        }
        const anim = node.animate(frames, {
          duration,
          delay: reduced || skip ? 0 : i * 35,
          easing: "linear",
          fill: "forwards",
        });
        anim.juice = true;
        liveAnimations.add(anim);
        if (utilityOpen) {
          anim.pause();
          anim.utilityPaused = true;
        }
        return anim.finished
          .then(() => {
            const liveTarget =
              document.getElementById(to.id || to.closest("[id]")?.id) || to;
            if (state !== run || !liveTarget.isConnected) {
              node.remove();
              return;
            }
            const splash = document.createElement("div");
            splash.className = "symbol-arrival " + type;
            splash.dataset.target = liveTarget.id;
            splash.innerHTML = symbolMarkup(symbol);
            splash.style.left = end.x + "px";
            splash.style.top = end.y + "px";
            document.body.append(splash);
            burst(
              liveTarget,
              type === "heal"
                ? "heal"
                : type === "block"
                  ? "shield"
                  : type === "poison"
                    ? "poison"
                    : "paper",
              impact.critical ? 26 : 12,
            );
            shakeElement(liveTarget, impact.critical ? 6 : 2);
            if (impact.critical) impactFlash(liveTarget, i);
            splash
              .animate(
                [
                  { transform: "translate(-50%,-50%) scale(.7)", opacity: 1 },
                  {
                    transform: "translate(-50%,-50%) scale(1.7)",
                    opacity: 1,
                    offset: 0.45,
                  },
                  { transform: "translate(-50%,-50%) scale(2.1)", opacity: 0 },
                ],
                { duration: reduced ? 100 : 320 },
              )
              .finished.finally(() => splash.remove());
            node.remove();
          })
          .catch(() => node.remove())
          .finally(() => liveAnimations.delete(anim));
      }),
  );
}
function beam(from, to, type, impact = {}) {
  if (!from || !to) return Promise.resolve();
  const mode = preferences().combatEffects,
    flights = [];
  if (mode !== "beams")
    flights.push(launchRolledSymbols(from, to, type, impact));
  if (mode !== "icons") flights.push(drawBeam(from, to, type, impact));
  const completed = Promise.all(flights);
  impact.flights?.push(completed);
  return completed;
}

function impactNumberParts(value, type) {
  if (!state.enemy || value < 2 || ["block", "poison"].includes(type))
    return [];
  const actor =
      actingEnemy ||
      (state.currentHero != null ? state.party[state.currentHero] : null),
    symbols = actor?.last || [],
    wanted = type === "heal" ? ["heal", "class"] : ["attack", "magic", "class"],
    weights = symbols
      .filter((s) =>
        s.type === "class"
          ? wanted.includes(contributionType(s, actor))
          : wanted.includes(s.type),
      )
      .map((s) =>
        s.type === "class"
          ? 2
          : type === "heal"
            ? POWER.heal * s.tier
            : ATTACK_POWER[s.tier] || 1,
      );
  if (weights.length < 2) return [];
  const total = weights.reduce((a, b) => a + b, 0),
    parts = [];
  let used = 0;
  weights.forEach((w, i) => {
    const n =
      i === weights.length - 1
        ? value - used
        : Math.min(value - used, Math.round((value * w) / total));
    if (n) {
      parts.push(n);
      used += n;
    }
  });
  return parts;
}
function combatNumber(el, value, type) {
  if (!el || (type === "heal" && !value)) return;
  const rect = el.getBoundingClientRect(),
    prior = numberBursts.get(el),
    now = performance.now(),
    sequence = prior && now - prior.at < 750 ? prior.n + 1 : 0;
  numberBursts.set(el, { at: now, n: sequence });
  const spawn = (amount, minor, index) => {
    const node = document.createElement("div");
    node.className =
      "combat-number " +
      (type === "heal"
        ? "healing"
        : type === "block"
          ? "blocked"
          : type === "poison"
            ? "poison damage"
            : "damage") +
      (minor ? " minor" : "");
    node.dataset.target = el.id;
    node.dataset.value = amount;
    node.dataset.summed = String(!minor);
    node.dataset.kind = type;
    node.textContent =
      type === "block"
        ? amount + " BLOCKED"
        : (type === "heal" ? "+" : "−") + amount;
    if (type === "poison") {
      const label = document.createElement("small");
      label.className = "poison-label";
      label.textContent = "POISON";
      node.append(label);
      node.setAttribute("aria-label", `${amount} poison damage`);
    }
    node.style.left =
      rect.left +
      rect.width / 2 +
      (minor
        ? (index - (impactNumberParts(value, type).length - 1) / 2) * 30
        : sequence % 2
          ? 24
          : -10) +
      "px";
    node.style.top =
      rect.top +
      rect.height * 0.3 +
      (minor ? 22 + index * 5 : -sequence * 12) +
      "px";
    node.style.setProperty(
      "--number-drift",
      (minor ? (index % 2 ? 22 : -22) : sequence % 2 ? 8 : -8) + "px",
    );
    node.style.animationDelay = minor ? index * 55 + "ms" : "0ms";
    document.body.append(node);
    setTimeout(() => node.remove(), minor ? 1750 : 1550);
  };
  spawn(value, false, 0);
  impactNumberParts(value, type).forEach((n, i) => spawn(n, true, i));
}

// Callouts name a real state change; they never capture input or move layout.
function combatCallout(el, text, kind = "gold") {
  if (!el) return;
  kind=feedbackKind(text,kind);
  const r = el.getBoundingClientRect(),
    node = document.createElement("div");
  node.className = "combat-callout " + kind;
  node.textContent = text;
  node.style.left =
    Math.max(12, Math.min(innerWidth - 12, r.left + r.width / 2)) + "px";
  node.style.top = Math.max(35, r.top + r.height * 0.2) + "px";
  document.body.append(node);
  const half = node.getBoundingClientRect().width / 2;
  node.style.left =
    Math.max(half + 8, Math.min(innerWidth - half - 8, r.left + r.width / 2)) +
    "px";
  const motion = {
    heal: [
      { opacity: 0, transform: "translate(-50%,12px) scale(.8)" },
      {
        opacity: 1,
        transform: "translate(-50%,-12px) scale(1.15)",
        offset: 0.25,
      },
      { opacity: 1, transform: "translate(-50%,-17px)", offset: 0.8 },
      { opacity: 0, transform: "translate(-50%,-35px)" },
    ],
    summon: [
      { opacity: 0, transform: "translate(-50%,0) rotate(-9deg) scale(.5)" },
      {
        opacity: 1,
        transform: "translate(-50%,0) rotate(4deg) scale(1.18)",
        offset: 0.25,
      },
      {
        opacity: 1,
        transform: "translate(-50%,-8px) rotate(-2deg)",
        offset: 0.8,
      },
      { opacity: 0, transform: "translate(-50%,-20px)" },
    ],
    fracture: [
      { opacity: 0, transform: "translate(-50%,0) scaleX(1.6) scaleY(.5)" },
      { opacity: 1, transform: "translate(-50%,0) rotate(5deg)", offset: 0.2 },
      {
        opacity: 1,
        transform: "translate(-50%,-8px) rotate(-4deg)",
        offset: 0.7,
      },
      { opacity: 0, transform: "translate(-50%,-28px) scale(1.25)" },
    ],
  };
  node
    .animate(
      matchMedia("(prefers-reduced-motion: reduce)").matches
        ? [
            { opacity: 1, transform: "translate(-50%,0)" },
            { opacity: 0, transform: "translate(-50%,0)" },
          ]
        : motion[kind] || [
            { opacity: 0, transform: "translate(-50%,10px) scale(.75)" },
            {
              opacity: 1,
              transform: "translate(-50%,0) scale(1.12)",
              offset: 0.17,
            },
            {
              opacity: 1,
              transform: "translate(-50%,-8px) scale(1)",
              offset: 0.7,
            },
            { opacity: 0, transform: "translate(-50%,-35px) scale(.98)" },
          ],
      { duration: skip ? 650 : 1100, easing: "ease-out" },
    )
    .finished.finally(() => node.remove());
}
async function classAbilityFX(h) {
  const el = entityArt(h),
    i = state.party.indexOf(h),
    machine = $("#machine-hero-" + i);
  const text =
    classAbilityName(h) +
    (h.job === "mage"
      ? " · " + MAGE_POWERS[mageResonance(h, h.last)].name.toUpperCase()
      : "");
  state.lastClassAbility = { heroId: h.id, name: text, at: Date.now() };
  GameSound.play("reward");
  screenFX(h.job === "berserker" ? "damage" : "critical", 1.1);
  combatCallout(el, text, "ability");
  [el, machine].filter(Boolean).forEach((node) => {
    burst(
      node,
      h.job === "mage" && mageResonance(h, h.last) === "heal" ? "heal" : "gold",
      34,
    );
    animate(
      node,
      [
        { filter: "brightness(1)", boxShadow: "0 0 0 0 var(--gold)" },
        {
          filter: "brightness(1.4)",
          boxShadow: "0 0 0 5px var(--gold)",
          offset: 0.35,
        },
        { filter: "brightness(1)", boxShadow: "0 0 0 15px transparent" },
      ],
      { duration: 550, juice: true },
    );
    shakeElement(node, 4);
  });
  await feedbackPause(skip ? 65 : Math.max(90, 220 / Math.sqrt(pace())));
}
function passiveFX(e, text, kind = "danger") {
  portraitMotion(enemyArtEl(e), "passive", true);
  combatCallout(enemyArtEl(e), text, kind);
  screenFX(kind === "heal" ? "heal" : "critical", 0.7);
  burst(enemyArtEl(e), kind === "heal" ? "heal" : "scary", 38);
  shakeElement(enemyArtEl(e), 5);
  GameSound.play("trait");
}
// One reserved number readout is used throughout the roll and the payoff.
function criticalFigures(details, multiplier) {
  let marks = details.filter((d) =>
    ["sword", "attack", "magic"].includes(d.icon),
  );
  if (!marks.length) marks = details.filter((d) => d.icon === "coin");
  if (!marks.length)
    marks = details
      .filter((d) => ["heal", "blessing"].includes(d.icon))
      .slice(0, 1);
  if (!marks.length)
    marks = [...details].sort((a, b) => b.value - a.value).slice(0, 1);
  return {
    original: marks.reduce((n, d) => n + d.value, 0),
    total: marks.reduce((n, d) => n + Math.ceil(d.value * multiplier), 0),
    label: marks.some((d) => d.icon === "coin")
      ? "GOLD"
      : marks.some((d) => ["heal", "blessing"].includes(d.icon))
        ? "HEALING"
        : marks.some((d) => ["sword", "attack", "magic"].includes(d.icon))
          ? "DAMAGE"
          : "POWER",
  };
}
function criticalPayoff(details, multiplier, { pending = false } = {}) {
  const { original, total, label } = criticalFigures(details, multiplier);
  return `<div class="critical-payoff" data-before="${original}" data-after="${total}" data-phase="${pending ? "rolling" : "locked"}" aria-label="${pending ? "Original" : "Critical"} ${label.toLowerCase()}: ${pending ? original : total}"><small>${pending ? "ORIGINAL" : "CRITICAL"} ${label}</small><strong>${pending ? original : total}</strong></div>`;
}
function revealCriticalPayoff(region, details, multiplier) {
  const { total, label } = criticalFigures(details, multiplier),
    payoff = region.querySelector(".critical-payoff");
  payoff.dataset.phase = "locked";
  payoff.setAttribute(
    "aria-label",
    `Critical ${label.toLowerCase()}: ${total}`,
  );
  payoff.querySelector("small").textContent = "CRITICAL " + label;
  const number = payoff.querySelector("strong");
  number.textContent = total;
  animate(
    number,
    [
      { transform: "scale(.82)", filter: "brightness(1)" },
      { transform: "scale(1.22)", filter: "brightness(1.5)", offset: 0.4 },
      { transform: "scale(1)", filter: "brightness(1)" },
    ],
    { duration: 520, juice: true },
  );
  burst(number, label === "HEALING" ? "heal" : "gold", 55);
}
