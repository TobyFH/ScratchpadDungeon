// Cosmetic choreography only. Never consume gameplay RNG or apply damage here.
function artefactSummary(a) {
  return (
    {
      attack: `+${a.power} physical/spell damage`,
      heal: `+${a.power} rolled healing`,
      block: `+${a.power} block once per shield roll`,
      gold: `+${a.power}% loot gold`,
      guard: `${a.power} opening team block`,
      revive: "Revive once at 75% HP",
    }[a.key] || artefactText(a)
  );
}
function statusAtmosphereMarkup(entity) {
  if (!alive(entity)) return "";
  return `${entity.poison?.turns ? '<span class="status-motes poison-motes" aria-hidden="true"><i></i><i></i><i></i></span>' : ""}${entity.stimulant ? '<span class="status-motes stimulant-motes" aria-hidden="true"><i></i><i></i><i></i></span>' : ""}`;
}
function updatePortraitLife(p = preferences()) {
  document.body.style.setProperty("--portrait-life", p.portraitMotion);
  document.body.classList.toggle(
    "portrait-motion-disabled",
    p.portraitMotion <= 0,
  );
}
function enemyIdleStyle(e) {
  if (["ghost", "moth", "oracle", "lich", "veilweaver"].includes(e.art))
    return "float";
  if (["rat", "rustmite", "shalecrab", "frostmite", "widow"].includes(e.art))
    return "skitter";
  if (["abomination", "pageeater", "ashcolossus", "thornhulk"].includes(e.art))
    return "heavy";
  return "sway";
}
async function enemyWindup(e, kind = "heavy") {
  if (!alive(e)) return;
  portraitMotion(enemyArtEl(e), kind, true);
  if (
    !skip &&
    !sceneFast &&
    preferences().portraitMotion > 0 &&
    !matchMedia("(prefers-reduced-motion: reduce)").matches
  )
    await pause(190);
}
async function executionPayoffFX(h, e, shot) {
  if (!shot?.bonus) return;
  await classSignatureFX(h,e,"execute");
  const strong = shot.seal && shot.charge >= RANGER_AIM_CAP;
  portraitMotion(entityArt(h), strong ? "heavy" : "attack");
  combatCallout(
    entityArt(h),
    strong ? "FULL DRAW · EXECUTE!" : "EXECUTE!",
    "gold",
  );
  GameSound.play(strong ? "executeFull" : "execute");
  burst(entityArt(h), "gold", strong ? 45 : 16);
  screenFX("critical", strong ? 0.8 : 0.25);
  if (strong) shakeBook(4, "recoil");
  if (!skip && !sceneFast) await pause(strong ? 190 : 80);
}
const JACK_BOX_ART = `<path d="M-22 6 L-26-18 -10-30 7-23 26-32 21-5" fill="var(--gold)"/><path d="M-23-17 Q0-29 23-15 M-26-18 L-34-26 M26-32 L34-25"/><circle cx="-35" cy="-27" r="4"/><circle cx="35" cy="-25" r="4"/><path d="M-23-9 Q-32 19-14 31 Q3 45 23 24 Q34 6 21-8Z" fill="var(--paper)"/><path d="M-15 6 L-8 2 M9 2 L16 6 M-14 18 Q0 36 16 17Z" fill="var(--paper-shade)"/><circle cx="1" cy="12" r="5" fill="var(--red)"/><path d="M-11 22 L-11 27 M-2 24 L-2 31 M7 24 L7 30"/>`;
async function jackInTheBoxFX(h, e) {
  const machine = $("#machine-hero-" + state.party.indexOf(h)),
    target = enemyArtEl(e);
  if (!machine || !target) return;
  GameSound.play("jackBox");
  combatCallout(entityArt(h), "POP GOES THE PUNCHLINE!", "gold");
  burst(machine, "jester", 60);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (skip || sceneFast || reduced || preferences().portraitMotion <= 0) {
    burst(target, "jester", 45);
    shakeElement(machine, 3, "rumble");
    shakeElement(target, 4, "jolt");
    return;
  }
  const run = state,
    version = animationVersion,
    origin = machine.querySelector('[data-reel="1"]') || machine;
  const from = origin.getBoundingClientRect(),
    to = target.getBoundingClientRect();
  const sx = from.left + from.width / 2,
    sy = from.top + from.height * 0.65,
    tx = to.left + to.width / 2,
    ty = to.top + to.height * 0.45;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add("jack-in-the-box");
  svg.setAttribute("viewBox", `0 0 ${innerWidth} ${innerHeight}`);
  svg.setAttribute("aria-hidden", "true");
  svg.dataset.hero = h.id;
  svg.dataset.target = e.id;
  svg.innerHTML = `<path class="jack-spring echo"/><path class="jack-spring"/><g class="jack-box" transform="translate(${sx} ${sy})"><path d="M-25 7 L24 4 28 34-26 37Z" fill="var(--paper)"/><path d="M-24 8 L-31-8 21-13 24 4 M-15 12 L15 31 M16 12 L-15 32"/><circle cx="0" cy="22" r="8" fill="var(--gold)"/></g><g class="jack-head">${JACK_BOX_ART}</g>`;
  document.body.append(svg);
  const head = svg.querySelector(".jack-head"),
    springs = svg.querySelectorAll(".jack-spring");
  const strength = Math.min(1.5, preferences().portraitMotion),
    duration = 950 / Math.sqrt(pace());
  let last = performance.now(),
    elapsed = 0;
  try {
    await new Promise((resolve) => {
      const frame = (now) => {
        if (
          state !== run ||
          version !== animationVersion ||
          skip ||
          sceneFast || preferences().portraitMotion<=0
        ) {
          resolve();
          return;
        }
        if (!utilityOpen && !document.hidden)
          elapsed += Math.min(100, now - last);
        last = now;
        const p = Math.min(1, elapsed / duration),
          stretch = Math.min(1, p / 0.72),
          ease = 1 - Math.pow(1 - stretch, 3);
        const bounce =
          p > 0.72
            ? Math.sin(((p - 0.72) / 0.28) * Math.PI * 2) * 9 * (1 - p)
            : 0;
        const x = sx + (tx - sx) * ease,
          y =
            sy +
            (ty - sy) * ease -
            Math.sin(stretch * Math.PI) * 65 * strength +
            bounce;
        const dx = x - sx,
          dy = y - sy,
          len = Math.max(1, Math.hypot(dx, dy)),
          nx = -dy / len,
          ny = dx / len;
        const points = [];
        for (let k = 0; k <= 22; k++) {
          const t = k / 22,
            offset =
              k === 0 || k === 22
                ? 0
                : (k % 2 ? -1 : 1) * 8 * strength * Math.sin((p * Math.PI) / 2);
          points.push(
            `${sx + dx * t + nx * offset},${sy + dy * t + ny * offset}`,
          );
        }
        springs.forEach((n) => n.setAttribute("d", "M" + points.join(" L")));
        head.setAttribute(
          "transform",
          `translate(${x} ${y}) rotate(${Math.sin(p * 15) * 8 * strength}) scale(${(0.35 + 0.95 * ease) * Math.min(1, (innerWidth - 30) / 400)})`,
        );
        svg.dataset.progress = p.toFixed(2);
        if (p < 1) requestAnimationFrame(frame);
        else resolve();
      };
      requestAnimationFrame(frame);
    });
    if (state === run) {
      burst(target, "jester", 70);
      impactFlash(target);
      shakeElement(target, 6, "jolt");
      shakeBook(3, "critical");
    }
  } finally {
    svg.remove();
  }
}
