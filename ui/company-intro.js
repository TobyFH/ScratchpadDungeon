// Startup presentation only. No save keys, gameplay randomness or run mutations.
// Embed the original film so file:// and downloaded HTML have identical playback.
const CompanyIntro = (() => {
  const layer = document.getElementById("company-intro");
  const video = document.getElementById("company-intro-video");
  const button = document.getElementById("company-intro-skip");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let active = true, finishing = false, startGame, resolveReady;
  let watchdog, frame;
  const ready = new Promise((resolve) => { resolveReady = resolve; });
  const inertBefore = new Map();

  async function fade(node, from, to, ms) {
    if (!node || !ms || reduced) return;
    const motion = node.animate([{ opacity: from }, { opacity: to }], {
      duration: ms, easing: "ease-in-out", fill: "forwards",
    });
    try { await motion.finished; } catch { /* Closing a tab cancels animation. */ }
  }
  async function finish(instant = false) {
    if (finishing) return ready;
    finishing = true;
    clearTimeout(watchdog);
    cancelAnimationFrame(frame);
    video.pause();
    button.disabled = true;
    // Fade the actual final video frame into the black stage first.
    await Promise.all([fade(video, 1, 0, instant ? 0 : 320), fade(button, 1, 0, instant ? 0 : 160)]);
    try {
      startGame();
    } finally {
      // Initialize behind black, then expose the notebook's existing opening.
      document.body.classList.remove("company-intro-active");
      await fade(layer, 1, 0, instant ? 0 : 420);
      layer.remove();
      for (const [node, inert] of inertBefore) node.inert = inert;
      document.removeEventListener("keydown", keyboard, true);
      document.removeEventListener("pointerdown", pointer, true);
      document.removeEventListener("click", click, true);
      document.removeEventListener("visibilitychange", visibility);
      active = false;
      // Don't steal focus from a restored death/item confirmation.
      if (!document.activeElement || document.activeElement === document.body) {
        const dialog = document.querySelector('#spotlight:not([hidden]), #overlay:not([hidden])');
        const target = dialog?.querySelector('button:not([hidden]):not(:disabled)') || document.getElementById("new-game");
        target?.focus({ preventScroll: true });
      }
      resolveReady();
    }
    return ready;
  }
  function keyboard(event) {
    if (!active) return;
    event.stopImmediatePropagation();
    if (["Escape", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      if (!event.repeat) void finish();
    } else if (event.key === "Tab") {
      event.preventDefault(); button.focus();
    }
  }
  function pointer(event) { if (active) event.stopImmediatePropagation(); }
  function click(event) {
    if (!active) return;
    event.stopImmediatePropagation();
    if (event.target.closest("#company-intro-skip")) void finish();
  }
  function play() {
    if (!active || finishing || document.hidden) return;
    try { video.play()?.catch(() => void finish()); }
    catch { void finish(); }
  }
  function armWatchdog() {
    clearTimeout(watchdog);
    if (!document.hidden && !finishing) watchdog = setTimeout(() => void finish(), 10000);
  }
  function visibility() {
    armWatchdog();
    if (document.hidden) video.pause(); else play();
  }
  function pollController() {
    if (!active || finishing) return;
    let pads;
    try { pads = navigator.getGamepads?.() || []; }
    catch { return; } // Embedded previews may deny the gamepad permission policy.
    if (Array.from(pads).some((pad) => pad?.buttons.some((b) => b.pressed))) void finish();
    else frame = requestAnimationFrame(pollController);
  }
  function run(boot) {
    startGame = boot;
    for (const node of document.body.children) {
      if (node === layer || node.tagName === "SCRIPT") continue;
      inertBefore.set(node, node.inert); node.inert = true;
    }
    document.addEventListener("keydown", keyboard, true);
    document.addEventListener("pointerdown", pointer, true);
    document.addEventListener("click", click, true);
    document.addEventListener("visibilitychange", visibility);
    video.addEventListener("ended", () => void finish(), { once: true });
    video.addEventListener("error", () => void finish(), { once: true });
    // Unsupported codecs, suspended media and blocked playback must never trap startup.
    armWatchdog();
    button.focus({ preventScroll: true });
    frame = requestAnimationFrame(pollController);
    if (reduced) void finish(true);
    else play();
    return ready;
  }
  return { run, skip: finish, ready, get active() { return active; } };
})();
