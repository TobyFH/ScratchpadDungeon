/* Production services have independent state and never draw from gameplay RNG. */
const Production = (() => {
  const source = globalThis.__PRODUCTION_DATA__;
  const deepFreeze = (o) => {
    if (o && typeof o === "object" && !Object.isFrozen(o)) {
      Object.values(o).forEach(deepFreeze);
      Object.freeze(o);
    }
    return o;
  };
  const errors = [];
  function report(message, detail) {
    const entry = {
      message: String(message),
      detail: String(detail || ""),
      at: Date.now(),
    };
    if (errors.some((e) => e.message === entry.message)) return;
    errors.push(entry);
    console.warn("[Scratchpad]", entry.message, entry.detail);
    let el = document.querySelector("#production-status");
    if (!el) {
      el = document.createElement("button");
      el.id = "production-status";
      el.className = "production-status";
      el.setAttribute("role", "status");
      el.onclick = showErrors;
      (document.querySelector(".desk") || document.body).append(el);
    }
    el.textContent = entry.message;
  }

  function showErrors() {
    document.querySelector("#production-errors")?.remove();
    const layer = document.createElement("div");
    layer.id = "production-errors";
    layer.className = "production-layer";
    const panel = document.createElement("section");
    panel.className = "production-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Game diagnostics");
    const title = document.createElement("h2");
    title.textContent = "A note from the notebook";
    panel.append(title);
    for (const entry of errors) {
      const p = document.createElement("p");
      p.textContent = entry.message + " " + entry.detail;
      panel.append(p);
    }
    const close = document.createElement("button");
    close.textContent = "Back to the notebook";
    close.onclick = () => layer.remove();
    panel.append(close);
    layer.append(panel);
    document.body.append(layer);
    Production.input?.focus(close);
  }
  const defaults = {
    audio: { master: 0.65, sfx: 0.75, music: 0.25, muted: false },
    controller: { deadzone: 0.28, glyphs: "auto", bindings: {} },
    display: "auto",
  };
  let settings;
  try {
    settings = JSON.parse(
      localStorage.getItem("scratchpad-production-settings-v1") || "null",
    );
  } catch {}
  settings = {
    ...defaults,
    ...settings,
    audio: { ...defaults.audio, ...settings?.audio },
    controller: { ...defaults.controller, ...settings?.controller },
  };
  for (const key of ["master", "sfx", "music"])
    if (
      !Number.isFinite(settings.audio[key]) ||
      settings.audio[key] < 0 ||
      settings.audio[key] > 1
    )
      settings.audio[key] = defaults.audio[key];
  if (
    !Number.isFinite(settings.controller.deadzone) ||
    settings.controller.deadzone < 0.1 ||
    settings.controller.deadzone > 0.8
  )
    settings.controller.deadzone = 0.28;
  const persist = () => {
    try {
      localStorage.setItem(
        "scratchpad-production-settings-v1",
        JSON.stringify(settings),
      );
    } catch {}
  };
  const balanceData = deepFreeze(source.balance);
  function value(id) {
    const v = balanceData.tuning[id]?.value;
    if (!Number.isFinite(v)) throw Error("Unknown balance field " + id);
    return v;
  }
  function formatEntities(table) {
    return Object.fromEntries(
      Object.entries(table).map(([id, item]) => {
        const ordinal = (n) =>
          [
            "zeroth",
            "first",
            "second",
            "third",
            "fourth",
            "fifth",
            "sixth",
            "seventh",
            "eighth",
            "ninth",
            "tenth",
          ][n] || n + "th";
        const tokens = {
            ...item,
            healthPercent: Math.round((item.healthFraction || 0) * 100),
            poisonTurns: Math.min(
              balanceData.abilities.poison.maxTurns,
              balanceData.abilities.poison.baseTurns + (item.poison || 0),
            ),
            stimulantTurns:
              balanceData.abilities.stimulant.baseTurns +
              Math.min(
                balanceData.abilities.stimulant.maxExtraTurns,
                item.stimulant || 0,
              ),
            stunEveryOrdinal: ordinal(item.stunEvery),
            stimEveryOrdinal: ordinal(item.stimEvery),
          },
          format = (text) =>
            text.replace(/\{(\w+)\}/g, (_, key) => tokens[key] ?? "?");
        return [
          id,
          {
            ...structuredClone(item),
            brief: format(item.brief),
            description: format(item.description),
          },
        ];
      }),
    );
  }
  const items = () => formatEntities(balanceData.items),
    equipment = () => formatEntities(balanceData.equipment);
  const entries = new Map(source.assets.map((a) => [a.id, a])),
    used = new Set();
  function asset(id) {
    used.add(id);
    const a = entries.get(id);
    if (!a) {
      report("Missing asset: " + id, "A retained placeholder will be used.");
      return null;
    }
    return a;
  }
  function render(id, context, fallback) {
    const a = asset(id);
    if (!a) return fallback?.() || "";
    if (
      a.replacementStatus === "placeholder" &&
      ["icon", "procedural"].includes(a.renderMode)
    )
      return fallback?.() || "";
    const box =
      a.viewBox ||
      (id.startsWith("icon.") || id.startsWith("floor.")
        ? "0 0 32 32"
        : "0 0 120 150");
    return `<svg class="manifest-image" data-asset="${a.id}" viewBox="${box}" aria-hidden="true"><image href="${a.url}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet"/></svg>`;
  }
  function iconPaths() {
    return Object.fromEntries(
      [...entries.values()]
        .filter((a) => a.id.startsWith("icon."))
        .map((a) => [
          a.alias,
          (a.text || "").match(/<path\s+d="([^"]+)"/)?.[1] || "",
        ]),
    );
  }
  return {
    settings,
    persist,
    errors,
    report,
    build: source.build,
    balance: { data: balanceData, value, items, equipment },
    assets: { get: asset, render, iconPaths, used, entries },
    input: null,
    audio: null,
    ui: null,
  };
})();
