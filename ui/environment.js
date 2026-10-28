// Purposeful graphite overlays. No gameplay RNG, timing or room mutations here.
const ENVIRONMENT_SKETCHES = Object.freeze({
  root: "M1 29q10-13 5-26m0 12 7-5 3-9m-4 19 9-4 4-10M9 24l12 6 8-5M1 15l9 4m7-5 8 8M2 30l12-4 15 5",
  heartwood:
    "M13 30l2-12-6 5-6-3 8-6-6-2 5-6 6 3 3-7 5 8 6 2-5 5 5 5-11-2 1 8 5 3Zm1-17 2 2m5-2-2 2m-4 4 6-1M3 30l7-3m12 1 8 3",
  clearing:
    "M16 3v4m0 18v4M3 16h4m18 0h4M6 6l3 3m14 14 3 3M6 26l3-3M23 9l3-3M10 16a6 6 0 1 0 12 0 6 6 0 1 0-12 0",
  lantern:
    "M12 7V4q4-5 8 0v3M9 9l14-1-2 20-11 1Zm1 4 12-1M9 25l13-1M16 14q-6 8 0 9 5-1 0-9M5 16H1m25 0h5M4 5l4 3m17-1 4-3",
  crust:
    "M2 6l9-4 8 3 10-1 1 24-10 2-9-3-9 2Zm9-4 3 10-5 6 3 9m2-15 8-2 7 5m-9 15 1-11-7-7M4 24l3-2m17 3 3-2",
  fault: "M1 15l9-3 4 5-3 5 7 2-2 7M14 17l8-8 9-2M22 9l-3-7M2 27l5-2m16-3 7 3",
  collapse:
    "M1 3l10-2 8 4 11-2 1 26-12 2-8-4-10 2Zm4 9 6-5 5 9-8 3Zm14 8 6-5 4 10-8 2ZM14 4l4 6m-8 15 5 4",
  corridor:
    "M2 3h11v26H2Zm17 0h11v26H19ZM3 10h9M3 20h9m8-6h9m-9 9h9M14 12l3 4-3 4m4-8-3 4 3 4",
});
function environmentSketch(kind) {
  const path = ENVIRONMENT_SKETCHES[kind] || ENVIRONMENT_SKETCHES.root;
  return `<svg class="pencil-art environment-sketch" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"/><path opacity=".22" transform="translate(.45 -.3)" d="${path}"/></svg>`;
}
function environmentDescription(c) {
  if (!c?.env || !c.seen) return "";
  const e = environmentState(),
    v = c.env,
    i = state.map.indexOf(c);
  if (v.heartwood)
    return "Heartwood — optional boss; rich spoils, and victory withers all roots";
  if (v.root)
    return "Root barrier — fight to clear it permanently; the room beneath stays intact";
  if (v.clearing)
    return "Sunlit clearing — scouts its four neighbours on entry and keeps roots away";
  if (v.lantern)
    return "Lantern island — lights on entry; visited neighbouring passages stay clear";
  if (v.crust !== undefined) {
    const f = e?.crust.find((s) => s.id === v.crust);
    return f
      ? `Cooling crust — ${f.phase}; ${f.remaining} move${f.remaining === 1 ? "" : "s"} until ${f.phase === "molten" ? "hardening" : "melting"}${f.phase === "molten" ? "; impassable" : "; holds while occupied"}`
      : "";
  }
  if (v.fault) {
    const f = e?.faults.find((s) => s.tile === i);
    return f?.stage === "collapsed"
      ? "Collapsed fault — impassable rubble"
      : f?.stage === "dormant"
        ? ""
        : "Fault line — " +
          (f?.stopped
            ? "settled; remains traversable"
            : f?.stage === "unstable"
              ? "unstable; collapse approaching"
              : "hairline cracks; still traversable");
  }
  if (v.corridor)
    return `Shifting corridor — walls change in ${ENVIRONMENT_TUNING.corridorInterval - (e.moves % ENVIRONMENT_TUNING.corridorInterval)} moves`;
  return "";
}
function environmentTileClasses(c, i) {
  if (!c.seen) return "";
  const v = c.env || {},
    classes = [];
  for (const k of [
    "root",
    "heartwood",
    "clearing",
    "lantern",
    "corridor",
    "collapsedFault",
  ])
    if (v[k]) classes.push("environment-" + k);
  if (
    environmentLight(state.map, i, "clearings") ||
    environmentLight(state.map, i, "lanterns", true)
  )
    classes.push("environment-lit");
  if (v.crust !== undefined)
    classes.push(
      "environment-crust",
      "crust-" +
        (environmentState()?.crust.find((f) => f.id === v.crust)?.phase ||
          "molten"),
    );
  return classes.join(" ");
}
function environmentTileMarkup(c, i) {
  const v = c.env;
  if (!v) return "";
  const preview = !c.seen && neighbors(state.position).includes(i);
  if (!c.seen && !preview) return "";
  const e = environmentState(),
    f = v.fault ? e?.faults.find((f) => f.tile === i) : null;
  const kind = v.heartwood
    ? "heartwood"
    : v.root
      ? "root"
      : v.clearing
        ? "clearing"
        : v.lantern
          ? "lantern"
          : v.crust !== undefined
            ? "crust"
            : f && f.stage !== "dormant"
              ? f.stage === "collapsed"
                ? "collapse"
                : "fault"
              : v.corridor
                ? "corridor"
                : null;
  if (!kind) return "";
  const active = (
    v.clearing ? e?.clearings : v.lantern ? e?.lanterns : []
  )?.some((s) => s.tile === i && s.active);
  return `<span class="environment-overlay environment-${kind}-art ${preview ? "terrain-preview" : ""} ${active ? "landmark-active" : ""} ${f?.stage === "unstable" && !f.stopped ? "fault-unstable" : ""}" aria-hidden="true">${environmentSketch(kind)}</span>`;
}
function renderEnvironmentEdges() {
  document.getElementById("environment-connections")?.remove();
  const e = environmentState();
  if (!e?.corridors.length) return;
  const lines = [];
  for (const s of e.corridors)
    for (const [a, b] of s.edges) {
      if (
        environmentEdgeOpen(state.map, a, b) ||
        (!state.map[a].seen && !state.map[b].seen)
      )
        continue;
      const ax = a % W,
        ay = Math.floor(a / W),
        bx = b % W,
        by = Math.floor(b / W);
      lines.push(
        ax === bx
          ? `M${ax + 0.05} ${Math.max(ay, by)}h.9`
          : `M${Math.max(ax, bx)} ${ay + 0.05}v.9`,
      );
    }
  if (!lines.length) return;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.id = "environment-connections";
  svg.classList.add("environment-connections");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = lines
    .map(
      (d) =>
        `<path d="${d}" class="sliding-wall-paper"/><path d="${d}" class="sliding-wall-ink"/>`,
    )
    .join("");
  $("#map-board").append(svg);
}
function environmentalFeedback(tiles, kind) {
  const visible = tiles.filter((i) => state.map[i]?.seen);
  if (!visible.length) return;
  const colour = ["clearing", "lantern"].includes(kind)
    ? "gold"
    : ["roots", "wither"].includes(kind)
      ? "heal"
      : "dust";
  for (const i of visible) {
    const el = $(`[data-tile="${i}"]`);
    if (!el) continue;
    burst(el, colour, kind === "collapse" ? 24 : 9);
    const light = ["clearing", "lantern"].includes(kind);
    const peak = 0.15 + visible.indexOf(i) * 0.1;
    animate(
      el,
      light
        ? [
            { filter: "brightness(1)", offset: 0 },
            { filter: "brightness(1.3)", offset: Math.min(0.75, peak) },
            { filter: "brightness(1)", offset: 1 },
          ]
        : [{ filter: "brightness(1.22)" }, { filter: "brightness(1)" }],
      {
        duration: 420,
        juice: true,
      },
    );
    if (["roots", "fault"].includes(kind)) {
      for (const path of el.querySelectorAll(".environment-overlay svg path")) {
        const length = path.getTotalLength();
        path.style.strokeDasharray = length;
        const motion = animate(
          path,
          [{ strokeDashoffset: length }, { strokeDashoffset: 0 }],
          { duration: 420, juice: true },
        );
        motion?.finished
          .catch(() => {})
          .finally(() => {
            path.style.strokeDasharray = "";
          });
      }
    }
  }
  if (["seismic", "corridor", "collapse"].includes(kind)) {
    // A quake moves the map; a corridor shift moves only its drawn wall edges.
    shakeElement(
      $(kind === "corridor" ? "#environment-connections" : "#map-wrap"),
      kind === "seismic" ? 5 : 2,
      "rumble",
    );
    GameSound.play("rockDrop");
  } else if (["roots", "wither"].includes(kind)) GameSound.play("poof");
  else if (["clearing", "lantern"].includes(kind)) GameSound.play("reward");
}

function renderEnvironmentStatus() {
  const e = environmentState();
  if (!e || travel) return;
  const notes = [];
  if (e.heartwood?.alive)
    notes.push(
      `Root growth in ${ENVIRONMENT_TUNING.rootInterval - (e.moves % ENVIRONMENT_TUNING.rootInterval)} moves`,
    );
  if (e.seismic)
    notes.push(
      `Tremor in ${e.seismic.interval - (e.moves % e.seismic.interval)} moves`,
    );
  if (e.corridors.length)
    notes.push(
      `Walls shift in ${ENVIRONMENT_TUNING.corridorInterval - (e.moves % ENVIRONMENT_TUNING.corridorInterval)} moves`,
    );
  if (notes.length) $("#map-status").textContent = notes.join(" · ");
}
