// Ephemeral presentation only. Offsets use FX randomness, never gameplay RNG.
let bloodFeedback = [];
function trackBloodFeedback(p) {
  if (!p?.then) return;
  const entry = { run: state, promise: p };
  bloodFeedback.push(entry);
  p.catch(() => {}).finally(() => {
    bloodFeedback = bloodFeedback.filter((x) => x !== entry);
  });
}
async function settleBloodFeedback() {
  const run = state,
    entries = bloodFeedback.filter((x) => x.run === run);
  bloodFeedback = bloodFeedback.filter((x) => x.run !== run);
  await Promise.allSettled(entries.map((x) => x.promise));
}
function bloodSeedBurstFX(e, count, detonation = false) {
  const host = enemyArtEl(e);
  if (!host?.isConnected) return Promise.resolve();
  const rect = host.getBoundingClientRect(),
    bursts = Math.min(18, count),
    run = state;
  const reduced =
    skip || matchMedia("(prefers-reduced-motion: reduce)").matches;
  const flights = [];
  for (let i = 0; i < bursts; i++) {
    const node = document.createElement("span");
    node.className = "blood-seed-pop";
    node.setAttribute("aria-hidden", "true");
    node.dataset.effect = "blood-seed-burst";
    node.innerHTML =
      icon("bloodseed") +
      (count > bursts ? `<small>×${Math.ceil(count / bursts)}</small>` : "");
    node.style.left =
      rect.left + rect.width * (0.18 + fxRandom() * 0.64) + "px";
    node.style.top = rect.top + rect.height * (0.18 + fxRandom() * 0.64) + "px";
    document.body.append(node);
    const anim = node.animate(
      [
        { transform: "translate(-50%,-50%) scale(.45)", opacity: 0 },
        {
          transform: "translate(-50%,-50%) scale(1.5)",
          opacity: 1,
          offset: 0.32,
        },
        {
          transform: `translate(${(fxRandom() - 0.5) * 48 - 50}%,${-95 - fxRandom() * 45}%) scale(2.1)`,
          opacity: 0,
        },
      ],
      {
        duration: reduced ? 100 : Math.max(160, 430 / Math.sqrt(pace())),
        delay: reduced ? 0 : (i * 13) / Math.sqrt(pace()),
        easing: "ease-out",
        fill: "forwards",
      },
    );
    anim.juice = true;
    liveAnimations.add(anim);
    if (utilityOpen) {
      anim.pause();
      anim.utilityPaused = true;
    }
    flights.push(
      anim.finished
        .catch(() => {})
        .finally(() => {
          node.remove();
          liveAnimations.delete(anim);
        }),
    );
  }
  burst(host, detonation ? "confetti" : "paper", Math.min(42, 12 + count));
  shakeElement(host, detonation ? 6 : 2, detonation ? "critical" : "jolt");
  return Promise.allSettled(flights).then(() => {
    if (state !== run) return;
  });
}
function skeletonArtEl(s) {
  return document.getElementById("summon-art-" + s.id);
}
function soulMeterMarkup(h) {
  if (h.job !== "necromancer") return "";
  return `<div class="soul-meter" data-soul-owner="${h.id}" role="meter" aria-label="Souls" aria-valuemin="0" aria-valuemax="${soulCapacity(h)}" aria-valuenow="${Math.floor(h.souls || 0)}" data-tooltip="Damage and Harvest gather Souls. A full bar raises a Skeleton in an empty companion position. With two Skeletons, it restores 10% maximum HP to the whole team instead. Souls and Skeleton HP survive battles."><b>SOULS ${Math.floor(h.souls || 0)}/${soulCapacity(h)}</b><span><i style="width:${(100 * (h.souls || 0)) / soulCapacity(h)}%"></i></span></div>`;
}
function skeletonSlotsMarkup(h) {
  return [0, 1]
    .map((i) => {
      const s = h.skeletons[i];
      if (!s)
        return `<div class="empty-slot" data-skeleton-slot="${i}">${icon("skull")}<span>A Skeleton can rise here.</span><small>Fill the Soul bar to summon.</small></div>`;
      return `<article class="hero skeleton-card ${injury(s)}" data-skeleton-slot="${i}" aria-label="Skeleton · automatically controlled"><div class="hero-dossier"><div class="portrait" id="summon-art-${s.id}" tabindex="0" data-tooltip="Skeleton: ${s.hp}/${s.maxHp} HP. Attacks for ${skeletonAttack(h)} physical damage after each Necromancer action. Can intercept the first single-target attack each enemy turn. Cannot use reels, equipment or ordinary healing.">${portraitArt("skull", s)}</div><div class="hero-name">Skeleton<small>Summon · Automatic</small></div></div><div class="hero-controls"><div class="hero-title-line"><span class="hp-info">HP ${s.hp} / ${s.maxHp}</span><span class="injury">${injury(s)}</span></div>${healthMarkup(s)}<div class="skeleton-duty">${icon("sword")}<b>${skeletonAttack(h)} physical damage</b></div><small>Attacks your target after each roll.<br>Guards the first eligible enemy attack.</small></div></article>`;
    })
    .join("");
}
function syncNecromancer(h) {
  if (h?.job !== "necromancer") return;
  const meter = document.querySelector(`[data-soul-owner="${h.id}"]`);
  if (meter) {
    const t = document.createElement("template");
    t.innerHTML = soulMeterMarkup(h);
    meter.replaceWith(t.content);
  }
  const slots = [...document.querySelectorAll("#party > [data-skeleton-slot]")];
  if (slots.length) {
    const t = document.createElement("template");
    t.innerHTML = skeletonSlotsMarkup(h);
    for (const n of slots) n.remove();
    $("#party").append(t.content);
  }
}
function summonMomentFX(h, s, kind) {
  const host = skeletonArtEl(s) || entityArt(h);
  if (!host?.isConnected) return;
  const rect = host.getBoundingClientRect(),
    node = document.createElement("div");
  node.className = "summon-bone-flash";
  node.dataset.effect = "skeleton-" + kind;
  node.setAttribute("aria-hidden", "true");
  node.innerHTML =
    kind === "death"
      ? skeletonBonesArt()
      : kind === "heal"
        ? icon("heal")
        : kind === "rise"
          ? skeletonRiseArt()
          : icon("skull");
  node.style.left = rect.left + rect.width / 2 - 40 + "px";
  node.style.top = rect.top + rect.height / 2 - 45 + "px";
  document.body.append(node);
  const reduced =
    skip || matchMedia("(prefers-reduced-motion: reduce)").matches;
  const anim = node.animate(
    [
      {
        transform: kind === "rise" ? "translateY(26px) scale(.4)" : "scale(.8)",
        opacity: 0,
      },
      { transform: "translateY(-8px) scale(1.35)", opacity: 1, offset: 0.35 },
      {
        transform:
          kind === "death" ? "translateY(24px) scale(.6)" : "scale(1.5)",
        opacity: 0,
      },
    ],
    { duration: reduced ? 120 : 480 / Math.sqrt(pace()), fill: "forwards" },
  );
  anim.juice = true;
  liveAnimations.add(anim);
  if (utilityOpen) {
    anim.pause();
    anim.utilityPaused = true;
  }
  trackBloodFeedback(
    anim.finished
      .catch(() => {})
      .finally(() => {
        node.remove();
        liveAnimations.delete(anim);
      }),
  );
  burst(
    host,
    kind === "heal" ? "heal" : kind === "death" ? "dust" : "poison",
    20,
  );
  shakeElement(host, kind === "guard" ? 5 : 2);
  GameSound.play(
    kind === "rise" ? "poof" : kind === "death" ? "hit" : "shield",
  );
}

function skeletonRiseArt() {
  return `<svg viewBox="0 0 120 140" class="pencil-art" fill="var(--paper)" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 126 23 119l12 8 18-7 14 7 18-10 22 8" fill="none"/><path d="m42 122-7-38-10-15q-5-8 1-10l14 14-4-34q0-8 6-7l9 37-1-42q1-9 7-5l5 44 5-36q1-7 7-3l-1 45 14-16q9-7 11 0L82 89l-9 33Z"/><path d="m47 87 22-3m-20 14 19-3m-17 12 15-3M39 74l8 4m7-9 8 1m2-1 10 3" fill="none"/><path d="m14 102-8-8m91 12 12-9M17 43l-7-5m88-5 11-6" fill="none"/></svg>`;
}
function skeletonBonesArt() {
  return `<svg viewBox="0 0 120 100" class="pencil-art" fill="var(--paper)" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m18 76 66-27m-60 3 68 31m-56 1 51-10M11 72q-7-12 3-10 1-9 8-4m58-13q8-10 11-1 9-2 8 7M21 48q-9-5-9 4-8 5 1 10m76 17q10-8 12 1 7 2 3 8" fill="none"/><path d="M40 41q-10-32 17-34 29 2 18 33l-9 7-2 11H49l-1-12Z"/><path d="m46 23 9 9m0-9-9 9m17-9 8 8m0-8-8 8m-8 7 3-5 3 5m-8 10v10m7-10v10" fill="none"/></svg>`;
}
