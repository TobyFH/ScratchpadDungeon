Production.input = (() => {
  const defaults = {
    confirm: 0,
    cancel: 1,
    spin: 2,
    inventory: 3,
    previousHero: 4,
    nextHero: 5,
    previousTarget: 6,
    nextTarget: 7,
    guide: 8,
    pause: 9,
    map: 10,
    options: 11,
    up: 12,
    down: 13,
    left: 14,
    right: 15,
  };
  const settings = Production.settings.controller;
  settings.bindings = { ...defaults, ...settings.bindings };
  let bridge = null,
    device = "keyboard",
    family = "xbox",
    padIndex = null,
    previous = [],
    axisDirection = null,
    nextRepeat = 0,
    focusKey = null,
    focused = null,
    paused = false,
    virtualInput = null;
  const downKeys = new Set(),
    actions = new Map();
  if (
    Object.keys(defaults).some(
      (k) =>
        !Number.isInteger(settings.bindings[k]) ||
        settings.bindings[k] < 0 ||
        settings.bindings[k] > 15,
    ) ||
    new Set(Object.values(settings.bindings)).size !== 16
  )
    settings.bindings = { ...defaults };
  const visible = (el) =>
    !!el &&
    el.getClientRects().length &&
    !el.closest("[hidden]") &&
    getComputedStyle(el).visibility !== "hidden";
  function scope() {
    return (
      document.querySelector(
        "#production-keyboard:not([hidden]),#production-errors:not([hidden])",
      ) ||
      document.querySelector("#production-pause:not([hidden])") ||
      [
        ...document.querySelectorAll(
          "#overlay:not([hidden]),#spotlight:not([hidden])",
        ),
      ].sort(
        (a, b) =>
          (+getComputedStyle(b).zIndex || 0) -
          (+getComputedStyle(a).zIndex || 0),
      )[0] ||
      document.querySelector(".desk")
    );
  }
  function controls(root = scope()) {
    return [
      ...(root?.querySelectorAll(
        'button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]',
      ) || []),
    ].filter(visible);
  }
  function keyFor(el) {
    if (!el) return null;
    if (el.id) return "#" + el.id;
    for (const k of [
      "tile",
      "spin",
      "target",
      "enemyTarget",
      "useItem",
      "stageChoice",
      "cycle",
      "upgrade",
      "weaken",
      "gearHero",
      "gearChoice",
      "startJob",
      "buy",
    ])
      if (el.dataset[k] != null)
        return `[data-${k.replace(/[A-Z]/g, (x) => "-" + x.toLowerCase())}="${CSS.escape(el.dataset[k])}"]`;
    return null;
  }
  function focus(el) {
    if (!visible(el) || el.disabled) return false;
    document
      .querySelectorAll("[data-controller-focus]")
      .forEach((e) => e.removeAttribute("data-controller-focus"));
    el.setAttribute("data-controller-focus", "");
    el.focus({ preventScroll: true });
    focused = el;
    focusKey = keyFor(el);
    if (el.closest(".fallen-roster") || innerWidth < 1100)
      el.scrollIntoView({ block: "nearest", inline: "nearest" });
    return true;
  }
  function restore() {
    if (device !== "gamepad") return;
    if (
      visible(document.activeElement) &&
      scope()?.contains(document.activeElement) &&
      document.activeElement.matches('button,input,select,[tabindex="0"]')
    ) {
      focused = document.activeElement;
      return;
    }
    const el = focusKey && scope()?.querySelector(focusKey);
    focus(el || controls()[0]);
  }
  function adjust(el, dir) {
    if (el.tagName === "SELECT") {
      const options = [...el.options].filter((o) => !o.disabled),
        index = options.indexOf(el.selectedOptions[0]);
      el.value =
        options[Math.max(0, Math.min(options.length - 1, index + dir))]?.value;
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }
    if (el.type === "range" || el.type === "number") {
      const step = Number(el.step) || 1,
        min = Number(el.min) || 0,
        max = Number(el.max) || 100;
      el.value = String(
        Math.min(max, Math.max(min, Number(el.value) + dir * step)),
      );
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }
    return false;
  }
  function navigate(direction) {
    restore();
    let current = focused || document.activeElement;
    if (
      ["left", "right"].includes(direction) &&
      current &&
      adjust(current, direction === "right" ? 1 : -1)
    )
      return;
    if (current?.dataset.tile != null) {
      const delta = {
          left: -1,
          right: 1,
          up: -bridge.width,
          down: bridge.width,
        }[direction],
        i = Number(current.dataset.tile),
        target = scope().querySelector(`[data-tile="${i + delta}"]`);
      if (
        target &&
        !target.disabled &&
        Math.abs((i % bridge.width) - ((i + delta) % bridge.width)) <= 1
      ) {
        focus(target);
        return;
      }
    }
    const list = controls().filter((e) => e !== current);
    if (!current || !visible(current)) {
      focus(list[0]);
      return;
    }
    const a = current.getBoundingClientRect(),
      ax = a.left + a.width / 2,
      ay = a.top + a.height / 2,
      dx = { left: -1, right: 1, up: 0, down: 0 }[direction],
      dy = { up: -1, down: 1, left: 0, right: 0 }[direction];
    let best = null,
      score = Infinity;
    for (const el of list) {
      const b = el.getBoundingClientRect(),
        x = b.left + b.width / 2 - ax,
        y = b.top + b.height / 2 - ay,
        forward = x * dx + y * dy;
      if (forward < 3) continue;
      const side = Math.abs(x * dy - y * dx),
        cost = forward + side * 2.5 + (side > forward * 2 ? 1000 : 0);
      if (cost < score) {
        best = el;
        score = cost;
      }
    }
    focus(
      best ||
        list[direction === "up" || direction === "left" ? list.length - 1 : 0],
    );
  }
  function setDevice(next, pad) {
    const previousFamily = family;
    if (next === "gamepad") {
      family =
        settings.glyphs === "auto"
          ? /dual|playstation|sony|054c/i.test(pad?.id || "")
            ? "playstation"
            : /nintendo|switch|057e/i.test(pad?.id || "")
              ? "nintendo"
              : globalThis.ScratchpadDesktop?.isSteamDeck
                ? "deck"
                : "xbox"
          : settings.glyphs;
    }
    if (next !== device) {
      device = next;
      document.body.dataset.inputDevice = next;
      if (next === "keyboard")
        document
          .querySelectorAll("[data-controller-focus]")
          .forEach((e) => e.removeAttribute("data-controller-focus"));
      bridge?.prompts();
    }
    document.body.dataset.controllerGlyphs = family;
    if (previousFamily !== family) bridge?.prompts();
  }
  const glyph = (action) => {
    const b = settings.bindings[action],
      set =
        family === "playstation"
          ? [
              "×",
              "○",
              "□",
              "△",
              "L1",
              "R1",
              "L2",
              "R2",
              "SHARE",
              "OPTIONS",
              "L3",
              "R3",
              "↑",
              "↓",
              "←",
              "→",
            ]
          : family === "nintendo"
            ? [
                "B",
                "A",
                "Y",
                "X",
                "L",
                "R",
                "ZL",
                "ZR",
                "−",
                "+",
                "LS",
                "RS",
                "↑",
                "↓",
                "←",
                "→",
              ]
            : [
                "A",
                "B",
                "X",
                "Y",
                "LB",
                "RB",
                "LT",
                "RT",
                "▧",
                "☰",
                "LS",
                "RS",
                "↑",
                "↓",
                "←",
                "→",
              ];
    return set[b] ?? "?";
  };
  function prompts() {
    return `<span><kbd>${glyph("up")}${glyph("left")}${glyph("down")}${glyph("right")}</kbd> / left stick · focus</span><span><kbd>${glyph("confirm")}</kbd> choose / use</span><span><kbd>${glyph("cancel")}</kbd> back / land reels</span><span><kbd>${glyph("spin")}</kbd> spin hero</span><span><kbd>${glyph("inventory")}</kbd> satchel</span><span><kbd>${glyph("previousHero")}</kbd><kbd>${glyph("nextHero")}</kbd> hero / menu focus</span><span><kbd>${glyph("previousTarget")}</kbd><kbd>${glyph("nextTarget")}</kbd> target</span><span><kbd>${glyph("pause")}</kbd> pause · right stick scrolls notes</span>`;
  }
  function dispatch(action, payload = {}) {
    const fn = actions.get(action);
    if (!fn) return false;
    if (
      paused &&
      ![
        "confirm",
        "cancel",
        "pause",
        "up",
        "down",
        "left",
        "right",
        "previousHero",
        "nextHero",
      ].includes(action)
    )
      return true;
    if (payload.source === "gamepad") {
      setDevice("gamepad", payload.pad);
      Production.audio.unlock();
    }
    fn(payload);
    return true;
  }
  function cycleHero(delta) {
    if (paused || bridge.context().dialog) {
      const list = controls(),
        i = list.indexOf(document.activeElement);
      focus(list[(i + delta + list.length) % list.length]);
      return;
    }
    const context = bridge.context(),
      party = context.party.filter((h) => !h.dead && h.hp > 0);
    if (!party.length) return;
    const current = party.findIndex(
        (h) => h.id === context.party[context.target]?.id,
      ),
      hero = party[(current + delta + party.length) % party.length],
      i = context.party.indexOf(hero);
    bridge.target(i);
    focus(document.querySelector(`[data-spin="${i}"]:not(:disabled)`));
  }
  function pause() {
    if (paused) {
      resume();
      return;
    }
    paused = true;
    Production.audio.duck(true);
    const layer = document.createElement("div");
    layer.id = "production-pause";
    layer.className = "production-layer";
    layer.innerHTML =
      '<section class="production-panel" role="dialog" aria-modal="true" aria-labelledby="pause-title"><h2 id="pause-title">A moment by the torch</h2><p>The page will wait.</p><div class="production-menu"><button id="pause-resume">Continue</button><button id="pause-options">Options</button><button id="pause-guide">Field guide</button><button id="pause-fullscreen">Toggle fullscreen</button>' +
      (globalThis.ScratchpadDesktop?.quit
        ? '<button id="pause-quit">Quit game</button>'
        : "") +
      "</div></section>";
    document.body.append(layer);
    layer.querySelector("#pause-resume").onclick = resume;
    layer.querySelector("#pause-options").onclick = () =>
      Production.ui.pauseOptions(layer);
    layer.querySelector("#pause-guide").onclick = () =>
      Production.ui.pauseGuide(layer);
    const quit = layer.querySelector("#pause-quit");
    if (quit) quit.onclick = () => ScratchpadDesktop.quit();
    layer.querySelector("#pause-fullscreen").onclick = () =>
      Production.ui.fullscreen();
    focus(controls(layer)[0]);
    bridge.prompts();
  }
  function resume() {
    if (!paused) return;
    document.querySelector("#production-pause")?.remove();
    paused = false;
    Production.audio.duck(false);
    restore();
    bridge?.prompts();
  }
  function cancel() {
    Production.audio.play("sfx.ui-back");
    const errors = document.querySelector("#production-errors");
    if (errors) {
      errors.remove();
      restore();
      return;
    }
    if (virtualInput) {
      closeKeyboard();
      return;
    }
    if (paused) {
      const back = document.querySelector(
        "#production-pause [data-production-back]",
      );
      if (back) back.click();
      else resume();
      return;
    }
    const root = scope();
    if (root?.id === "overlay") {
      const close = root.querySelector("[data-close]:not([hidden])");
      if (close) {
        close.click();
        return;
      }
    }
    if (root?.id === "spotlight") {
      bridge.fastForward();
      const decline = [...root.querySelectorAll("[data-stage-choice]")].find(
        (e) =>
          e.dataset.stageChoice === "false" ||
          e.dataset.stageChoice === "leave",
      );
      if (decline) focus(decline);
      return;
    }
    bridge.fastForward();
    focus(document.querySelector(`[data-tile="${bridge.context().position}"]`));
  }
  function confirm() {
    restore();
    const el = document.activeElement;
    if (!visible(el)) return;
    if (el.matches('input[type="text"],input[type="number"],textarea')) {
      openKeyboard(el);
      return;
    }
    if (el.matches("select")) {
      adjust(el, 1);
      return;
    }
    el.click();
  }
  function scroll(amount) {
    const area =
      [...scope().querySelectorAll(".fallen-roster,#log")].find(visible) ||
      document.querySelector("#log");
    if (area) area.scrollTop += amount;
  }
  function poll(
    pads = navigator.getGamepads?.() || [],
    now = performance.now(),
  ) {
    const pad = [...pads].find((p) => p && p.connected !== false);
    if (!pad) {
      if (padIndex != null) {
        padIndex = null;
        previous = [];
        axisDirection = null;
        setDevice("keyboard");
      }
      return;
    }
    if (padIndex !== pad.index) {
      padIndex = pad.index;
      previous = pad.buttons.map(() => false);
    }
    const buttons = pad.buttons.map((b) =>
      typeof b === "number" ? b > 0.55 : b.pressed || b.value > 0.55,
    );
    for (const [action, index] of Object.entries(settings.bindings))
      if (buttons[index] && !previous[index])
        dispatch(action, { source: "gamepad", pad });
    previous = buttons;
    let x = pad.axes[0] || 0,
      y = pad.axes[1] || 0;
    const magnitude = Math.hypot(x, y);
    let direction = null;
    if (magnitude > settings.deadzone)
      direction =
        Math.abs(x) > Math.abs(y)
          ? x > 0
            ? "right"
            : "left"
          : y > 0
            ? "down"
            : "up";
    if (direction && (direction !== axisDirection || now >= nextRepeat)) {
      dispatch(direction, { source: "gamepad", pad });
      nextRepeat = now + (direction !== axisDirection ? 330 : 125);
    }
    axisDirection = direction;
    const sy = pad.axes[3] || 0;
    if (Math.abs(sy) > settings.deadzone) {
      setDevice("gamepad", pad);
      scroll(sy * 14);
    }
    restore();
  }
  function bind(action, button) {
    if (
      !(action in defaults) ||
      !Number.isInteger(button) ||
      button < 0 ||
      button > 15
    )
      throw Error("Unsupported controller binding");
    const old = settings.bindings[action],
      other = Object.keys(settings.bindings).find(
        (k) => k !== action && settings.bindings[k] === button,
      );
    if (other) settings.bindings[other] = old;
    settings.bindings[action] = button;
    Production.persist();
    bridge?.prompts();
  }
  function handleKeyboard(e) {
    if (!bridge) return false;
    if (e.altKey || e.ctrlKey || e.metaKey) return false;
    setDevice("keyboard");
    const form = e.target?.matches?.("input,select,textarea"),
      key = e.key.toLowerCase();
    if (key === "escape" && paused) {
      e.preventDefault();
      cancel();
      return true;
    }
    if (paused) {
      if (key === "tab") {
        e.preventDefault();
        cycleHero(e.shiftKey ? -1 : 1);
        return true;
      }
      const direction = {
        arrowup: "up",
        arrowdown: "down",
        arrowleft: "left",
        arrowright: "right",
      }[key];
      if (direction && !form) {
        e.preventDefault();
        navigate(direction);
        return true;
      }
      if (!form && !["enter", " "].includes(key)) {
        e.preventDefault();
        return true;
      }
    }
    if (form) return false;
    if (
      key === "escape" &&
      !bridge.context().busy &&
      !bridge.context().dialog
    ) {
      e.preventDefault();
      dispatch("pause", { source: "keyboard" });
      return true;
    }
    const movement = {
      arrowup: "up",
      w: "up",
      arrowdown: "down",
      s: "down",
      arrowleft: "left",
      a: "left",
      arrowright: "right",
      d: "right",
    };
    if (movement[key] && !bridge.context().dialog) {
      if (e.target.id === "log" && key.startsWith("arrow")) return false;
      e.preventDefault();
      dispatch("move." + movement[key], { source: "keyboard" });
      return true;
    }
    if (/^[123]$/.test(key) || (e.shiftKey && /^Digit[123]$/.test(e.code))) {
      if (bridge.context().dialog) return false;
      e.preventDefault();
      const i = (e.shiftKey ? Number(e.code.slice(-1)) : Number(key)) - 1;
      if (e.shiftKey) bridge.target(i);
      else dispatch("spin", { source: "keyboard", hero: i });
      return true;
    }
    const shortcuts = {
      t: "pace",
      c: "palette",
      e: "edit",
      p: "potion",
      b: "bomb",
      v: "ward",
      x: "stairs",
      r: "revisit",
      f: "guide",
      m: "log",
      g: "download",
      n: "newRun",
      "[": "previousTarget",
      "]": "nextTarget",
    };
    const action = shortcuts[key];
    if (
      action &&
      (!bridge.context().dialog || ["pace", "palette"].includes(action))
    ) {
      e.preventDefault();
      dispatch(action, { source: "keyboard" });
      return true;
    }
    return false;
  }
  function openKeyboard(input) {
    virtualInput = input;
    const value = input.value || "",
      layer = document.createElement("div");
    layer.id = "production-keyboard";
    layer.className = "production-layer";
    layer.innerHTML = `<section class="production-panel" role="dialog" aria-modal="true" aria-label="On-screen keyboard"><h2>Write in the margin</h2><output id="virtual-value"></output><div class="virtual-keys">${"ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -_."
      .split("")
      .map(
        (c, i) =>
          `<button data-key-index="${i}">${c === " " ? "Space" : c}</button>`,
      )
      .join(
        "",
      )}</div><div class="production-menu"><button id="virtual-delete">Backspace</button><button id="virtual-done">Done</button><button id="virtual-cancel">Cancel</button></div></section>`;
    layer.dataset.original = value;
    document.body.append(layer);
    const out = layer.querySelector("output");
    out.value = value;
    out.textContent = value;
    layer.querySelectorAll("[data-key-index]").forEach(
      (b) =>
        (b.onclick = () => {
          const char = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -_."[
            Number(b.dataset.keyIndex)
          ];
          out.value = (out.value + char).slice(
            0,
            input.maxLength > 0 ? input.maxLength : 128,
          );
          out.textContent = out.value;
        }),
    );
    layer.querySelector("#virtual-delete").onclick = () => {
      out.value = out.value.slice(0, -1);
      out.textContent = out.value;
    };
    layer.querySelector("#virtual-done").onclick = () => {
      input.value = out.value;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      closeKeyboard();
    };
    layer.querySelector("#virtual-cancel").onclick = closeKeyboard;
    focus(controls(layer)[0]);
  }
  function closeKeyboard() {
    document.querySelector("#production-keyboard")?.remove();
    const input = virtualInput;
    virtualInput = null;
    focus(input);
  }
  async function waitUnpaused() {
    while (paused) await new Promise((r) => setTimeout(r, 20));
  }
  function delay(ms) {
    return new Promise((resolve) => {
      let elapsed = 0,
        last = performance.now();
      const tick = () => {
        const now = performance.now();
        if (!paused) elapsed += now - last;
        last = now;
        if (elapsed >= ms) resolve();
        else setTimeout(tick, 12);
      };
      tick();
    });
  }
  function init(adapter) {
    bridge = adapter;
    for (const dir of ["up", "down", "left", "right"]) {
      actions.set(dir, () => navigate(dir));
      actions.set("move." + dir, () => {
        if (!paused) bridge.move(dir);
      });
    }
    Object.entries({
      confirm,
      cancel,
      pause,
      spin: (p) => {
        if (!paused && !bridge.context().dialog)
          bridge.spin(p.hero ?? bridge.context().target);
      },
      inventory: () => {
        if (!paused && !bridge.context().dialog) bridge.inventory();
      },
      previousHero: () => cycleHero(-1),
      nextHero: () => cycleHero(1),
      previousTarget: () => bridge.enemyTarget(-1),
      nextTarget: () => bridge.enemyTarget(1),
      guide: () => {
        if (!paused && !bridge.context().dialog) bridge.guide();
      },
      options: () => {
        if (!paused && !bridge.context().dialog) bridge.options();
      },
      map: () =>
        focus(
          document.querySelector(`[data-tile="${bridge.context().position}"]`),
        ),
      pace: bridge.pace,
      palette: bridge.palette,
      edit: bridge.edit,
      potion: bridge.potion,
      bomb: bridge.bomb,
      ward: bridge.ward,
      stairs: bridge.stairs,
      revisit: bridge.revisit,
      log: () => focus(document.querySelector("#log")),
      download: bridge.download,
      newRun: bridge.newRun,
    }).forEach(([a, fn]) => actions.set(a, fn));
    document.addEventListener("pointerdown", () => setDevice("keyboard"));
    document.addEventListener("mousemove", (e) => {
      if (e.movementX || e.movementY) setDevice("keyboard");
    });
    new MutationObserver(() => {
      if (device === "gamepad") queueMicrotask(restore);
    }).observe(document.querySelector(".desk"), {
      subtree: true,
      childList: true,
    });
    const frame = () => {
      poll();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
  return {
    init,
    dispatch,
    handleKeyboard,
    poll,
    bind,
    defaults,
    settings,
    focus,
    scope,
    controls,
    prompts,
    pause,
    resume,
    waitUnpaused,
    delay,
    openKeyboard,
    get paused() {
      return paused;
    },
    get device() {
      return device;
    },
    get glyphFamily() {
      return family;
    },
  };
})();
