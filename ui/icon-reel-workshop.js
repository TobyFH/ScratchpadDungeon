// Presentation switch: change to "legacy" and rebuild to restore the previous
// editor. Prices, saved faces, manual/autoplay validators and balance stay shared.
let reelWorkshopLayout = "icons";
let workshopCritPage = 0;
let workshopEditReceipt = { heroId: null, text: "" };
function editor(i) {
  return reelWorkshopLayout === "legacy" ? legacyEditor(i) : iconReelEditor(i);
}
function quoteFaceTier(h, reel, index, target) {
  const face = h?.reels[reel]?.[index];
  if (
    !face ||
    ["class", "mystery", "blank"].includes(face.type) ||
    !Number.isInteger(target) ||
    target < 1 ||
    target > maxFaceTier(face.type)
  )
    return null;
  const budget = 1000000,
    copy = {
      ...h,
      points: budget,
      reels: h.reels.map((r) =>
        r.map((f) => ({ ...f, investments: { ...f.investments } })),
      ),
      last: h.last.map((f) => ({ ...f })),
    };
  const operation = target > face.tier ? "upgrade" : "weaken";
  while (copy.reels[reel][index].tier !== target)
    if (!applyFaceEdit(copy, reel, index, operation)) return null;
  return { cost: budget - copy.points, face: copy.reels[reel][index], target };
}
function setFaceTier(h, reel, index, target) {
  if (busy || state.over || !alive(h)) return false;
  const quote = quoteFaceTier(h, reel, index, target);
  if (
    !quote ||
    !Number.isFinite(h.points) ||
    h.points < Math.max(0, quote.cost)
  )
    return false;
  // A quote is a full transaction simulated through the same validators. Commit
  // the face and its receipts together; no partial multi-rank payment is possible.
  h.reels[reel][index] = quote.face;
  h.points -= quote.cost;
  h.last[reel] = { type: quote.face.type, tier: quote.face.tier, job: h.job };
  return true;
}
function pointChangeLabel(cost) {
  return cost < 0 ? `+${-cost} pts` : cost > 0 ? `−${cost} pts` : "Current";
}
function workshopFaceSummary(face, h) {
  const n = face.tier || 1;
  return (
    {
      attack: `${n} physical damage${n >= 3 ? " to every enemy" : " to the selected enemy"}.`,
      magic: `${n} spell damage${n >= 3 ? " to every enemy" : " to the selected enemy"}; may expose Vulnerable.`,
      heal: `${POWER.heal * n} HP to the selected ally. Full-health misclicks redirect to a wounded ally.`,
      selfheal: `${POWER.selfheal * n} HP to yourself only. Surplus is lost; never heals another ally.`,
      block: `${POWER.block * n} shared block. Spent as it protects; cap 20, or 30 with a Tank.`,
      stun: `${n} stun power. Stops at most one action, then grants stun protection.`,
      poison: `${n} poison power. Up to three turns; extra doses strengthen its damage.`,
      stimulant: `${n} stimulant power to self. Three-turn cap; extra doses raise potency.`,
      rally: `${n} stimulant power to the ally used most this fight (self when alone). Three-turn cap; extra doses raise potency.`,
      trick: `${n} anticipation. At six, Punchline fires six ordinary marks from your reels.`,
      selfharm: `Pay up to ${2 * n} HP without dying. Each HP paid builds ${2 + 0.5 * n} Fury.`,
      mystery:
        "Random ordinary power; rank follows this reel. Can complete a normal critical.",
      blank: "No effect. Choose a symbol below to inscribe it at rank I.",
      class: workshopAbilitySummary(h),
    }[face.type] || faceDescription(face, h)
  );
}
function iconCriticalOddsMarkup(h) {
  const rows = heroCriticalOdds(h),
    total = rows.reduce((n, r) => n + r.chance, 0),
    size = 6,
    pages = Math.max(1, Math.ceil(rows.length / size));
  workshopCritPage = Math.min(workshopCritPage, pages - 1);
  return `<section class="workshop-critpage workshop-page icon-critical-odds" ${editorView === "crits" ? "" : 'aria-hidden="true" inert'}><h3>Three of a kind · ${(total * 100).toFixed(2)}%</h3><p>${className(h.job)} criticals <b>${criticalRange(h)}</b>. The class mark completes a matching outer pair. Empty never crits; equal faces and duplicates set these odds.</p><div class="crit-odds-grid">${
    rows
      .slice(workshopCritPage * size, (workshopCritPage + 1) * size)
      .map(
        (row) =>
          `<div class="crit-odds-row">${symbolMarkup(row)}<b>${FACE_LABELS[row.type]} ${tierName(row.tier)}</b><strong>${(row.chance * 100).toFixed(2)}%</strong></div>`,
      )
      .join("") ||
    "<p>No matches yet. Put the same type and rank on both outer reels.</p>"
  }</div><nav class="crit-page-nav"><button data-crit-page="${workshopCritPage - 1}" ${workshopCritPage === 0 ? "disabled" : ""}>← Previous</button><span>${workshopCritPage + 1} / ${pages}</span><button data-crit-page="${workshopCritPage + 1}" ${workshopCritPage >= pages - 1 ? "disabled" : ""}>Next →</button></nav></section>`;
}
function iconClassPricesMarkup(h) {
  const types = editableTypes(h).filter((t) => t !== "blank");
  return `<section class="workshop-page icon-class-prices" ${editorView === "prices" ? "" : 'aria-hidden="true" inert'}><h3>${className(h.job)} point costs</h3><p>Rank power stays the same. Your class changes editing costs.</p><table class="class-price-table"><thead><tr><th>Symbol</th><th>Inscribe I</th><th>II</th><th>III</th><th>IV</th></tr></thead><tbody>${types.map((type) => `<tr><th>${FACE_LABELS[type]}</th><td>${classFacePrice(h, type, 3)}</td>${[2, 3, 4].map((tier) => `<td>${classFacePrice(h, type, FACE_COST[tier])}</td>`).join("")}</tr>`).join("")}</tbody></table><p>Inscribe replaces Empty. Rank costs are per step; downward edits refund half the points paid.</p></section>`;
}
const WORKSHOP_SHORT_LABELS = Object.freeze({
  attack: "Physical",
  magic: "Spell",
  heal: "Ally heal",
  selfheal: "Self heal",
  block: "Block",
  stun: "Stun",
  poison: "Poison",
  stimulant: "Self stim",
  rally: "Ally stim",
  trick: "Trick",
  selfharm: "Blood Price",
  blank: "Empty",
});
function iconReelEditor(i) {
  if (busy || state.over) return;
  const h = state.party[i];
  if (!h || !alive(h)) return;
  if (editorSelection.heroId !== h.id) {
    editorSelection = { heroId: h.id, reel: 0, face: 0 };
    editorView = "edit";
    workshopEditReceipt = { heroId: h.id, text: "" };
  }
  const k = editorSelection.reel,
    j = Math.min(editorSelection.face, h.reels[k].length - 1),
    face = h.reels[k][j];
  const locked = ["class", "mystery"].includes(face.type),
    types = editableTypes(h),
    rows = Math.ceil(types.length / 5);
  const selectedName =
    face.type === "class" ? classAbilityName(h) : FACE_LABELS[face.type];
  const odds = (
    heroCriticalOdds(h).reduce((n, r) => n + r.chance, 0) * 100
  ).toFixed(1);
  const tiers = [1, 2, 3, 4]
    .map((tier) => {
      const quote =
        locked || face.type === "blank" ? null : quoteFaceTier(h, k, j, tier);
      const current = !locked && face.type !== "blank" && tier === face.tier;
      const disabled = !quote || current || h.points < Math.max(0, quote.cost);
      return `<button data-set-face-tier="${tier}" aria-pressed="${current}" ${disabled ? "disabled" : ""} title="${escapeHTML(locked ? "Permanent marks cannot change rank" : face.type === "blank" ? "Choose a symbol before setting its rank" : faceDescription({ type: face.type, tier }, h))}"><strong>${tierName(tier)}</strong><small>${current ? "Current" : quote ? pointChangeLabel(quote.cost) : "—"}</small></button>`;
    })
    .join("");
  const symbols = types
    .map((type) => {
      const current = type === face.type,
        cost = faceEditCost(h, k, j, "swap", type),
        tier = type === "blank" ? 1 : Math.min(face.tier, maxFaceTier(type));
      const description = faceDescription({ type, tier }, h);
      return `<button class="symbol-choice" data-set-face-type="${type}" aria-pressed="${current}" data-tooltip="${escapeHTML(description)}" title="${escapeHTML(description)}" ${locked || current || !Number.isFinite(cost) || h.points < Math.max(0, cost) ? "disabled" : ""}><span class="choice-icon">${symbolMarkup({ type, tier: 1 })}</span><span class="choice-name">${WORKSHOP_SHORT_LABELS[type]}</span><small>${current ? "Current" : locked ? "Locked" : pointChangeLabel(cost)}</small></button>`;
    })
    .join("");
  const faces = h.reels[k]
    .map((f, n) => {
      const chance = (100 / h.reels[k].length).toFixed(1),
        name = f.type === "class" ? classAbilityName(h) : FACE_LABELS[f.type];
      return `<button data-editor-face="${n}" aria-pressed="${n === j}" title="${escapeHTML(faceDescription(f, h))}">${symbolMarkup(f)}<span>${name}${!["class", "mystery", "blank"].includes(f.type) ? " " + tierName(f.tier) : ""}</span><small>${chance}%</small></button>`;
    })
    .join("");
  const receipt =
    workshopEditReceipt.heroId === h.id ? workshopEditReceipt.text : "";
  openModal(
    `${h.name}’s reel workshop`,
    `
    <div class="workshop-summary"><strong>${h.points} personal points</strong>${heroBuildMarkup(h)}</div>
    <p class="workshop-ability">Middle mark: <b>${classAbilityName(h)}</b> · ${workshopAbilitySummary(h)}</p>
    <nav class="workshop-nav" aria-label="Workshop pages">${[
      ["edit", "Edit reels"],
      ["crits", `Critical odds · ${odds}%`],
      ["prices", "Class prices"],
    ]
      .map(
        ([view, label]) =>
          `<button data-workshop-view="${view}" aria-pressed="${editorView === view}">${label}</button>`,
      )
      .join("")}</nav>
    <div class="workshop-pages icon-workshop-pages">
      <section class="workshop-page workshop-editpage" ${editorView === "edit" ? "" : 'aria-hidden="true" inert'}>
        <div class="workshop-tabs" role="tablist" aria-label="Choose reel">${h.reels.map((_, r) => `<button role="tab" data-editor-reel="${r}" aria-selected="${r === k}">Reel ${r + 1}${r === 1 ? " · class mark" : ""}</button>`).join("")}</div>
        <div class="reel-workshop icon-workshop" style="--choice-rows:${rows}">
          <section class="workshop-mark-list"><h3>1 · Choose a face</h3><label class="workshop-face-picker">Face<select id="workshop-face-picker">${h.reels[k].map((f, n) => `<option value="${n}" ${n === j ? "selected" : ""}>${f.type === "class" ? classAbilityName(h) : FACE_LABELS[f.type]} ${!["class", "mystery", "blank"].includes(f.type) ? tierName(f.tier) : ""} · ${(100 / h.reels[k].length).toFixed(1)}%</option>`).join("")}</select></label><div class="workshop-faces">${faces}</div><small class="equal-face-note">Every face has the same chance. Duplicates combine.</small></section>
          <section class="workshop-detail"><div class="workshop-selected"><div class="workshop-preview">${symbolMarkup(face)}</div><h3>${selectedName}${!["class", "mystery", "blank"].includes(face.type) ? " " + tierName(face.tier) : ""}</h3></div>
            <p class="face-effect" tabindex="0" data-tooltip="${escapeHTML(faceDescription(face, h))}"><b>Effect:</b> ${escapeHTML(workshopFaceSummary(face, h))}</p>
            <h3 class="choice-heading">2 · Set rank <small>Pay ↑ · refund ↓</small></h3><div class="tier-choices">${tiers}</div>
            <h3 class="choice-heading">3 · ${face.type === "blank" ? "Inscribe a symbol" : "Change symbol"} <small>${locked ? "Permanent mark" : face.type === "blank" ? "Starts at rank I" : "Keeps rank " + tierName(face.tier)}</small></h3>
            <div class="symbol-choices" style="--compact-choice-rows:${Math.ceil(types.length / 3)}">${symbols}</div>
            <p class="workshop-lock-note">${locked ? (face.type === "class" ? "This unique middle-reel mark cannot be replaced or copied." : "This Jester mystery is permanent. Its rank follows its reel.") : "Click a rank or symbol to apply its shown point change."}</p>
          </section>
        </div>
      </section>${iconCriticalOddsMarkup(h)}${iconClassPricesMarkup(h)}
    </div><p class="workshop-receipt" role="status">${escapeHTML(receipt || "Edits save immediately. Downward ranks refund paid points.")}</p>
    <div class="modal-actions"><button class="primary" data-close>Done · back to the adventure</button></div>`,
    "editor",
  );
  function redraw(selector) {
    renderParty();
    save();
    iconReelEditor(i);
    if (selector) $(selector)?.focus();
  }
  document.querySelectorAll("[data-crit-page]").forEach(
    (b) =>
      (b.onclick = () => {
        workshopCritPage = Number(b.dataset.critPage);
        iconReelEditor(i);
      }),
  );
  document.querySelectorAll("[data-workshop-view]").forEach(
    (b) =>
      (b.onclick = () => {
        editorView = b.dataset.workshopView;
        iconReelEditor(i);
        $(`[data-workshop-view="${editorView}"]`)?.focus();
      }),
  );
  document.querySelectorAll("[data-editor-reel]").forEach(
    (b) =>
      (b.onclick = () => {
        editorSelection.reel = Number(b.dataset.editorReel);
        editorSelection.face = 0;
        iconReelEditor(i);
        $(`[data-editor-reel="${editorSelection.reel}"]`)?.focus();
      }),
  );
  document.querySelectorAll("[data-editor-face]").forEach(
    (b) =>
      (b.onclick = () => {
        editorSelection.face = Number(b.dataset.editorFace);
        iconReelEditor(i);
        $(`[data-editor-face="${editorSelection.face}"]`)?.focus();
      }),
  );
  $("#workshop-face-picker").onchange = (e) => {
    editorSelection.face = Number(e.target.value);
    iconReelEditor(i);
    $("#workshop-face-picker").focus();
  };
  document.querySelectorAll("[data-set-face-type]").forEach(
    (b) =>
      (b.onclick = () => {
        const type = b.dataset.setFaceType,
          cost = faceEditCost(h, k, j, "swap", type);
        if (!applyFaceEdit(h, k, j, "swap", type)) return;
        workshopEditReceipt = {
          heroId: h.id,
          text: `${FACE_LABELS[type]} inscribed · ${pointChangeLabel(cost)}.`,
        };
        redraw(`[data-set-face-type="${type}"]`);
      }),
  );
  document.querySelectorAll("[data-set-face-tier]").forEach(
    (b) =>
      (b.onclick = () => {
        const target = Number(b.dataset.setFaceTier),
          quote = quoteFaceTier(h, k, j, target);
        if (!quote || !setFaceTier(h, k, j, target)) return;
        workshopEditReceipt = {
          heroId: h.id,
          text: `Rank ${tierName(target)} · ${pointChangeLabel(quote.cost)}.`,
        };
        redraw(`[data-set-face-tier="${target}"]`);
      }),
  );
  $(".workshop-tabs").onkeydown = (e) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const next =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? 2
          : (k + (e.key === "ArrowRight" ? 1 : 2)) % 3;
    $(`[data-editor-reel="${next}"]`).click();
  };
  $(".workshop-faces").onkeydown = (e) => {
    if (!["ArrowUp", "ArrowDown"].includes(e.key)) return;
    e.preventDefault();
    const n =
      (j + (e.key === "ArrowDown" ? 1 : h.reels[k].length - 1)) %
      h.reels[k].length;
    $(`[data-editor-face="${n}"]`).click();
  };
  requestFitUI();
}
