// Presentation-only caches. Never persist these or use them for world decisions.
// Keep unchanged tile subtrees alive instead of reparsing every sketch per step.
const mapTileFrames = new WeakMap();
const mapDrawingFrames = new WeakMap();
let renderedMapSource = null;
let mapTileBoard = null,
  mapTileObserver = null;
function dirtyTileContents(records) {
  for (const record of records) {
    const element =
      record.target.nodeType === Node.ELEMENT_NODE
        ? record.target
        : record.target.parentElement;
    const tile = element?.closest("[data-tile]");
    // Button attributes are always synchronised separately below.
    if (!tile || (record.type === "attributes" && record.target === tile))
      continue;
    const frame = mapTileFrames.get(tile);
    if (frame) frame.dirty = true;
  }
}
function tileFrame(node, source) {
  const attributes = [...node.attributes].map(({ name, value }) => [
    name,
    value,
  ]);
  return {
    source,
    attributes,
    names: new Set(attributes.map(([name]) => name)),
    body: node.innerHTML,
    first: node.firstChild,
    last: node.lastChild,
    count: node.childNodes.length,
  };
}
function paintMapTiles(tiles) {
  const board = document.getElementById("map");
  if (mapTileBoard !== board) {
    mapTileObserver?.disconnect();
    mapTileBoard = board;
    mapTileObserver = new MutationObserver(dirtyTileContents);
    mapTileObserver.observe(board, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
    });
  }
  dirtyTileContents(mapTileObserver.takeRecords());
  if (
    renderedMapSource !== state.map ||
    board.children.length !== tiles.length ||
    Array.from(board.children).some(
      (node, i) => node.dataset.tile !== String(i),
    )
  ) {
    board.innerHTML = tiles.join("");
    renderedMapSource = state.map;
    Array.from(board.children).forEach((node, i) =>
      mapTileFrames.set(node, tileFrame(node, tiles[i])),
    );
    mapTileObserver.takeRecords();
    return;
  }
  const template = document.createElement("template");
  tiles.forEach((source, i) => {
    const node = board.children[i];
    let frame = mapTileFrames.get(node);
    if (!frame || frame.source !== source) {
      template.innerHTML = source;
      const next = template.content.firstElementChild;
      const desired = tileFrame(next, source);
      // Metadata changes (visited/player/locked/etc.) don't invalidate the art.
      if (
        !frame ||
        frame.dirty ||
        frame.body !== desired.body ||
        node.firstChild !== frame.first ||
        node.lastChild !== frame.last ||
        node.childNodes.length !== frame.count
      )
        node.innerHTML = desired.body;
      frame = {
        ...desired,
        first: node.firstChild,
        last: node.lastChild,
        count: node.childNodes.length,
      };
      mapTileFrames.set(node, frame);
    } else if (
      frame.dirty ||
      node.firstChild !== frame.first ||
      node.lastChild !== frame.last ||
      node.childNodes.length !== frame.count
    ) {
      // revealTile intentionally writes children directly during the eraser FX.
      node.innerHTML = frame.body;
      Object.assign(frame, {
        dirty: false,
        first: node.firstChild,
        last: node.lastChild,
        count: node.childNodes.length,
      });
    }
    // Restore the same authored attributes as a full redraw, including removing
    // transient route/reveal classes and synchronising keyboard/disabled state.
    for (let a = node.attributes.length - 1; a >= 0; a--)
      if (!frame.names.has(node.attributes[a].name))
        node.removeAttribute(node.attributes[a].name);
    for (const [name, value] of frame.attributes)
      if (node.getAttribute(name) !== value) node.setAttribute(name, value);
  });
  // Discard our own synchronous writes; later external writes still invalidate.
  mapTileObserver.takeRecords();
}
function paintMapDrawing(id, markup, create) {
  const old = document.getElementById(id);
  if (!markup) {
    old?.remove();
    return;
  }
  const frame = old && mapDrawingFrames.get(old);
  if (frame?.source === state.map && frame.markup === markup) return old;
  const node = create();
  node.innerHTML = markup;
  mapDrawingFrames.set(node, { source: state.map, markup });
  if (old) old.replaceWith(node);
  else document.getElementById("map-board").append(node);
  return node;
}

// Unchanged party/inventory subtrees should not be reparsed on every map step.
// Direct status/roll writes invalidate this cache through the observer.
const stablePanelFrames = new WeakMap();
function paintStablePanel(host, markup) {
  let memo = stablePanelFrames.get(host);
  if (!memo) {
    memo = { markup: null, dirty: true };
    const changed = (rows) =>
      rows.some(
        (r) =>
          r.type !== "attributes" ||
          r.oldValue !== r.target.getAttribute(r.attributeName),
      );
    memo.changed = changed;
    memo.observer = new MutationObserver((rows) => {
      if (changed(rows)) memo.dirty = true;
    });
    memo.observer.observe(host, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeOldValue: true,
    });
    stablePanelFrames.set(host, memo);
  }
  if (memo.changed(memo.observer.takeRecords())) memo.dirty = true;
  if (memo.markup === markup && !memo.dirty) return;
  host.innerHTML = markup;
  memo.markup = markup;
  memo.dirty = false;
  memo.observer.takeRecords();
}
