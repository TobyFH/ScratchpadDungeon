// Personal-point plans use the same quotes and paid receipts as immediate edits.
// One plan per face; different faces are independent. Rendering never rolls a tie.
function facePlanStamp(face) {
  return JSON.stringify([
    face.type,
    face.tier,
    ...Object.entries(face.investments || {}).sort(([a], [b]) =>
      a.localeCompare(b),
    ),
  ]);
}
function quoteFaceChange(h, reel, index, kind, target) {
  if (!h || isSummon(h)) return null;
  if (kind === "tier") return quoteFaceTier(h, reel, index, target);
  if (kind !== "swap") return null;
  const cost = faceEditCost(h, reel, index, "swap", target);
  if (!Number.isFinite(cost)) return null;
  const copy = {
    ...h,
    points: 1000000,
    reels: h.reels.map((r) =>
      r.map((f) => ({ ...f, investments: { ...f.investments } })),
    ),
    last: h.last.map((f) => ({ ...f })),
  };
  if (!applyFaceEdit(copy, reel, index, "swap", target)) return null;
  return { cost, face: copy.reels[reel][index], target };
}
function normaliseReelQueue(h) {
  const pending = Array.isArray(h?.reelQueue) ? h.reelQueue : [];
  if (!h) return [];
  if (!preferences().queueReelChanges || !alive(h) || isSummon(h)) {
    h.reelQueue = [];
    return h.reelQueue;
  }
  const seen = new Set();
  h.reelQueue = pending
    .filter((q) => {
      if (!q || !Number.isInteger(q.reel) || !Number.isInteger(q.index))
        return false;
      const face = h.reels[q.reel]?.[q.index],
        key = `${q.reel}:${q.index}`;
      if (!face || ["class", "mystery"].includes(face.type) || seen.has(key))
        return false;
      if (q.expected !== facePlanStamp(face)) return false;
      const quote = quoteFaceChange(h, q.reel, q.index, q.kind, q.target);
      if (!quote || !(quote.cost > 0)) return false;
      seen.add(key);
      return true;
    })
    .map(({ reel, index, kind, target, expected }) => ({
      reel,
      index,
      kind,
      target,
      expected,
    }));
  return h.reelQueue;
}
function queuedFaceChange(h, reel, index) {
  return Array.isArray(h.reelQueue)
    ? h.reelQueue.find((q) => q?.reel === reel && q.index === index) || null
    : null;
}
function cancelQueuedFace(h, reel, index) {
  h.reelQueue = (Array.isArray(h.reelQueue) ? h.reelQueue : []).filter(
    (q) => q && (q.reel !== reel || q.index !== index),
  );
}
function clearQueuedReelChanges() {
  for (const h of [
    ...(state.party || []),
    ...(state.graveyard || []),
    ...(state.summonArchive || []),
  ])
    h.reelQueue = [];
}
function faceChangeName(q) {
  return q.kind === "tier"
    ? `rank ${tierName(q.target)}`
    : FACE_LABELS[q.target];
}
function commitFaceChange(h, reel, index, quote) {
  if (
    !quote ||
    !Number.isFinite(h.points) ||
    h.points < Math.max(0, quote.cost)
  )
    return false;
  h.reels[reel][index] = quote.face;
  h.points -= quote.cost;
  h.last[reel] = { type: quote.face.type, tier: quote.face.tier, job: h.job };
  cancelQueuedFace(h, reel, index);
  return true;
}
function requestFaceChange(h, reel, index, kind, target) {
  if (busy || state.over || !alive(h) || !state.party.includes(h)) return null;
  normaliseReelQueue(h);
  const quote = quoteFaceChange(h, reel, index, kind, target);
  if (!quote || !Number.isFinite(h.points)) return null;
  const old = queuedFaceChange(h, reel, index);
  if (old?.kind === kind && old.target === target) {
    cancelQueuedFace(h, reel, index);
    return { status: "cancelled", cost: quote.cost };
  }
  if (h.points >= Math.max(0, quote.cost)) {
    if (!commitFaceChange(h, reel, index, quote)) return null;
    return { status: "bought", cost: quote.cost };
  }
  if (!preferences().queueReelChanges) return null;
  cancelQueuedFace(h, reel, index);
  h.reelQueue.push({
    reel,
    index,
    kind,
    target,
    expected: facePlanStamp(h.reels[reel][index]),
  });
  return { status: "queued", cost: quote.cost };
}
function processQueuedReelChanges(h) {
  // In-flight rolls retain their original faces. Awards settle at the next safe
  // render/save boundary, not midway through a reel spin or walking animation.
  if (busy || currentRoll || travel || state.over || !state.party.includes(h))
    return 0;
  normaliseReelQueue(h);
  let bought = 0;
  while (h.reelQueue.length) {
    const affordable = h.reelQueue
      .map((q) => ({
        q,
        quote: quoteFaceChange(h, q.reel, q.index, q.kind, q.target),
      }))
      .filter(({ quote }) => quote && quote.cost <= h.points);
    if (!affordable.length) break;
    const cost = Math.min(...affordable.map(({ quote }) => quote.cost));
    const ties = affordable.filter(({ quote }) => quote.cost === cost);
    const { q, quote } = ties.length === 1 ? ties[0] : pick(ties);
    if (!commitFaceChange(h, q.reel, q.index, quote)) break;
    bought++;
    log(
      `${h.name} buys queued ${faceChangeName(q)} on reel ${q.reel + 1}, face ${q.index + 1}: ${cost} personal points.`,
      { important: true },
    );
  }
  return bought;
}
function processAllReelQueues() {
  let bought = 0;
  for (const h of state.party || [])
    if (h.reelQueue?.length) bought += processQueuedReelChanges(h);
  return bought;
}
