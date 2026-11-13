// Ephemeral layout bookkeeping. No game state, timers, animation or RNG changes.
const notebookLayout = (() => {
  const desk = document.querySelector(".desk");
  const bar = document.getElementById("keyboard-bar");
  let dirty = true,
    viewport = "",
    scale = null,
    heldViewport = null;
  function hold() {
    heldViewport = `${innerWidth}:${innerHeight}`;
  }
  function release() {
    if (heldViewport !== null) {
      heldViewport = null;
      invalidate();
      requestFitUI();
    }
  }
  function invalidate() {
    dirty = true;
  }
  function needsFit(force, fitted) {
    // Choosing a replacement run changes keyboard prompts, not the expedition
    // underneath. Real resizing and explicit forced fits remain available.
    if (
      !force &&
      heldViewport === `${innerWidth}:${innerHeight}` &&
      desk.classList.contains("fit-notebook") === fitted
    )
      return false;
    return (
      force ||
      dirty ||
      viewport !== `${innerWidth}:${innerHeight}` ||
      desk.classList.contains("fit-notebook") !== fitted ||
      desk.style.getPropertyValue("--desk-scale") !== scale
    );
  }
  function fitted() {
    dirty = false;
    viewport = `${innerWidth}:${innerHeight}`;
    scale = desk.style.getPropertyValue("--desk-scale");
  }
  function syncBarHeight() {
    const height = bar.offsetHeight + "px";
    if (
      document.documentElement.style.getPropertyValue(
        "--keyboard-bar-height",
      ) !== height
    ) {
      document.documentElement.style.setProperty(
        "--keyboard-bar-height",
        height,
      );
      invalidate();
    }
  }
  let barContent = null,
    barEvent = null;
  function writeBar(next, event = false) {
    if (typeof next === "string") {
      if (bar.innerHTML === next) return;
      bar.innerHTML = next;
      barContent = null;
      invalidate();
      syncBarHeight();
      return;
    }
    const toggle = navigationBarToggle();
    next = { field: next.field + toggle, event: next.event + toggle };
    const signature = next.field + "\n" + next.event;
    if (barContent === signature && barEvent === event) return;
    barEvent = event;
    if (barContent !== signature) {
      bar.innerHTML = `<div class="keyboard-context" data-context="field">${next.field}</div><div class="keyboard-context" data-context="event">${next.event}</div>`;
      barContent = signature;
      invalidate();
    }
    for (const node of bar.children) {
      const inactive = node.dataset.context !== (event ? "event" : "field");
      if (node.inert !== inactive) node.inert = inactive;
      node.setAttribute("aria-hidden", String(inactive));
    }
    syncBarHeight();
  }
  // Observer sizes are layout sizes, before the desk's CSS zoom. A changed zoom
  // doesn't start a feedback loop; genuine content/font/viewport changes refit.
  const dimensions = new WeakMap();
  const observer = new ResizeObserver((entries) => {
    let changed = false;
    for (const entry of entries) {
      const size = entry.borderBoxSize?.[0];
      const next = `${size?.inlineSize ?? entry.contentRect.width}:${size?.blockSize ?? entry.contentRect.height}`;
      if (dimensions.get(entry.target) === next) continue;
      dimensions.set(entry.target, next);
      changed = true;
      if (entry.target === bar) syncBarHeight();
    }
    if (changed) {
      invalidate();
      requestFitUI();
    }
  });
  observer.observe(desk);
  observer.observe(bar);
  document.fonts.addEventListener("loadingdone", invalidate);
  return { needsFit, fitted, invalidate, writeBar, hold, release };
})();

function stayedInsideControl(event, control) {
  return (
    !!control &&
    event.type === "pointerover" &&
    event.relatedTarget instanceof Element &&
    control.contains(event.relatedTarget)
  );
}

// Text fitting is measured again only when its real input or available box changes.
// Font completion and viewport dimensions are part of the key, so accessibility
// and resizing retain their original fit; this is never a saved game cache.
let textFitFrames = new WeakMap();
document.fonts.addEventListener("loadingdone", () => {
  textFitFrames = new WeakMap();
});
function textFitKey(el, max, min) {
  return [
    max,
    min,
    el.clientWidth,
    el.clientHeight,
    innerWidth,
    innerHeight,
    document.fonts.status,
    el.innerHTML,
  ].join("|");
}

// Compare only live tooltip inputs, never serialize a run's nested histories.
function heroTooltipFingerprint(h) {
  const foe = state.enemy,
    artefact = state.artefacts.find((a) => a.id === state.equippedArtefact);
  return [
    h.id,
    h.hp,
    h.maxHp,
    h.level,
    h.xp,
    h.points,
    h.specialism,
    h.equipment,
    h.trait?.id,
    h.trait?.reason,
    h.charge,
    h.fury,
    h.rage,
    h.anticipation,
    h.stun,
    h.stunWard,
    h.poison?.turns,
    h.poison?.damage,
    h.stimulant?.turns,
    h.stimulant?.power,
    h.vulnerable?.createdAction,
    h.fairySleep,
    h.healingPenalty,
    Object.values(h.stats || {}).join(","),
    h.reels.map((r) => r.map((f) => f.type + f.tier).join(",")).join("/"),
    state.party
      .map((p) => [p.id, p.job, p.hp, p.maxHp, p.equipment, p.level].join(","))
      .join("/"),
    foe?.id,
    foe?.hp,
    foe?.maxHp,
    state.block,
    state.actionSerial,
    state.steps,
    state.finishedAt,
    state.runRules.join(","),
    artefact?.id,
    artefact?.power,
    Math.floor(Date.now() / 1000),
  ].join("|");
}
