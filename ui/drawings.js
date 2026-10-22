// Inline pencil illustrations. Presentation only: never consume gameplay RNG.
// Deliberate contours, short material hatching, and a faint second pencil pass.
// No decorative glyphs, image atlases, filters on text, or runtime network assets.
const pencilPathCache = new Map();
function pencilPath(source, amplitude = 0.85) {
  // Retain every endpoint and SVG subpath. Replace ruler-straight edges with a
  // very shallow pencil curve. Curves/arcs and their relative coordinates keep
  // their original geometry. A path-keyed hash makes the line stable across
  // renders, saves, screenshots and machines, without touching either game RNG.
  const key = amplitude + ":" + source;
  if (pencilPathCache.has(key)) return pencilPathCache.get(key);
  const tokens =
    source.match(/[a-zA-Z]|[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/g) || [];
  const arity = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7 };
  let cursor = 0,
    command,
    previousType,
    x = 0,
    y = 0,
    startX = 0,
    startY = 0;
  let hash = 2166136261;
  for (const c of source) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
  const noise = () => {
    hash = Math.imul(hash ^ (hash >>> 15), 2246822519);
    return ((hash >>> 0) / 4294967295) * 2 - 1;
  };
  const round = (n) => Number(n.toFixed(2));
  const output = [];
  function line(endX, endY) {
    const dx = endX - x,
      dy = endY - y,
      length = Math.hypot(dx, dy);
    if (!length) {
      output.push(`L${round(endX)} ${round(endY)}`);
      return;
    }
    const bend = Math.min(amplitude, length * 0.045);
    const n1 = noise() * bend,
      n2 = noise() * bend;
    output.push(
      `C${round(x + dx / 3 - (dy / length) * n1)} ${round(y + dy / 3 + (dx / length) * n1)} ${round(x + (dx * 2) / 3 - (dy / length) * n2)} ${round(y + (dy * 2) / 3 + (dx / length) * n2)} ${round(endX)} ${round(endY)}`,
    );
    x = endX;
    y = endY;
  }
  while (cursor < tokens.length) {
    if (/^[a-z]$/i.test(tokens[cursor])) command = tokens[cursor++];
    if (!command) return source;
    const type = command.toLowerCase(),
      relative = command === type;
    if (type === "z") {
      output.push("Z");
      x = startX;
      y = startY;
      command = null;
      previousType = type;
      continue;
    }
    const count = arity[type];
    if (
      !count ||
      tokens.length - cursor < count ||
      tokens.slice(cursor, cursor + count).some((t) => /^[a-z]$/i.test(t))
    )
      return source;
    const values = tokens.slice(cursor, cursor + count).map(Number);
    cursor += count;
    if (type === "m") {
      x = values[0] + (relative ? x : 0);
      y = values[1] + (relative ? y : 0);
      startX = x;
      startY = y;
      output.push(`M${round(x)} ${round(y)}`);
      command = relative ? "l" : "L";
    } else if (type === "l") {
      line(values[0] + (relative ? x : 0), values[1] + (relative ? y : 0));
    } else if (type === "h") {
      line(values[0] + (relative ? x : 0), y);
    } else if (type === "v") {
      line(x, values[0] + (relative ? y : 0));
    } else {
      // A converted line is a cubic now. Preserve the original smooth-curve
      // reflection rule when an S command follows that line.
      if (type === "s" && previousType !== "c" && previousType !== "s")
        output.push((relative ? "c0 0 " : `C${x} ${y} `) + values.join(" "));
      else output.push(command + values.join(" "));
      x = values[count - 2] + (relative ? x : 0);
      y = values[count - 1] + (relative ? y : 0);
    }
    previousType = type;
  }
  const result = output.join(" ");
  pencilPathCache.set(key, result);
  return result;
}

function pencilIllustration(svg) {
  if (/<svg class="pencil-art\b/.test(svg)) return svg;
  svg = svg.replace(
    /<svg(?: class="([^"]*)")?/,
    (_, classes = "") => `<svg class="pencil-art ${classes}"`,
  );
  const fills = [
    "#dfd5bd",
    "#d7ccb1",
    "#dfd4b9",
    "#c2ad91",
    "#d4c5a6",
    "#c4b295",
    "#b8a08b",
    "#ad9872",
    "#c6b99b",
    "#d9cfb4",
    "#c3b392",
    "#cbbd9f",
  ];
  for (const colour of fills)
    svg = svg.replaceAll(colour, "var(--paper-shade)");
  svg = svg
    .replaceAll("#ece3cd", "var(--paper)")
    .replaceAll("#e7dcc0", "var(--paper)")
    .replaceAll("#58473c", "currentColor")
    .replaceAll("#625343", "currentColor")
    .replaceAll("#73604d", "currentColor")
    .replaceAll("#72664e", "currentColor");
  // An offset contour, rather than arbitrary scribbles. Keep status marks untouched.
  const bodyStart = svg.includes("</defs>")
    ? svg.indexOf("</defs>") + 7
    : svg.indexOf(">") + 1;
  const body = svg
      .slice(bodyStart)
      .replace(/\bd="([^"]+)"/g, (_, d) => `d="${pencilPath(d)}"`),
    first = body.match(/<path\b[^>]*\bd="([^"]+)"[^>]*\/>/);
  if (first)
    svg =
      svg.slice(0, bodyStart) +
      `<path class="pencil-echo" d="${first[1]}" transform="translate(.9 -.7)"/>` +
      body;
  return svg;
}

function heroPortraitArt(kind, entity) {
  const id = "portrait-shade-" + artSerial++;
  const tank = kind === "fighter" || kind === "hero";
  const hurt = entity.hp / entity.maxHp < 0.35,
    bruised = entity.hp / entity.maxHp < 0.7;
  const shade = `url(#${id})`;
  const definitions = `<defs><pattern id="${id}" width="4.5" height="5" patternUnits="userSpaceOnUse"><path d="m-1 5 6-6m-1 7 3-3" stroke="currentColor" stroke-width=".65" opacity=".38"/></pattern></defs>`;
  const eyes = hurt
    ? '<path d="m44 53 11 3m11 0 10-4m-31 1 4 5m21-3 4 3"/>'
    : '<path d="M44 53q5-4 11 0m11 0q5-4 10-1M49 53v3m22-4v3"/>';
  const face = `<path d="M39 39q20-16 42 0l-4 29q-5 15-16 20-15-5-20-20Z" fill="var(--paper)"/>
    ${eyes}<path d="m60 55-3 11 6 1M${hurt ? "54 77q7-7 14 0l-1 4H55Z" : bruised ? "54 77q7-5 14-1" : "55 76q6 3 12-1"}"/>
    <path d="m42 61 6 3m26-3-4 4m-23-17 8-1m13 0 8-2" stroke-width=".8" opacity=".75"/>`;
  let drawing;
  if (tank) {
    drawing = `<path d="M14 145q2-31 16-43l16-13 31 1q25 16 28 55" fill="var(--paper-shade)"/>
      <path d="m17 118 20-19 24 11 23-11 19 18-9 26H27Z" fill="${shade}"/>
      <path d="M32 58q-4-39 14-48 16-11 31 0 14 11 12 44l-9 28-18 11-24-16Z" fill="var(--paper-shade)"/>
      <path d="M37 36q4-28 25-29 20 1 23 29L62 43Z" fill="var(--paper)"/>
      <path d="m36 39 26 6 24-7-1 17-22 9-25-9Z" fill="${shade}"/>
      <path d="m42 ${hurt ? "48 12 4" : "46 13 2"}m11 ${hurt ? "-1 12-3" : "0 12-2"}M61 10l1 30m-23 18 4 20 18 12 17-10 5-22M50 64v13m8-10v15m9-16v15m8-18-1 13M25 114l16 8 20-8 19 8 19-10M61 115v28M31 125l5 15m49-15-3 15"/>
      <path d="m36 20-4 14m52-10 5 17M22 130l7-6m-6 12 8-6m55 5 6-6m-6 11 8-7" stroke-width=".75" opacity=".65"/>
      <circle cx="61" cy="106" r="4"/>
      ${hurt ? '<path d="m39 39 13 8m-12-3 11 9m27-15-6 10" stroke="var(--red)"/>' : ""}`;
  } else {
    drawing = `<path d="M12 146q5-38 23-54l-5-40Q20 7 57 4q40-4 37 46l-7 43q20 22 22 53Z" fill="var(--paper-shade)"/>
      <path d="M33 86Q8 39 40 12q26-20 47 9 10 20-4 62l-11 13 25 48H22l26-48Z" fill="${shade}"/>
      ${face}
      <path d="M34 49q3-23 20-32 8 18 30 29M40 41q-4 24 6 47l13 11m23-58q7 21-3 45l-13 14M48 93l-21 50m47-50 23 50M30 124l15-15m36 3 10 13M35 140l14-18m28 2 14 16"/>
      <path d="m31 42 5-17m-7 30 4-14m53-10 3 18m-57 64 12-18m-14 27 12-17m40 21 9 13" stroke-width=".7" opacity=".6"/>
      <path d="m52 98 9-9 10 9-9 10Z" fill="var(--paper)"/><circle cx="61" cy="98" r="3"/>`;
    if (kind === "healer")
      drawing +=
        '<path d="M55 23h12m-6-6v13M52 124h18m-9-9v19" stroke-width="2"/>';
    if (kind === "rogue")
      drawing +=
        '<path d="m23 137 15-23 5 3-17 24m7-18 11 8M48 35q4 8 1 15m26-15-2 15"/>';
    if (kind === "ranger")
      drawing +=
        '<path d="M94 87q27 26-1 58l7-29Z" fill="var(--paper)"/><path d="m93 87 7 29-7 29m-6-29 29 0m-6-5 6 5-6 5M26 94l-7 50m3-50 13 48M31 9l15-3 5 8-18 8"/><path d="m15 112 18 17m-16-9 15 17m-13-4 12 9" stroke-width=".7"/>';
    if (kind === "mage")
      drawing +=
        '<path d="M27 38Q45 21 58 1q10 20 32 36l9 4-38 5-40-2Z" fill="var(--paper-shade)"/><path d="m48 28 11-18 4 17m-37 12 66 1M92 143l7-71m-4-6 5-10 6 9-7 8Z"/>';
  }
  return `<svg class="hero-illustration" viewBox="0 0 120 150" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${definitions}${drawing}</svg>`;
}

function leverArt() {
  // Only this SVG moves. Its enclosing button remains a stationary hitbox.
  return `<svg class="pencil-art" viewBox="0 0 35 100" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m7 78 11-.5.5 13-12 .5Z M14 78l8-56 4 .5-7 57" fill="var(--paper-shade)"/><path d="m15 76 8-53m-15 60 8-.5m-8 5 8-.5M7 95l18-.5" stroke-width=".7"/><path d="M25 2q12 1 11 12-1 10-12 10-10-1-10-12Q15 2 25 2Z" fill="var(--paper)"/><path d="M25 5q9 1 8 9-1 8-9 7-7-1-7-8 0-7 8-8Zm-7 8 6-7m-6 12L30 6m-7 15 10-10" stroke-width=".65"/><path class="pencil-echo" d="m5 79 1 14 14-1M13 77l8-53"/></svg>`;
}
const paths = {
  bow: "M10 3Q29 16 10 29L17 16ZM5 16h23m-5-4 5 4-5 4M10 3l7 13-7 13",
  sword: "M6 23 23 6l3-1-1 3L9 26M5 19l8 8M7 25l-3 3m1-4 3 3",
  heal: "M13 5h6v8h8v6h-8v8h-6v-8H5v-6h8z",
  block: "m16 3 11 5v8c0 7-11 13-11 13S5 23 5 16V8z M16 8v15",
  stun: "m18 2-11 16h8l-1 12 12-18h-9z",
  treasure:
    "M3 14V9c1-8 25-8 26 0v18H3z M3 14h26 M4 19h24 M13 15h6v8h-6z M7 6v8m18-8v8M7 20v7m18-7v7 M8 8h2m12 0h2",
  trap: "m3 26 6-14 6 14 5-18 9 18z M5 7l3-3m17 1 3 3",
  well: "M4 19c1-5 23-5 24 0v9H4z M4 19c2 5 22 5 24 0 M8 16V8h16v8 M3 8 16 2l13 6z M16 9v12 M11 25v3m10-6v6 M18 12h5v8h-5z",
  beacon:
    "M10 28h12M12 24h8l3-11H9z M16 25v3M15 12c-8-5 1-9 1-12 9 9 6 11 2 12 M6 5l-3-3m23 4 4-3M3 13H0m29 0h3 M10 15l2 6m8-6-2 6",
  recruit:
    "M16 4a5 5 0 1 0 0 10 5 5 0 0 0 0-10 M6 28v-5c0-10 20-10 20 0v5 M4 17v8m-4-4h8",
  stairs:
    "M3 29V15C3-4 29-4 29 15v14H3z M8 29V15c0-13 16-13 16 0v14 M8 24h7v-5h6v-5h3 M2 13h6m16 0h6M3 22h5m16 0h5 M15 5v4",
  hero: "M8 12c0-13 16-13 16 0l-4 4v6H12v-6z M7 10h18M16 4v7M5 29l3-8 8 5 8-5 3 8 M13 15h1m4 0h1",
  rogue:
    "M5 15C4-1 28-1 27 15l-5-3-6 3-6-3z M10 14v6l6 4 6-4v-6 M7 29l3-7m12 0 3 7 M12 17h2m4 0h2",
  magic:
    "M4 27 22 9m-4-4 9 9M6 7l2-5 2 5 5 2-5 2-2 5-2-5-5-2z M23 22l2-5 2 5 4 2-4 2-2 5-2-5-4-2z",
  poison:
    "M10 6h12l-3 7v3c11 11 5 15-3 15S2 27 13 16v-3z M10 6V2h12v4M11 23l3 3m0-3-3 3m7-3 3 3m0-3-3 3",
  flame:
    "M15 30C-2 25 6 12 12 11c-2 8 3 9 4 4 4-9 0-10 3-14 1 10 14 15 8 24-3 5-7 6-12 5z M14 27c-7-4-2-7 3-12-1 7 7 8-3 12z",
  class: "m16 2 4 9 10 1-7 7 2 10-9-5-9 5 2-10-7-7 10-1z",
  blessing: "M16 3v20M7 12h18M3 28q13-10 26 0M6 19l2 4m18-4-2 4",
  flurry: "m3 26 17-22 3 3L6 29z M10 27 26 8l3 3-16 19z M1 14l10-12 3 3L4 17z",
  mage: "M5 15 16 1l11 14zM3 15h26 M10 17v7l6 5 6-5v-7M16 4l-2 7h5",
  healer:
    "M7 12C7 0 25 0 25 12l-5 2-4-4-4 4z M10 13v7l6 5 6-5v-7 M6 29l4-6m12 0 4 6 M15 3v6m-3-3h6",
  skull:
    "M5 15c-6-17 28-17 22 0l-4 6v6H9v-6z M10 12l4 3-4 2zm12 0-4 3 4 2z M15 20h2M13 24v3m6-3v3",
  rat: "M4 22 7 12l6 3 9-1 6 8-8 5H9z M8 13C-3 1 17 1 12 14 M22 14C16 1 35 4 26 17 M3 22c-8 0 0 9 4 7 M13 20h1m6 0h1 M14 25l3-2 3 2",
  ghost: "M5 29V13c0-15 22-15 22 0v16l-6-4-5 4-6-4z M10 12v5m11-5v5 M14 21h4",
  slime:
    "M3 26C-1 21 6 17 8 11c4-13 13-5 15 3 3 4 9 8 6 12z M11 17h1m7 0h1 M12 22c3 3 6 2 7-1",
  bag: "M9 3h14l-3 7c15 17 9 20-4 20S-3 26 12 10zM10 10h12M13 6h7",
  bandage: "m3 19 16-16 10 10-16 16zM12 10l10 10M10 12l10 10M13 17h1m3-4h1",
  antidote: "M12 2h8v9l6 10c5 12-26 12-20 0l6-10zM9 5h14M10 21h12m-6-6v12",
  salve: "M5 12h22v16H5zM4 8h24v5H4zM11 21h10m-5-5v10",
  frost:
    "M16 2v28M4 9l24 14M4 23 28 9M12 4l4 4 4-4M12 28l4-4 4 4M4 14l5-1-1-5m16 1-1 5 5 1M4 18l5 1-1 5m16-1-1-5 5-1",
  oil: "M12 3h8v6l4 6v14H8V15l4-6zM12 3v5h8M16 15c-10 11 10 11 0 0z",
  ration: "M3 18C0 5 29 4 29 18v10H3zM8 13l4 9m3-11 4 11m3-10 3 9M4 25h23",
  chalk: "m5 23 17-20 7 6-17 20-7 2zM6 23l7 6M20 5l7 6",
  potion:
    "M12 3h8v5l5 9c8 15-26 15-18 0l5-9z M11 3h10 M8 18h16 M13 21h6m-3-3v6",
  seed: "M16 28V15 M16 20C-2 18 4 0 16 12c11-13 20 5 0 8 M16 12V5",
  camp: "m3 27 13-22 13 22z M11 27l5-13 5 13 M16 5V1 M5 8l-3-3m26 5 3-3",
  eye: "M2 16s6-10 14-10 14 10 14 10-6 10-14 10S2 16 2 16z M16 11a5 5 0 1 0 0 10 5 5 0 0 0 0-10",
  coin: "M16 3c17 0 17 26 0 26S-1 3 16 3z M16 6c13 0 13 20 0 20S3 6 16 6z M20 10c-9-6-12 9-2 6 7-2 2 10-5 5 M16 8v16",
  point: "m5 23 17-18 5 4-17 18-7 2z M19 8l5 4 M5 23l5 4 M2 31h28",
  bomb: "M13 8h7v5c18 7 8 24-5 16C2 26 4 16 13 13z M17 8c-2-8 9-5 7-2 M25 2v-2m3 6 4-2m-2 7h-4 M9 20l2-3",
  ward: "M4 14 16 2l12 12-12 16z M9 15l7-8 7 8-7 9z M13 15h6m-3-3v8",
  safe: "m4 16 8 9L29 5 M3 6l4-3m18 24 4 2",
  miss: "M7 7l18 18M25 7 7 25 M5 5l3-1m16 23 4-1",
  floor: "m4 24 7-2 6 2 10-3M7 11l4-2 4 2-4 3z M21 14l4-1 3 2-4 2z M16 5l-1 3",
  wall: "M2 3.5 30 3 29.5 29 2.5 28.5Z M3 12l26-.5M3 21l26 .5M10 4l.5 7m11.5 1-.5 9M12 22l.5 6m14-24-.5 7M4 5l4 .5-.5 4-3 .5Zm9-.5 11-.5-.5 5.5-10 .5ZM4 14l14-.5.5 5-14 .5Zm19 0h5l-.5 5H23ZM4 23l6 .5-.5 3.5-5 .5Zm11 0 12 .5-.5 3.5-11.5-.5",
  shop: "M3 14 7 4h18l4 10M3 14q3 7 6 0 4 7 7 0 4 7 7 0 4 7 6 0M5 18v11h22V18 M10 29V19h8v10m4-8h3M6 4h20",
  artefact:
    "M10 5h12l5 10-11 15L5 15z M10 5l6 10 6-10M5 15h22M16 15v15M2 3l4 3m22-3-3 3",
  blank: "M16 3a13 13 0 1 0 0 26 13 13 0 1 0 0-26 M7 7l18 18",
  river:
    "M2 4q7-4 14 0t14 0M2 12q7-5 14 0t14 0M2 20q7-5 14 0t14 0M2 28q7-4 14 0t14 0M8 7l3 1m10 8 5-1",
  puddle:
    "M4 19q-6-10 7-11 8-13 14 1 12 4 3 15-9 10-24-5z M8 17q7-7 16 0M10 22q5-3 10 0",
  sound: "M3 19v-6h6l7-6v18l-7-6z M21 10q8 6 0 12m4-16q13 10 0 20",
  glimmer: "m16 1 4 11 11 4-11 4-4 11-4-11-11-4 11-4z M27 2v6m-3-3h6",
  water: "M16 2C9 12 4 17 7 24c4 9 19 7 20-3 0-5-5-12-11-19z M11 19q-3 5 3 7",
  draft: "M2 10h20q11 0 6-7-4-4-7 1M2 16h14q10 0 8 9-2 6-7 2M3 22h7",
  bridge:
    "M2 8q14 5 28 0M2 24q14 5 28 0M4 12h24v9H4z M7 12v9m5-9v9m5-9v9m5-9v9m5-9v9M4 7v20m24-20v20",
  ruin: "M3 29h26M5 27V13h5v14m12 0V9h5v18M3 13l7-4 5 4-5 3z M19 9l7-5 4 5M13 26l4-8 4 8M5 7l3-4m11 0h5",
  stronghold:
    "M3 28V7h6v5h5V7h5v5h5V7h5v21H3z M12 28v-9q4-8 8 0v9M5 20h3m16-1h3",
  rage: "M7 28V15l-3-5 4-3 4 4V4h5v7-8h5v9-6h5v12l-5 10z M8 15l7 3 8-3M4 26H0m29-9h3M4 3l-3-2",
  pursuer:
    "M3 29 7 10 16 2l9 8 4 19-8-6-5 7-5-7z M10 13l4 2m8-2-4 2M14 21h4 M1 6l4 2m22-4 4-2",
};
function icon(name) {
  if (name === "wall") return wallArt();
  const line = pencilPath(paths[name] || paths.sword, 0.32);
  return `<svg class="pencil-art pencil-icon" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path class="pencil-echo" d="${line}" transform="translate(.38 -.28)"/><path d="${line}"/></svg>`;
}

// Chunky, staggered masonry, shared by map and legend. Explicit graphite
// shadows make this terrain read as a barrier even without a colour cue.
function wallArt() {
  const bricks = [
    "M1.8 2.1 14.3 1.7 14 9.4 2.2 9.8Z",
    "M16.2 2 30.1 2.4 29.7 9.7 16.4 9.2Z",
    "M2 11.5 7.7 11.2 8 20 1.8 20.3Z",
    "M10 11.3 24 11.5 23.6 20.2 10.2 19.6Z",
    "M26 11.3 30.2 11.5 29.8 20.1 25.7 19.8Z",
    "M2.2 22 15 21.8 14.6 29.9 1.9 29.5Z",
    "M17 22 29.9 21.6 30.1 29.5 17.2 30Z",
  ];
  return `<svg class="pencil-art pencil-icon masonry-art" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M.5 1 31.3.5 31.6 31 1 31.5Z" fill="var(--paper-shade)" stroke-width="1.1"/>${bricks.map((d) => `<path d="${pencilPath(d, 0.25)}" fill="var(--paper)" stroke-width=".85"/>`).join("")}<path d="M3 8.2 12.4 8m5.8.1 9.5.2M3 18.4l3.2-.3m5.7-.2 9.8.4m5.2-.3h1.5M3.4 28l9.3.2m6.1.1 9-.4M3 4l2-1m7 3 1-2m5 1 3-1m5 3 2-2M3 13l2-.5m6 1 3-1m5 3 3-2M3 24l2-1m5 2 3-1m5 1 3-2m4 4 3-2" stroke-width=".55" opacity=".6"/><path d="m1 2-.2 12m30-8 .3 17M5 31l12-.2" stroke-width=".5" opacity=".5"/></svg>`;
}

let artSerial = 0;

function specialEnemyArt(kind, entity) {
  // Embedded original graphite illustration. Retain the portrait SVG contract
  // so injuries, corpses, targeting and action choreography work as before.
  if (kind === "gnawer")
    return `<svg class="pencil-art horror-art species-gnawer pencil-scan" viewBox="0 0 120 150" aria-hidden="true"><image href="@asset(illustrations/candle-gnawer.png)" x="0" y="0" width="120" height="150" preserveAspectRatio="xMidYMid meet"/></svg>`;
  const body = {
    moth:
      "M53 57Q18 13 8 46q-13 29 39 48-37 2-31 31 14 24 40-22M69 57q35-45 44-10 10 28-39 47 37 2 29 31-15 23-39-22M49 57q11-18 23 0l-3 58-10 15-9-16ZM51 64l18 2m-20 10 20 2m-19 10 18 1m-17 11 16 1M54 49 42 26m25 23 14-25M20 55l16 14-13 6Zm77 0-15 15 13 5ZM30 107l12-2-10 15m55-14-13-2 8 16M53 56l5 3m5 0 5-4",
    rustmite:
      "M28 57q-11-39 33-44 42 5 34 46l-8 52-26 20-29-17ZM35 49q23-16 52-1M32 65l27-9 32 8M31 82l29-8 29 8M33 100l27-8 28 8M60 18v107M38 112l-18 16-10-2m72-14 19 17 10-4M29 60 11 50 4 61m88 0 17-12 7 14M29 82 9 86 4 98m86-16 18 4 7 12M49 128l-9 13 15-5m17-8 9 13-15-4M45 35l9 2m13 0 10-3M38 27l9-4m27 1 8 5m-39 43 8-4m17 4 10 3",
    sporepilgrim:
      "M18 57Q12 20 56 9q41 1 48 46l-11 10H31ZM30 57l58 1M41 60l4 35 15 10 16-12 6-33M44 75l9 3m11 0 8-3M54 91l12 1M43 92l-19 45 34 8 39-9-19-44M48 104l-7 32m30-31 12 28M26 117 9 105l-5 10 21 12m63-10 17-11 5 9-17 13M106 143l-2-68M25 34l12-8m-9 18 14-7m22-16 11 6m5 12 12 6M12 74l1-4m95-39 2-4M7 93h4m81-11h5",
    mirrorhound:
      "M9 93l15-35 23-9 16 15 26-13 22 25-7 24-20 5-16-8-15 5-25-1ZM17 81l11-15 22-6 11 20-14 15-25-1ZM22 61l-7-30 24 21m11-1 16-22-4 37M24 79l9 3m8-3 8-3M25 91l17 2-6 7ZM57 77l20 9 22-16M73 57l8 22 15-23M27 99l-7 35 14 4 8-34m40 1 4 29 15 4-5-37M27 137l12 3m53-2 13 2M106 72l9-30-17-10M31 65l7 8-7 14m48 8 11-5 9 9M13 106l-6 10m104-7 6 7",
    ashcolossus:
      "M38 40 46 10 77 8l13 33-24 17ZM47 29l10 4m10 0 10-5M54 44l20-1M35 52l28 9 26-11 15 49-23 18-39-2-22-24ZM39 62l21 15 28-18M60 78l-4 28m9-23 16 23M27 58 6 76l6 31 21-10m62-37 21 18-2 29-21-7M41 114l-8 25 24 4 7-28m16 1 10 25 23-4-13-26M19 80l7 8-11 10m85-16 9 7-8 6M46 17l9 4m23-5-9 10M41 92l8-8m25 9 11 4M6 142h22m78 4h13M22 42l-6-7m88 1 6-6",
    bellkeeper:
      "M23 138 30 86l15-17-8-35 20-20 28 12 5 39 12 26 2 47z M39 38 77 24l9 35-12 19-24-4z M40 46l42-9m-38 16 40-9 M51 61l13 8 13-10 M31 89l25 18 34-26M56 107v31 M19 66 8 110l22 8 13-38z M12 109l16 7M17 118v11 M81 83l16-15 10 7-11 16 M102 40v35M90 51h24l-4-19-8-6-8 7z M98 53v8",
    widow:
      "M46 90C-5 82 16 36 48 52c-14-50 51-52 45-10 39 11 25 58-8 54l-20 17z M40 63l20-13 24 13-2 25-21 15-22-14z M47 68l9 7m12-2 9-8 M47 80l12 8 17-9M53 84l3 13m12-14-2 15 M35 84 9 90l-6 39m30-32-12 21 6 21M85 82l27 7 5 40m-27-31 10 21-5 21 M44 44l-9-20M83 40l15-20M35 119l26-14 27 14-26 23z",
    oracle:
      "M23 140 29 101l16-24-12-39 25-28 30 14 7 39-17 18 23 29 8 30z M36 41 58 22l28 13-9 35-20 14-14-15z M45 48q16-21 33 0-16 20-33 0z M61 41v16 M53 69h15 M45 84l16 18 15-18M61 103v36 M30 110l-14-8-7 9 23 15m62-13 17-17 8 9-19 23 M2 88h29m-14-14v28M90 14l8-11 13 4M20 60l-8-5 4-12",
    pageeater:
      "M11 137 17 86l-5-24 17-37 33-17 36 19 13 38-8 24 9 48z M21 64l23-26 37-3 22 31-14 26-55-2z M32 62l19 7 30-3 14-9-10 32-25 12-24-12z M35 65l7 15 7-9 10 18 10-17 9 11 12-20 M36 101l12-13 13 20 14-18 13 12M47 26l9 6m18-7-8 8 M23 110l-17 6 2 18 22-4m64-18 19 3 4 20-22-6M36 139l7-18m35 20-5-22",
    pursuer:
      "M13 143 23 110 16 86l20-34 1-24 25-25 27 24-3 29 18 27-7 26 12 35-24-12-21 14-19-12z M37 29l23-11 21 11-7 37-15 15-15-14z M45 45l10 3m12-3 9-3M53 62l14-1 M38 80 59 98l22-19M59 99v33 M25 88l-20 13 10 25 22-12m52-26 24 12-8 26-16-12 M17 142l-10 5m99-5 10 5",
  }[kind];
  if (!body) return null;
  return `<svg class="horror-art species-${kind}" viewBox="0 0 120 150" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${body}" fill="#d7ccb1"/><path d="m27 95 12-10m-12 17 10-9m-11 19 15-12m40 18 12-12m-10 20 12-13m-43 6 6-5" stroke-width=".8" opacity=".5"/></svg>`;
}

function portraitArt(kind, entity = { hp: 1, maxHp: 1 }) {
  let art =
    entity.hp > 0 && !entity.dead
      ? specialEnemyArt(kind, entity) || basePortraitArt(kind, entity)
      : corpseArt(kind);
  if (entity.hp <= 0 || entity.dead || entity.hp / entity.maxHp >= 0.7)
    return pencilIllustration(art);
  const severe = entity.hp / entity.maxHp < 0.35;
  const marks = `<g class="injury-marks" stroke="#ae493c" stroke-width="${severe ? 3.8 : 2.4}" fill="none" opacity=".95"><path d="m40 35 14 12m-15-7 12 12m19 2 12 5m-13 0 10 4"/>${severe ? '<path d="m34 94 17 13m-17-6 17 13m24-42-3 13m5-10-2 12M45 126l13 3"/><path d="m39 58 16 5" stroke="#f1e5c3" stroke-width="8"/><path d="m40 57 14 7m-9-6-1 5" stroke="#796248" stroke-width="1.2"/>' : ""}</g>`;
  return pencilIllustration(art.replace("</svg>", marks + "</svg>"));
}
function basePortraitArt(kind, entity = { hp: 1, maxHp: 1 }) {
  if (entity.hp <= 0 || entity.dead) return corpseArt(kind);
  if (["fighter", "hero", "healer", "rogue", "mage", "ranger"].includes(kind))
    return heroPortraitArt(kind, entity);
  if (["revenant", "demon", "lich", "abomination"].includes(kind))
    return horrorArt(kind, entity);
  const id = "hatch-" + artSerial++,
    health = entity.hp / entity.maxHp,
    hurt = health < 0.35,
    bruised = health < 0.7,
    dead = health <= 0;
  const hatch = `url(#${id})`,
    fill = "#dfd5bd",
    paper = "#ece3cd";
  let body = "";
  if (kind === "skull" || kind === "skeleton")
    body = `<path d="M25 143h75M51 53l-11 18-12 8-6-8m49-18 11 15 11 7 M54 88l-8 22 5 20-10 11m24-53 10 20-1 24 9 9 M50 109l-5 20m28-18 6 20"/><path d="M45 58h29v29l-14 8-15-9z" fill="${paper}"/><path d="M60 58v35m-14-26 13 4 14-4m-28 7 14 5 14-5m-28 7 14 5 14-5M44 88l15 7 17-7"/><path d="M43 39C25 0 91-1 77 38l-7 12H51z" fill="${fill}"/><path d="M46 24q3-8 10-2l-1 9-9 1zm20-2q9-7 10 3l-3 6h-7z" fill="#4d4637"/><path d="m60 31-3 6h6M52 42h17m-13-3v10m6-9v10m5-9v8M43 15l5-7m29 7-4-6"/>${bruised ? '<path d="m41 12 12 5-5 8m29-9-7 4 4 5M50 73l8 6"/>' : ""}${hurt ? '<path d="m71 33 10 4m-32 6-8 5M67 56l8 10" stroke="#8b5840"/>' : ""}<path d="m22 77-17-49 5-5 18 51M16 74l16-6m-7 9 3 9" fill="${paper}"/><path d="m88 70 20 7-2 32-16 12-14-20 1-24z" fill="${hatch}"/><path d="m89 76 13 5-2 24-10 9-9-15 1-19z M90 79v30m-7-15 18 1"/><circle cx="91" cy="94" r="5" fill="${paper}"/>`;
  else if (kind === "mimic")
    body = `<path d="M15 112 20 65h82l6 49-22 24H34z" fill="${hatch}"/><path d="m20 65 10-34 61-3 11 37-39 31z" fill="${fill}"/><path d="m22 62 39 18 38-18-3 39-32 19-37-16z" fill="#463b32"/><path d="m27 68 9 20 7-11 10 21 10-16 10 14 9-21 10 8 7-19M31 103l9-16 8 23 12-16 12 17 12-22 8 13" fill="${paper}"/><path d="M47 44l9 5m13-2 10-6M48 47v8m25-8v8M29 117l-9 17 24-3m40-11 21 16-26-2M19 60h83"/><path d="m61 35-2 32h11l-2-33z" fill="${paper}"/>`;
  else if (kind === "rat")
    body = `<path d="M27 127C-5 139 1 96 24 109M26 123C12 119 12 83 36 68l39-9 28 30-7 30-31 14z" fill="${hatch}"/><path d="M43 73C5 42 24 13 50 48l-1 23m26-10C75 15 108 19 105 56l-14 21" fill="${fill}"/><path d="M42 66C24 45 28 31 43 51m41 8c0-24 17-25 12-4"/><path d="m38 77 36-12 24 22 13 10-12 15-30 4-30-13z" fill="${paper}"/><path d="m50 82 7-4 3 7m20-8 7 5-3 5" fill="#4c4332"/><path d="m98 96 10 2-8 6z M64 99l11 6 15-4m-18 5 2 12 5-1 1-11 M31 113l-6 14 20 2m35-9 5 14h17 M32 91l-14-5m18 13-20 1m71-11 19-7m-17 17 23 6M24 111l5-6m8 14 7-7m17 13 4-6"/>${hurt ? '<path d="m42 80 11 9m-11-5 10 9m28 19 8 8" stroke="#8d4c38"/>' : ""}`;
  else if (kind === "ghost")
    body = `<path d="M18 136C30 99 8 98 31 59 10 0 99-9 94 52l-7 29 18 49-19-9-10 23-16-14-13 16-9-17z" fill="${hatch}"/><path d="M36 57C16 7 94 0 88 49L76 91l12 30-23-10-9 18-10-14-17 7 12-29z" fill="${paper}"/><path d="M45 41q10-13 13 0l-1 21-11-6zm24-2q14-10 12 4l-4 15-10 5z" fill="#514937"/><path d="M55 74q14-14 16 2v18l-14-2z M37 29l9-8m28-3 7 8 M32 93l-6 15m18-1-3 8m35-19 8 10M36 57 17 77l9 8m59-25 21 19-11 9"/>${hurt ? '<path d="m46 33 8 10m14 22 12 7m-32 35 8 5" stroke="#8d4c38"/>' : ""}`;
  else
    body = `<path d="M12 128C-2 116 20 105 26 82c-4-51 51-69 60-15 0 20 41 35 23 60-21 13-79 12-97 1z" fill="${hatch}"/><path d="M23 120c-8-11 20-27 18-42-8-39 32-40 32-7 0 29 36 31 23 50-18 8-55 9-73-1z" fill="${fill}"/><path d="m44 79 9 4-9 6zm27 0-9 4 9 6z" fill="#564a35"/><path d="M49 101q13 ${hurt ? "-7" : "10"} 23-1 M32 108l-4 6m60-7 4 6M46 62l3-5m11 59 8 2M11 139l7-2m78-2 10 2"/>`;
  return `<svg viewBox="0 0 120 150" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><defs><pattern id="${id}" width="5" height="5" patternUnits="userSpaceOnUse"><rect width="5" height="5" fill="${fill}"/><path d="m-1 5 6-6m-1 7 3-3" stroke="#72664e" stroke-width=".65" opacity=".55"/></pattern></defs>${body}${bruised ? `<path d="${kind === "fighter" || kind === "hero" ? "m40 24 10 9m-9-4 10 10m24 11-8 7" : kind === "skull" || kind === "skeleton" ? "m39 17 10 7m21 15 8 5" : kind === "rat" ? "m38 77 10 6m35 25-8 7" : kind === "ghost" ? "m38 34 10 8m24 25-6 8" : "m34 77 10 8m39 26-9 7"}" stroke="#945740" stroke-width="1.5"/>` : ""}${hurt ? '<path d="m38 34 8 2m-8 2 8 2m20 11 11 4m-12 0 11 4" stroke="#8c4b39"/><path d="m72 59-2 10m3-5-1 8" stroke="#854736" stroke-width="2"/>' : ""}${dead ? `<g stroke="${paper}" stroke-width="2"><path d="${kind === "skull" || kind === "skeleton" ? "m48 23 7 6m0-6-7 6m19-6 7 6m0-6-7 6" : kind === "rat" || kind === "slime" ? "m47 80 7 6m0-6-7 6m16-6 7 6m0-6-7 6" : "m47 41 7 6m0-6-7 6m14-6 7 6m0-6-7 6"}"/></g>` : ""}</svg>`;
}
function floorArt(c, i) {
  if (c.terrain === "bridge") return icon("bridge");
  if (c.wall) return icon(c.terrain === "river" ? c.terrain : "wall");
  const variants = [
    paths.floor,
    "M5 24q7-2 12 0l10-2M9 23l-3-6m11 7 5 4",
    "M5 24l7-4 7 3 9-2M12 20l-1-6m7 8 3 5",
    "M3 24l9-4 4 3 12-7M16 23l2 5m-8-7-4-6m21 2 1-6",
    "M5 25q9-3 22-1M8 18l4-2 5 1 3 3-7 1z M24 11l2 2",
  ];
  let p = pencilPath(variants[c.doodle ?? i % variants.length], 0.28);
  return `<svg class="pencil-art" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" aria-hidden="true"><path d="${p}" opacity=".55"/></svg>`;
}

function horrorArt(kind, h) {
  if (h.hp <= 0) return corpseArt(kind);
  const red = h.hp / h.maxHp < 0.35 ? "#a15a4c" : "#6f3f36",
    hatched =
      '<pattern id="horror-hatch-' +
      ++artSerial +
      '" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M0 5 5 0" stroke="#73604d" stroke-width=".7"/></pattern>',
    fill = `url(#horror-hatch-${artSerial})`;
  let shape =
    kind === "demon"
      ? `<path d="M21 48 6 13l31 21M84 35l27-27-10 42M27 58 16 94 3 111l16 11 18-23 8 37m31 0 8-40 18 28 16-14-18-25-8-29" fill="${fill}"/><path d="m29 29 34-12 32 22-7 43-28 19-30-23z" fill="#c2ad91"/><path d="m35 46 23 11-17 7zm47-3-20 15 18 4z" fill="${red}"/><path d="m45 74 30-3-8 15-18-2z M49 72l3 11m8-12 1 13m7-13-1 12M53 27l8 14 9-17M60 96v42m-16-30 17 8 17-12M24 140h68"/>`
      : kind === "lich"
        ? `<path d="m10 144 19-77-9-37 30-28 37 3 22 31-15 36 16 72-29-12-20 16-20-15z" fill="${fill}"/><path d="M35 39Q57 8 84 38l-3 35-22 20-24-17z" fill="#d4c5a6"/><path d="m39 46 17 4-6 15-12-6zm39-2-17 8 7 13 13-10z" fill="${red}"/><path d="m59 57-6 15 12-1M43 77l33-3m-29-2 2 12m9-12v13m11-14-1 12M32 93l29 11 28-14M18 115l23-10m42 2 21 9M31 29l-6-10m72 11 9-12M9 131 4 58m-4 3 12-1M56 110l6 22 7-23"/>`
        : kind === "revenant"
          ? `<path d="M17 145 24 83l19-13 35-2 24 19 4 58z" fill="${fill}"/><path d="M37 30 50 9l29 7 14 25-11 36-39 2-12-21z" fill="#c4b295"/><path d="m42 36 20 11 20-8-3 18-16 8-23-10z" fill="#685446"/><path d="m41 26 38 5M49 12l6 17m12-15 4 17M46 64l-6 12 20 12 24-12M28 91l31 21 36-20M37 97l-5 27 22 13 27-11-1-26M24 87l-13 35m82-34 17 37M45 108q-17 7-2 18 16-10-1-18m17 10q-17 7-2 18 16-10-1-18m17-22q-17 7-2 18 16-10-1-18"/>`
          : `<path d="M9 140Q-5 92 30 74L24 40 47 8l34 8 17 39-4 28q35 25 19 59z" fill="${fill}"/><path d="m29 41 23-20 29 8 13 28-18 31-33-4-17-23z" fill="#b8a08b"/><path d="m34 44 18 5-9 14-14-5zm44-1-17 12 16 11 12-15z" fill="${red}"/><path d="m41 70 35-4-8 16-18-3M32 32l56 31m-49-29-7 9m18-2-8 10m19-5-8 10m18-5-8 10M23 88l75 35m-65-30-6 14m20-7-5 13m20-7-5 13m21-8-5 13M17 107l-8 21m90-25 14 27M20 143h85"/>`;
  return `<svg class="horror-art" data-horror="${kind}" viewBox="0 0 120 150" fill="none" stroke="#58473c" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><defs>${hatched}</defs>${shape}</svg>`;
}

function corpseArt(kind) {
  const animal = kind === "rat",
    spectral = kind === "ghost",
    blob = kind === "slime";
  const remains =
    kind === "mimic"
      ? '<path d="m10 118 19-22 34 13 32-12 16 25-37 19-49-4z" fill="#ad9872"/><path d="m18 116 36 15 50-12M29 98l20 18 16-5 27-11M26 117l10 9 8-8 9 13 8-8 10 11 9-12 10 5M16 142h92M53 107l7 20"/><path d="m39 103 6 4m-5 0 5-4m28 0 7 3m-7 0 7-3"/>'
      : animal
        ? '<path d="M22 119q-25 15-16-8m16 8q-7-34 33-34l30 6 22 20-12 17H38z" fill="#c6b99b"/><path d="m83 93 5-18 10 21M77 105l8 7m0-7-8 7M38 118l-9 14m30-10 8 12M95 114l12 4"/>'
        : spectral
          ? '<path d="m12 125 14-22 22 8 15-27 17 26 26-7-12 22-23 9-31-4z" fill="#d9cfb4"/><path d="m43 112 8 6m0-6-8 6m19-6 8 6m0-6-8 6M11 137h90"/>'
          : blob
            ? '<path d="M12 128q-8-13 22-14 5-17 25-7 21-16 28 6 30 3 20 18-51 10-95-3z" fill="#c3b392"/><path d="m43 116 8 7m0-7-8 7m18-7 8 7m0-7-8 7"/>'
            : `<path d="m9 135 16-7 22 4 20-8 25 6 19-5M42 116l17 6 28-13 13 7m-40 4 17 12 19-2M43 108l20-10 21 5-10 18-28 4z" fill="#cbbd9f"/><path d="m55 109 18 1m-15 8 12-12m-6-5 2 20M36 116l-12 14m38-8 17 13M9 143h102"/><ellipse cx="28" cy="110" rx="17" ry="16" fill="#e7dcc0"/><path d="m18 106 7 6m0-6-7 6m13-8 7 6m0-6-7 6M24 119h9"/>${kind === "fighter" || kind === "hero" ? '<path d="m12 102 7-11 19 2 9 13-9 7-25-2z M13 104l31 1M15 137l64-5m-63 1 1 8"/>' : kind === "skeleton" || kind === "skull" ? '<path d="m52 103 2 18m4-17 3 16m4-17 4 13m5-12 3 10M24 116h10m-7-2v7m4-7v7"/>' : '<path d="M10 110q-3-29 27-20l15 20-15 19H15z M15 113q5-28 22-14"/>'}`;
  return pencilIllustration(
    `<svg class="corpse-art" data-corpse="${kind}" viewBox="0 0 120 150" fill="none" stroke="#625343" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><ellipse cx="62" cy="133" rx="52" ry="8" fill="#80715b20"/>${remains}<path d="m11 145 14-1m74-2 13 1m-44-7 8 1" opacity=".55"/></svg>`,
  );
}

function trapArt(type) {
  let body =
    type === "spikes"
      ? '<path d="M5 76h190M10 82h180"/><g class="spike-bank"><path d="m20 76 13-49 13 49m10 0 15-63 15 63m10 0 15-56 15 56m11 0 14-46 14 46" fill="var(--paper-shade)"/><path d="m32 42 1 27m38-34v30m41-27-1 30m41-26 1 29"/></g>'
      : type === "arrow"
        ? '<path d="M5 7h32v76H5z M5 27h32M5 51h32M20 7v20m3 24v31 M36 41h14"/><g class="flying-arrow"><path d="M54 42h90l-12-10m12 10-12 10M56 42l-10-9m17 9-11-9m4 9-10 9m17-9-11 9"/></g>'
        : '<path d="M5 78h190"/><g class="rolling-boulder"><circle cx="83" cy="45" r="31" fill="var(--paper-shade)"/><path d="m65 27 10-7 17 3 14 13-4 28-15 11-22-8-9-17z M72 31l-6 9 13 9-3 14m14-37 5 13-5 12 10 5"/></g>';
  return `<div class="trap-art ${type}"><svg class="pencil-art" viewBox="0 0 200 90" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg></div>`;
}
