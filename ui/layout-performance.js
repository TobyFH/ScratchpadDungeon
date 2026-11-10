// Ephemeral layout bookkeeping. No game state, timers, animation or RNG changes.
const notebookLayout = (() => {
  const desk = document.querySelector(".desk");
  const bar = document.getElementById("keyboard-bar");
  let dirty = true, viewport = "", scale = null;
  function invalidate() { dirty = true; }
  function needsFit(force, fitted) {
    return force || dirty || viewport !== `${innerWidth}:${innerHeight}` ||
      desk.classList.contains("fit-notebook") !== fitted ||
      desk.style.getPropertyValue("--desk-scale") !== scale;
  }
  function fitted() {
    dirty = false;
    viewport = `${innerWidth}:${innerHeight}`;
    scale = desk.style.getPropertyValue("--desk-scale");
  }
  function syncBarHeight() {
    const height = bar.offsetHeight + "px";
    if (document.documentElement.style.getPropertyValue("--keyboard-bar-height") !== height) {
      document.documentElement.style.setProperty("--keyboard-bar-height", height);
      invalidate();
    }
  }
  function writeBar(next) {
    if (bar.innerHTML === next) return;
    bar.innerHTML = next;
    invalidate();
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
      dimensions.set(entry.target, next); changed = true;
      if (entry.target === bar) syncBarHeight();
    }
    if (changed) { invalidate(); requestFitUI(); }
  });
  observer.observe(desk); observer.observe(bar);
  document.fonts.addEventListener("loadingdone", invalidate);
  return { needsFit, fitted, invalidate, writeBar };
})();

function stayedInsideControl(event, control) {
  return !!control && event.type === "pointerover" &&
    event.relatedTarget instanceof Element && control.contains(event.relatedTarget);
}
