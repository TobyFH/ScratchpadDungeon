// Keyboard controller rehearsal. Mouse and original shortcuts stay independent.
// Native selects/ranges keep native keys; this mode rehearses focus/confirm/back.
const controlNavigation = (() => {
  let modality = "mouse",
    focused = null,
    lastScope = null;
  const selector =
    'button:not(:disabled),select:not(:disabled),input:not(:disabled),[tabindex="0"]';
  const enabled = () => !!state?.preferences?.navigationMode;
  function scope() {
    return !$("#spotlight").hidden
      ? $("#stage-card")
      : !$("#overlay").hidden
        ? $("#modal")
        : $(".desk");
  }
  function candidates() {
    return [...scope().querySelectorAll(selector)].filter(
      (n) =>
        !n.closest('[hidden],[inert],[aria-hidden="true"]') &&
        getComputedStyle(n).visibility !== "hidden" &&
        n.getClientRects().length,
    );
  }
  function clear() {
    document
      .querySelectorAll(".controller-focus")
      .forEach((n) => n.classList.remove("controller-focus"));
  }
  function choose(n) {
    if (!n) return;
    clear();
    modality = "navigation";
    document.body.dataset.inputModality = modality;
    focused = n;
    n.classList.add("controller-focus");
    n.focus({ preventScroll: true });
    n.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
  function anchor() {
    const s = scope(),
      list = candidates();
    if (s !== lastScope) {
      lastScope = s;
      focused = null;
    }
    return focused?.isConnected && list.includes(focused)
      ? focused
      : list.includes(document.activeElement)
        ? document.activeElement
        : list.find(
            (n) =>
              n.hasAttribute("data-tile") &&
              Number(n.dataset.tile) === state.position,
          ) ||
          list.find((n) => n.classList.contains("primary")) ||
          list[0];
  }
  function move(dx, dy) {
    const from = anchor();
    if (!from) return;
    if (modality !== "navigation") {
      choose(from);
      return;
    }
    const r = from.getBoundingClientRect(),
      x = r.left + r.width / 2,
      y = r.top + r.height / 2;
    let best = null,
      score = Infinity;
    for (const n of candidates()) {
      if (n === from) continue;
      const b = n.getBoundingClientRect(),
        vx = b.left + b.width / 2 - x,
        vy = b.top + b.height / 2 - y,
        forward = vx * dx + vy * dy;
      if (forward <= 2) continue;
      const side = Math.abs(vx * dy - vy * dx),
        rank = forward + side * 3 + Math.hypot(vx, vy) * 0.1;
      if (rank < score) {
        score = rank;
        best = n;
      }
    }
    if (best) choose(best);
  }
  function back() {
    if (!$("#spotlight").hidden) {
      const buttons = candidates(),
        cancel = buttons.find((n) =>
          /leave|decline|ignore|cancel|back|not now/i.test(n.textContent),
        );
      if (cancel) cancel.click();
      else fastForward();
      return;
    }
    if (!$("#overlay").hidden) {
      if (modalKind === "equipment") {
        equipmentCancel?.();
        return;
      }
      if (["starter", "camp"].includes(modalKind) && state.awaitingStarter)
        return;
      closeModal();
      return;
    }
    openUtilityPage("options");
  }
  function key(e) {
    if (!enabled() || CompanyIntro.active || e.ctrlKey || e.altKey || e.metaKey)
      return;
    const native = ["SELECT", "INPUT", "TEXTAREA"].includes(e.target.tagName),
      k = e.key.toLowerCase();
    // Tab leaves native controls and restores controller highlighting.
    if (native && k !== "escape" && k !== "tab") return;
    const dirs = {
      arrowup: [0, -1],
      w: [0, -1],
      arrowdown: [0, 1],
      s: [0, 1],
      arrowleft: [-1, 0],
      a: [-1, 0],
      arrowright: [1, 0],
      d: [1, 0],
    };
    if (dirs[k]) {
      e.preventDefault();
      e.stopImmediatePropagation();
      move(...dirs[k]);
      return;
    }
    if (["enter", " "].includes(k)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      const n = anchor();
      choose(n);
      if (n?.tagName === "SELECT") {
        n.focus();
        n.showPicker?.();
      } else n?.click();
      return;
    }
    if (k === "escape" || k === "backspace") {
      e.preventDefault();
      e.stopImmediatePropagation();
      back();
      return;
    }
    if (k === "tab") {
      e.preventDefault();
      e.stopImmediatePropagation();
      const list = candidates(),
        at = list.indexOf(anchor());
      choose(list[(at + (e.shiftKey ? list.length - 1 : 1)) % list.length]);
      return;
    }
    // Direct gameplay shortcuts are suspended in rehearsal mode.
    if (!native) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }
  document.addEventListener("keydown", key, true);
  function mouse(e) {
    if (e.type === "pointermove" && !e.movementX && !e.movementY) return;
    if (modality === "mouse") return;
    modality = "mouse";
    document.body.dataset.inputModality = modality;
    clear();
    if (
      focused === document.activeElement &&
      !["INPUT", "SELECT", "TEXTAREA"].includes(focused?.tagName)
    )
      focused.blur();
    if (statusTooltipSource === focused) statusTooltip.hidden = true;
  }
  document.addEventListener("pointermove", mouse, { passive: true });
  document.addEventListener("pointerdown", mouse, {
    passive: true,
    capture: true,
  });
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-input-mode]")) {
      setPreference("navigationMode", !enabled());
      clear();
      focused = null;
      updateKeyboardBar();
      if (enabled()) choose(anchor());
    }
  });
  return { enabled, move, back, clear, choose };
})();
function navigationBarToggle() {
  return `<button class="input-mode-toggle" data-input-mode aria-pressed="${!!preferences().navigationMode}" data-tooltip="Switch keyboard controls: direct hotkeys, or directional focus with Confirm/Back to rehearse a controller.">${preferences().navigationMode ? "Focus controls" : "Hotkey controls"} ⇄</button>`;
}
function navigationBarPrompts() {
  return "<span><kbd>↑↓←→</kbd> / <kbd>WASD</kbd> focus</span><span><kbd>Enter</kbd> / <kbd>Space</kbd> confirm (A)</span><span><kbd>Esc</kbd> back (B)</span><span><kbd>Tab</kbd> next · <kbd>Shift Tab</kbd> previous</span><span>Mouse: point & click anytime</span>";
}
