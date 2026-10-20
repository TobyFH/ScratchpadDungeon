Production.ui = (() => {
  let bridge = null;
  const escape = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  function isDeck() {
    return (
      Production.settings.display === "deck" ||
      (Production.settings.display === "auto" &&
        innerWidth >= 1100 &&
        innerWidth <= 1366 &&
        innerHeight <= 850)
    );
  }
  function fit(desk) {
    const deck = isDeck();
    document.body.dataset.deck = String(deck);
    desk.classList.toggle("deck-layout", deck);
    if (deck) {
      desk.classList.remove("fit-notebook");
      desk.style.removeProperty("--desk-scale");
      return true;
    }
    return false;
  }
  async function fullscreen() {
    if (globalThis.ScratchpadDesktop?.toggleFullscreen) {
      await globalThis.ScratchpadDesktop.toggleFullscreen();
      return;
    }
    if (document.fullscreenElement) await document.exitFullscreen();
    else
      await document.documentElement
        .requestFullscreen()
        .catch((e) =>
          Production.report("Fullscreen is unavailable", e.message),
        );
  }
  function audioMarkup() {
    const s = Production.audio.settings;
    return `<h3>Sound & music</h3><div class="production-options">${[
      ["master", "Master volume"],
      ["sfx", "Sound effects"],
      ["music", "Music"],
    ]
      .map(
        ([key, label]) =>
          `<label>${label}<input type="range" min="0" max="1" step="0.05" data-volume="${key}" value="${s[key]}" aria-label="${label}"><output>${Math.round(s[key] * 100)}%</output></label>`,
      )
      .join(
        "",
      )}<label class="check-option"><input type="checkbox" id="audio-muted" ${s.muted ? "checked" : ""}> Mute all audio</label></div><p class="production-copy">Quiet, temporary music and sound effects. Volume changes are saved automatically.</p><button id="audio-test">Play a sound</button>`;
  }
  const labels = {
    confirm: "Choose / use",
    cancel: "Back / skip",
    spin: "Spin selected hero",
    inventory: "Open satchel",
    previousHero: "Previous hero",
    nextHero: "Next hero",
    previousTarget: "Previous enemy",
    nextTarget: "Next enemy",
    guide: "Field guide",
    pause: "Pause / continue",
    map: "Focus map",
    options: "Options",
    up: "Navigate up",
    down: "Navigate down",
    left: "Navigate left",
    right: "Navigate right",
  };
  function controllerMarkup() {
    const s = Production.input.settings;
    return `<h3>Controller</h3><div class="controller-settings"><label>Stick deadzone<input id="controller-deadzone" type="range" min="0.1" max="0.8" step="0.02" value="${s.deadzone}"><output>${Math.round(s.deadzone * 100)}%</output></label><label>Button prompts<select id="controller-glyphs">${["auto", "xbox", "deck", "playstation", "nintendo"].map((k) => `<option value="${k}" ${s.glyphs === k ? "selected" : ""}>${k === "auto" ? "Automatic" : k === "deck" ? "Steam Deck" : k[0].toUpperCase() + k.slice(1)}</option>`).join("")}</select></label></div><p class="production-copy">Left stick / D-pad moves focus. Right stick scrolls field notes or the final roster. A selects sliders; left / right adjusts them. Rebinding swaps occupied buttons.</p><div class="binding-grid">${Object.keys(
      Production.input.defaults,
    )
      .map(
        (key) =>
          `<label>${labels[key]}<select data-binding="${key}">${Array.from({ length: 16 }, (_, b) => `<option value="${b}" ${s.bindings[key] === b ? "selected" : ""}>${["A / ×", "B / ○", "X / □", "Y / △", "LB / L1", "RB / R1", "LT / L2", "RT / R2", "View / Share", "Menu / Options", "Left stick click", "Right stick click", "D-pad up", "D-pad down", "D-pad left", "D-pad right"][b]}</option>`).join("")}</select></label>`,
      )
      .join(
        "",
      )}</div><button id="controller-reset">Restore controller defaults</button>`;
  }
  function displayMarkup() {
    return `<h3>Screen & notebook</h3><label class="display-option">Layout<select id="production-layout">${[
      ["auto", "Automatic"],
      ["deck", "Steam Deck · readable compact pages"],
      ["desktop", "Original notebook layout"],
    ]
      .map(
        ([value, label]) =>
          `<option value="${value}" ${Production.settings.display === value ? "selected" : ""}>${label}</option>`,
      )
      .join(
        "",
      )}</select></label><p class="production-copy">The compact layout targets 1280 × 800 and 1280 × 720 without changing the dungeon. It uses readable controls and keeps the map, party and battle in view.</p><button id="production-fullscreen">Toggle fullscreen</button>`;
  }
  function wire(root) {
    root.querySelectorAll("[data-volume]").forEach(
      (input) =>
        (input.oninput = () => {
          Production.audio.update({
            [input.dataset.volume]: Number(input.value),
          });
          input.nextElementSibling.textContent =
            Math.round(Number(input.value) * 100) + "%";
        }),
    );
    const mute = root.querySelector("#audio-muted");
    if (mute)
      mute.onchange = () => Production.audio.update({ muted: mute.checked });
    const test = root.querySelector("#audio-test");
    if (test)
      test.onclick = async () => {
        await Production.audio.unlock();
        Production.audio.play("sfx.heal");
      };
    const dz = root.querySelector("#controller-deadzone");
    if (dz)
      dz.oninput = () => {
        Production.input.settings.deadzone = Number(dz.value);
        dz.nextElementSibling.textContent =
          Math.round(Number(dz.value) * 100) + "%";
        Production.persist();
      };
    const glyph = root.querySelector("#controller-glyphs");
    if (glyph)
      glyph.onchange = () => {
        Production.input.settings.glyphs = glyph.value;
        Production.persist();
        bridge?.prompts();
      };
    root.querySelectorAll("[data-binding]").forEach(
      (select) =>
        (select.onchange = () => {
          Production.input.bind(select.dataset.binding, Number(select.value));
          root
            .querySelectorAll("[data-binding]")
            .forEach(
              (s) =>
                (s.value = String(
                  Production.input.settings.bindings[s.dataset.binding],
                )),
            );
        }),
    );
    const reset = root.querySelector("#controller-reset");
    if (reset)
      reset.onclick = () => {
        Production.input.settings.bindings = { ...Production.input.defaults };
        Production.persist();
        root
          .querySelectorAll("[data-binding]")
          .forEach(
            (s) =>
              (s.value = String(
                Production.input.settings.bindings[s.dataset.binding],
              )),
          );
        bridge?.prompts();
      };
    const layout = root.querySelector("#production-layout");
    if (layout)
      layout.onchange = () => {
        Production.settings.display = layout.value;
        Production.persist();
        bridge?.fit();
      };
    const full = root.querySelector("#production-fullscreen");
    if (full) full.onclick = fullscreen;
  }
  function extendOptions() {
    const flow = document.querySelector("#modal .modal-flow");
    if (!flow || flow.querySelector(".production-tabs")) return;
    const game = document.createElement("section");
    game.dataset.productionPage = "game";
    while (flow.firstChild) game.append(flow.firstChild);
    flow.append(game);
    const tabs = document.createElement("nav");
    tabs.className = "production-tabs";
    tabs.setAttribute("aria-label", "Options pages");
    tabs.innerHTML = [
      ["game", "Game"],
      ["audio", "Audio"],
      ["controller", "Controller"],
      ["display", "Screen"],
    ]
      .map(
        ([id, label]) =>
          `<button data-options-page="${id}" aria-pressed="${id === "game"}">${label}</button>`,
      )
      .join("");
    flow.prepend(tabs);
    for (const [id, markup] of [
      ["audio", audioMarkup()],
      ["controller", controllerMarkup()],
      ["display", displayMarkup()],
    ]) {
      const p = document.createElement("section");
      p.dataset.productionPage = id;
      p.hidden = true;
      p.innerHTML = markup;
      flow.append(p);
    }
    const back = document.createElement("div");
    back.className = "modal-actions";
    back.innerHTML =
      '<button class="primary" data-close>Back to the notebook</button>';
    flow.append(back);
    tabs.querySelectorAll("button").forEach(
      (b) =>
        (b.onclick = () => {
          flow
            .querySelectorAll("[data-production-page]")
            .forEach(
              (p) =>
                (p.hidden = p.dataset.productionPage !== b.dataset.optionsPage),
            );
          tabs
            .querySelectorAll("button")
            .forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
          bridge?.fitDialogs();
        }),
    );
    wire(flow);
    bridge?.fitDialogs();
  }
  function pauseOptions(layer) {
    const panel = layer.querySelector(".production-panel");
    panel.innerHTML = `<h2>By the torch · options</h2><nav class="production-tabs"><button data-pause-panel="audio">Audio</button><button data-pause-panel="controller">Controller</button><button data-pause-panel="display">Screen</button></nav><div id="pause-option-content">${audioMarkup()}</div><button data-production-back>Back</button>`;
    const content = panel.querySelector("#pause-option-content");
    panel.querySelectorAll("[data-pause-panel]").forEach(
      (b) =>
        (b.onclick = () => {
          content.innerHTML = {
            audio: audioMarkup,
            controller: controllerMarkup,
            display: displayMarkup,
          }[b.dataset.pausePanel]();
          wire(content);
        }),
    );
    panel.querySelector("[data-production-back]").onclick = () => {
      Production.input.resume();
      Production.input.pause();
    };
    wire(content);
    Production.input.focus(Production.input.controls(layer)[0]);
  }
  function pauseGuide(layer) {
    const panel = layer.querySelector(".production-panel");
    panel.innerHTML =
      '<h2>A field guide by the torch</h2><div class="pause-guide"><p>Scratch nearby covered rooms, or choose a destination across revealed ground. Click again to redirect your path. Stone and rivers block travel; bridges cross water.</p><p>Any living hero can spin repeatedly. Choose portraits to target damage or healing. Three matching marks roll a critical. Team block protects everyone and expires after a fight.</p><p>Wells, shops and ruins can be left for later. Defeat each stair guardian before descending; the tenth guardian ends the expedition.</p><p>Use left stick / D-pad to move focus, A to choose and B to go back. Right stick scrolls field notes and the final roster. The Controller page lets you change button assignments.</p></div><button data-production-back>Back</button>';
    panel.querySelector("[data-production-back]").onclick = () => {
      Production.input.resume();
      Production.input.pause();
    };
    Production.input.focus(Production.input.controls(layer)[0]);
  }
  function init(adapter) {
    bridge = adapter;
    document.addEventListener("click", (e) => {
      if (e.target.closest("button:not(:disabled)"))
        Production.audio.play("sfx.ui-confirm");
    });
  }
  return {
    init,
    isDeck,
    fit,
    extendOptions,
    pauseOptions,
    pauseGuide,
    fullscreen,
  };
})();
