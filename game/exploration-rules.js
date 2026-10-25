// Ambush readiness follows accepted destinations, never wall-clock time. A long
// route is one command; a valid redirected destination is another command.
const AMBUSH_COMMAND_AGE = 12;
function registerMoveCommand() {
  state.moveCommands = (state.moveCommands || 0) + 1;
  refreshStaleMap();
}
function normaliseExplorationRules({ migration = false } = {}) {
  state.moveCommands = Number.isSafeInteger(state.moveCommands)
    ? Math.max(0, state.moveCommands)
    : 0;
  for (const c of state.map) {
    if (migration) {
      c.fogged = false;
      delete c.fogSince;
    }
    if (!Number.isSafeInteger(c.lastNearCommand))
      c.lastNearCommand = state.moveCommands;
    if (!c.seen || c.wall) c.fogged = false;
  }
  // Legacy bridge discoveries move to a reachable free floor, leaving terrain
  // and its crossing intact. Stair distance and all discovery data are retained.
  const distances = mapDistances(state.map);
  state.map.forEach((c, i) => {
    if (c.terrain !== "bridge") return;
    if (c.event) {
      const free = [...distances.keys()]
        .filter(
          (j) =>
            j !== state.position &&
            j !== pos(1, 7) &&
            state.map[j].terrain === "floor" &&
            !state.map[j].event &&
            !state.map[j].feature &&
            !state.map[j].structure &&
            (c.event !== "stairs" || distances.get(j) >= 8),
        )
        .sort((a, b) => tileDistance(a, i) - tileDistance(b, i));
      if (free.length) {
        const target = state.map[free[0]];
        for (const key of [
          "event",
          "feature",
          "activated",
          "bossDefeated",
          "shop",
          "tunnelTo",
          "tunnelPair",
        ])
          if (c[key] !== undefined) target[key] = c[key];
        target.seen ||= c.seen;
      } else if (c.event === "stairs") {
        c.terrain = "floor";
        return;
      }
    }
    c.event = null;
    c.feature = null;
    delete c.activated;
    delete c.shop;
    delete c.tunnelTo;
    delete c.tunnelPair;
  });
}
function updateLavaGlow() {
  if (!state) return;
  let strength = 0;
  if (preferences().ambientEffects)
    for (let i = 0; i < state.map.length; i++) {
      const c = state.map[i],
        distance = tileDistance(i);
      if (
        c.seen &&
        c.terrain === "lava" &&
        distance <= 2 &&
        lineOfSight(state.position, i)
      )
        strength = Math.max(strength, distance <= 1 ? 0.25 : 0.1);
    }
  let layer = $("#lava-lighting");
  if (!layer) {
    layer = document.createElement("div");
    layer.id = "lava-lighting";
    layer.setAttribute("aria-hidden", "true");
    document.body.append(layer);
  }
  layer.style.setProperty("--lava-strength", strength);
  layer.dataset.nearby = String(strength > 0);
}
async function tunnelTransit(source, destination) {
  const from = $(`[data-tile="${source}"]`)?.getBoundingClientRect(),
    to = $(`[data-tile="${destination}"]`)?.getBoundingClientRect();
  if (!from || !to) return;
  const x1 = from.left + from.width / 2,
    y1 = from.top + from.height / 2,
    x2 = to.left + to.width / 2,
    y2 = to.top + to.height / 2;
  const layer = document.createElement("div");
  layer.className = "tunnel-transit";
  layer.innerHTML = `<svg width="${innerWidth}" height="${innerHeight}" viewBox="0 0 ${innerWidth} ${innerHeight}"><path d="M${x1} ${y1} Q${(x1 + x2) / 2} ${Math.min(y1, y2) - 65} ${x2} ${y2}"/></svg><span>${icon("tunnel")}</span>`;
  document.body.append(layer);
  const path = layer.querySelector("path"),
    length = path.getTotalLength(),
    token = layer.querySelector("span");
  path.style.strokeDasharray = length;
  path.style.strokeDashoffset = length;
  const reduced =
      skip || matchMedia("(prefers-reduced-motion: reduce)").matches,
    duration = reduced ? 160 : Math.max(240, 700 / Math.sqrt(pace()));
  const motion = token.animate(
    Array.from({ length: 17 }, (_, n) => {
      const p = path.getPointAtLength((length * n) / 16);
      return {
        transform: `translate(${p.x}px,${p.y}px) translate(-50%,-50%) scale(${0.7 + Math.sin((n / 16) * Math.PI) * 0.35})`,
        opacity: n === 16 ? 0 : 1,
      };
    }),
    { duration, easing: "ease-in-out", fill: "forwards" },
  );
  const ink = path.animate(
    [
      { strokeDashoffset: length, opacity: 0 },
      { strokeDashoffset: 0, opacity: 0.8, offset: 0.8 },
      { strokeDashoffset: 0, opacity: 0 },
    ],
    { duration, fill: "forwards" },
  );
  for (const a of [motion, ink]) {
    a.juice = true;
    liveAnimations.add(a);
    a.finished.catch(() => {}).finally(() => liveAnimations.delete(a));
  }
  GameSound.play("tunnel");
  await feedbackPause(duration);
  motion.cancel();
  ink.cancel();
  layer.remove();
}
const STARTER_SUMMARIES = Object.freeze({
  fighter: "Physical hits, shields and stun. Shield Bash strikes with your team’s block.",
  rogue: "Quick blades, poison and tricks. Flurry throws three attacks.",
  mage: "Shape magic, healing, wards and poison. Resonance echoes your marks.",
  ranger: "Build patience, then Execute a wounded enemy.",
  berserker: "Wounds build Fury. Bloodrush and lifesteal keep you fighting.",
  jester: "Trick builds anticipation. Punchline boosts a free roll.",
});
const DESCENT_LINES = Object.freeze([
  "Cool air climbs the steps. Somewhere below, another torch is burning.",
  "The whispering shelves give way to damp stone and distant water.",
  "Old bones lie between the steps. Keep the light ahead of you.",
  "Iron doors creak far below. The company gathers at the stairhead.",
  "Heat drifts upward through the stone. The next page is warm to the touch.",
  "The echoes deepen. One careful step follows another.",
  "Water beads on the rail. A red glow waits beneath the arch.",
  "Ash settles on the steps. There are fewer pages left to turn.",
  "The final stair descends into a silence too complete to trust.",
  "The last guardian is gone. Your story has reached its final page.",
]);
function wellResultsMarkup(before = null, after = null, multiplier = 1) {
  const heroes = state.party.filter(alive);
  return (
    Array.from({ length: 3 }, (_, i) => {
      const h = heroes[i];
      if (!h)
        return '<div class="well-heal-total well-empty" aria-hidden="true"></div>';
      return `<div class="well-heal-total" ${after ? `data-before="${before[i].value}" data-after="${offeredHealing(h, after[i].value)}"` : ""}><span>${escapeHTML(h.name)}</span><strong>${after ? offeredHealing(h, after[i].value) + " HP" : "…"}</strong>${after ? `<small>${multiplier > 1 ? "×" + multiplier : ""}${offeredHealing(h, after[i].value) > after[i].value ? " · +" + (offeredHealing(h, after[i].value) - after[i].value) : ""}</small>` : "<small></small>"}</div>`;
    }).join("") +
    '<small class="well-total-note">Healing offered; recovery stops at full health.</small>'
  );
}
