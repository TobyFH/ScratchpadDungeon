// Title navigation owns no gameplay rules. A loaded run remains suspended until
// Continue; an unsaved preview supplies existing utility pages without a save.
const MainMenu = (() => {
  const root = document.getElementById("main-menu");
  let showing = false,
    initializing = false,
    resumable = false,
    dismissMotion = null;
  function syncInert() {
    root.inert = !showing;
    document.querySelector(".desk").inert = showing;
    document.getElementById("keyboard-bar").inert = showing;
  }
  function focus() {
    (resumable
      ? document.getElementById("menu-continue")
      : document.getElementById("menu-new-run")
    ).focus({ preventScroll: true });
  }
  function show() {
    dismissMotion?.cancel();
    dismissMotion = null;
    showing = true;
    root.hidden = false;
    document.body.classList.add("main-menu-active");
    document.getElementById("menu-continue").hidden = !resumable;
    root.querySelector(".title-continue-space").hidden = !resumable;
    root.classList.toggle("has-saved-run", resumable);
    syncInert();
    document.body.dataset.palette = state.palette || "warm";
    applyPreferences();
    focus();
  }
  function leave() {
    if (!showing) return;
    showing = false;
    document.body.classList.remove("main-menu-active");
    syncInert();
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || skip)
      root.hidden = true;
    else {
      const motion = root.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 200,
        easing: "ease-out",
      });
      dismissMotion = motion;
      motion.finished
        .catch(() => {})
        .finally(() => {
          if (dismissMotion !== motion) return;
          dismissMotion = null;
          root.hidden = true;
        });
    }
  }
  function boot() {
    showing = initializing = true;
    const restored = !prepareUpdatedNotebook() && load();
    resumable = restored && !state.over && !state.awaitingStarter;
    if (!restored) {
      newRun();
      state.awaitingStarter = true;
    }
    const settings = readSettings();
    state.preferences = normalisePreferences(
      settings.preferences || state.preferences,
    );
    state.speed = settings.speed || state.speed;
    state.palette = settings.palette || state.palette;
    state.autoplay = settings.autoplay ?? state.autoplay;
    state.autoresolve = settings.autoresolve ?? state.autoresolve;
    skip = state.speed === "skip";
    initializing = false;
    show();
  }
  function beforeNewRun() {
    if (!initializing) leave();
  }
  function continueRun() {
    if (!showing || !resumable) return;
    leave();
    resumeSavedNotebook();
    const dialog = document.querySelector(
      "#spotlight:not([hidden]), #overlay:not([hidden])",
    );
    (
      dialog?.querySelector("button:not([hidden]):not(:disabled)") ||
      document.getElementById("new-game")
    ).focus({ preventScroll: true });
  }
  document.getElementById("menu-continue").onclick = continueRun;
  document.getElementById("menu-new-run").onclick = () =>
    chooseStartingClass(!resumable);
  for (const [id, page] of [
    ["menu-options", "options"],
    ["menu-guide", "guide"],
    ["menu-bestiary", "bestiary"],
  ])
    document.getElementById(id).onclick = () => openUtilityPage(page);
  root.addEventListener("keydown", (event) => {
    if (
      event.defaultPrevented ||
      !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
    )
      return;
    event.preventDefault();
    const buttons = [...root.querySelectorAll("button:not([hidden])")],
      at = buttons.indexOf(document.activeElement),
      step = ["ArrowLeft", "ArrowUp"].includes(event.key) ? -1 : 1;
    buttons[(at + step + buttons.length) % buttons.length].focus();
  });
  return {
    boot,
    beforeNewRun,
    syncInert,
    focus,
    get visible() {
      return showing;
    },
  };
})();
