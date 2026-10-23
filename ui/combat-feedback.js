function contributionType(symbol, owner) {
  if (symbol.type !== "class") return symbol.type;
  if (owner?.job === "mage") return mageRole(owner);
  if (owner?.job === "fighter") return "rage";
  if (owner?.job === "rogue") return "attack";
  if (owner?.job === "ranger")
    return state.lastExecution?.heroId === owner.id &&
      state.lastExecution.bonus > 0
      ? "attack"
      : "patience";
  return "class";
}
function contributes(symbol, wanted, owner) {
  const type = contributionType(symbol, owner);
  return ["attack", "magic"].includes(wanted)
    ? ["attack", "magic"].includes(type)
    : type === wanted;
}
// Presentation uses its own FX randomness and never changes damage calculations.
const numberBursts = new WeakMap();
function effectSymbols(from, type, impact = {}) {
  const hero = state.party.findIndex((_, i) => from?.id === "portrait-" + i),
    enemy = battleEnemies().find((e) => enemyArtEl(e) === from),
    machine = impact.machineId
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
      origin: machine?.querySelector(`[data-reel="${i}"] .slot-symbol`),
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
  effectSymbols(from, type, impact)
    .slice(0, 3)
    .forEach(({ symbol, origin }, i) => {
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
      node.setAttribute("aria-hidden", "true");
      Object.assign(node.style, { left: start.x + "px", top: start.y + "px" });
      document.body.append(node);
      const dx = end.x - start.x,
        dy = end.y - start.y,
        arc = Math.min(100, Math.max(28, Math.abs(dx) * 0.18)),
        duration =
          reduced || skip ? 90 : Math.max(170, 420 / Math.sqrt(pace())),
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
      anim.finished
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
        .catch(() => node.remove());
    });
}
function beam(from, to, type, impact = {}) {
  if (!from || !to) return;
  const mode = preferences().combatEffects;
  if (mode !== "beams") launchRolledSymbols(from, to, type, impact);
  if (mode !== "icons") drawBeam(from, to, type, impact);
}
function impactNumberParts(value, type) {
  if (!state.enemy || value < 2 || type === "block") return [];
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
      (type === "heal" ? "healing" : type === "block" ? "blocked" : "damage") +
      (minor ? " minor" : "");
    node.dataset.target = el.id;
    node.dataset.value = amount;
    node.dataset.summed = String(!minor);
    node.textContent =
      type === "block"
        ? amount + " BLOCKED"
        : (type === "heal" ? "+" : "−") + amount;
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
