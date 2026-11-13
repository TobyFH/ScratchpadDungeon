// Presentation switch: change to "legacy" and rebuild to restore the previous
// editor. Prices, saved faces, manual/autoplay validators and balance stay shared.
let reelWorkshopLayout = "icons";
let workshopCritPage = 0;
let workshopEditReceipt = { heroId: null, text: "" };
let pendingTravelWorkshop = null;
function editor(i) {
  if (isSummon(state.party[i])) {
    toast("Bound summons have fixed reels.");
    return;
  }
  if (travel && alive(state.party[i])) {
    pendingTravelWorkshop = { run: state, heroId: state.party[i].id };
    travel.workshopStop = true;
    return;
  }
  return reelWorkshopLayout === "legacy" ? legacyEditor(i) : iconReelEditor(i);
}
function finishTravelWorkshop() {
  const request = pendingTravelWorkshop;
  pendingTravelWorkshop = null;
  if (
    !request ||
    request.run !== state ||
    state.over ||
    state.enemy ||
    !$("#overlay").hidden ||
    !$("#spotlight").hidden
  )
    return;
  const i = state.party.findIndex((h) => h.id === request.heroId);
  if (i >= 0 && alive(state.party[i])) editor(i);
}
function reelQueueControls(h) {
  return `<div class="workshop-queue-controls"><label title="Save unaffordable changes without spending points. Turning this off clears every queued change."><input type="checkbox" id="queue-reel-changes" ${preferences().queueReelChanges ? "checked" : ""}><span>Queue unaffordable changes</span></label><span>${h.reelQueue?.length || 0} queued</span></div>`;
}
function reelQueueStatus(h, reel, index, fallback = "") {
  const q = queuedFaceChange(h, reel, index),
    quote = q && quoteFaceChange(h, reel, index, q.kind, q.target);
  return `<span class="workshop-queue-status">${q ? `<span>Queued: <b>${escapeHTML(faceChangeName(q))}</b> · ${quote.cost} pts · unpaid</span><button id="cancel-face-queue">Cancel plan</button>` : `<span>${escapeHTML(fallback || (preferences().queueReelChanges ? "Queue buys cheapest first; equal costs break ties at random." : "Queuing is off. Unaffordable changes are disabled."))}</span>`}</span>`;
}
function bindReelQueueControls(i, redraw) {
  $("#queue-reel-changes").onchange = (event) => {
    setPreference("queueReelChanges", event.target.checked);
    redraw("#queue-reel-changes");
  };
  if ($("#cancel-face-queue"))
    $("#cancel-face-queue").onclick = () => {
      cancelQueuedFace(
        state.party[i],
        editorSelection.reel,
        editorSelection.face,
      );
      redraw("#queue-reel-changes");
    };
}
function pointChangeLabel(cost) {
  return cost < 0 ? `+${-cost} pts` : cost > 0 ? `−${cost} pts` : "Current";
}
function workshopFaceSummary(face, h) {
  return faceDescription(face, h);
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
const WORKSHOP_SHORT_LABELS = Object.freeze({
  bloodseed: "Blood Seed",
  harvest: "Harvest",
  attack: "Physical",
  heavy: "Heavy",
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
  if (!["edit", "crits"].includes(editorView)) editorView = "edit";
  normaliseReelQueue(h);
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
      const queued = queuedFaceChange(h, k, j),
        selected = queued?.kind === "tier" && queued.target === tier,
        waiting = quote && h.points < Math.max(0, quote.cost),
        disabled =
          !quote || current || (waiting && !preferences().queueReelChanges);
      const action = selected
        ? "Queued"
        : waiting && preferences().queueReelChanges
          ? "Queue"
          : "";
      return `<button class="${selected ? "queued-choice" : waiting ? "queue-choice" : ""}" data-queued="${selected}" data-set-face-tier="${tier}" aria-pressed="${current}" ${disabled ? "disabled" : ""} title="${escapeHTML(locked ? "Permanent marks cannot change rank" : face.type === "blank" ? "Choose a symbol before setting its rank" : faceDescription({ type: face.type, tier }, h))}"><strong>${tierName(tier)}</strong><small>${current ? "Current" : quote ? (action ? `${action} · ${quote.cost}` : pointChangeLabel(quote.cost)) : "—"}</small></button>`;
    })
    .join("");
  const symbols = types
    .map((type) => {
      const current = type === face.type,
        cost = faceEditCost(h, k, j, "swap", type),
        tier = type === "blank" ? 1 : Math.min(face.tier, maxFaceTier(type));
      const description = faceDescription({ type, tier }, h),
        queued = queuedFaceChange(h, k, j),
        selected = queued?.kind === "swap" && queued.target === type,
        waiting = Number.isFinite(cost) && h.points < Math.max(0, cost),
        action = selected
          ? "Queued"
          : waiting && preferences().queueReelChanges
            ? "Queue"
            : "";
      return `<button class="symbol-choice ${selected ? "queued-choice" : waiting ? "queue-choice" : ""}" data-queued="${selected}" data-set-face-type="${type}" aria-pressed="${current}" data-tooltip="${escapeHTML(description)}" title="${escapeHTML(description)}" ${locked || current || !Number.isFinite(cost) || (waiting && !preferences().queueReelChanges) ? "disabled" : ""}><span class="choice-icon">${symbolMarkup({ type, tier: 1 })}</span><span class="choice-name">${WORKSHOP_SHORT_LABELS[type]}</span><small>${current ? "Current" : locked ? "Locked" : action ? `${action} · ${cost}` : pointChangeLabel(cost)}</small></button>`;
    })
    .join("");
  const faces = h.reels[k]
    .map((f, n) => {
      const queued = queuedFaceChange(h, k, n),
        chance = (100 / h.reels[k].length).toFixed(1),
        name = f.type === "class" ? classAbilityName(h) : FACE_LABELS[f.type];
      return `<button class="${f.type === "class" ? "permanent-class-face" : ""} ${queued ? "queued-face" : ""}" data-editor-face="${n}" aria-pressed="${n === j}" title="${escapeHTML(faceDescription(f, h))}">${symbolMarkup(f)}<span>${name}${!["class", "mystery", "blank"].includes(f.type) ? " " + tierName(f.tier) : ""}</span><small>${queued ? "Queued" : `${chance}%`}</small></button>`;
    })
    .join("");
  const receipt =
    workshopEditReceipt.heroId === h.id ? workshopEditReceipt.text : "";
  openModal(
    `${h.name}’s reel workshop`,
    `
    <div class="workshop-summary"><strong>${h.points} personal points</strong>${heroBuildMarkup(h)}</div>
    ${reelQueueControls(h, k, j)}
    <p class="workshop-ability">Middle mark: <b>${classAbilityName(h)}</b> · ${workshopAbilitySummary(h)}</p>
    <nav class="workshop-nav" aria-label="Workshop pages">${[
      ["edit", "Edit reels"],
      ["crits", `Critical odds · ${odds}%`],
    ]
      .map(
        ([view, label]) =>
          `<button data-workshop-view="${view}" aria-pressed="${editorView === view}">${label}</button>`,
      )
      .join("")}</nav>
    <div class="workshop-pages icon-workshop-pages">
      <section class="workshop-page workshop-editpage" ${editorView === "edit" ? "" : 'aria-hidden="true" inert'}>
        <div class="workshop-tabs" role="tablist" aria-label="Choose reel">${h.reels.map((_, r) => `<button role="tab" data-editor-reel="${r}" aria-selected="${r === k}">Reel ${r + 1}${r === 1 ? " · class mark" : ""}${h.reelQueue?.some((q) => q.reel === r) ? '<span class="reel-queue-flag" aria-label="Queued changes">●</span>' : ""}</button>`).join("")}</div>
        <div class="reel-workshop icon-workshop" style="--choice-rows:${rows}">
          <section class="workshop-mark-list"><h3>1 · Choose a face</h3><label class="workshop-face-picker">Face<select id="workshop-face-picker">${h.reels[k].map((f, n) => `<option value="${n}" ${n === j ? "selected" : ""}>${f.type === "class" ? "★ " + classAbilityName(h) : FACE_LABELS[f.type]} ${!["class", "mystery", "blank"].includes(f.type) ? tierName(f.tier) : ""}${queuedFaceChange(h, k, n) ? " · queued" : ""} · ${(100 / h.reels[k].length).toFixed(1)}%</option>`).join("")}</select></label><div class="workshop-faces">${faces}</div></section>
          <section class="workshop-detail"><div class="workshop-selected"><div class="workshop-preview">${symbolMarkup(face)}</div><h3>${selectedName}${!["class", "mystery", "blank"].includes(face.type) ? " " + tierName(face.tier) : ""}</h3></div>
            <p class="face-effect" tabindex="0" data-tooltip="${escapeHTML(faceDescription(face, h))}"><b>Effect:</b> ${escapeHTML(workshopFaceSummary(face, h))}</p>
            <h3 class="choice-heading">2 · Set rank <small>Pay ↑ · refund ↓</small></h3><div class="tier-choices">${tiers}</div>
            <h3 class="choice-heading">3 · ${face.type === "blank" ? "Inscribe a symbol" : "Change symbol"} <small>${locked ? "Permanent mark" : face.type === "blank" ? "Starts at rank I" : "Keeps rank " + tierName(face.tier)}</small></h3>
            <div class="symbol-choices" style="--compact-choice-rows:${Math.ceil(types.length / 3)}">${symbols}</div>
            <p class="workshop-lock-note">${locked ? (face.type === "class" ? "Permanent class mark; cannot replace or copy." : "Permanent mystery; rank follows its reel.") : "Queue saves an unpaid plan. Click it again to cancel."}</p>
          </section>
        </div>
      </section>${iconCriticalOddsMarkup(h)}
    </div><p class="workshop-receipt" role="status">${reelQueueStatus(h, k, j, receipt)}</p>
    <div class="modal-actions"><button class="primary" data-close>Done · back to the adventure</button></div>`,
    "editor",
  );
  function redraw(selector) {
    processAllReelQueues();
    renderParty();
    save();
    iconReelEditor(i);
    if (selector) $(selector)?.focus();
  }
  bindReelQueueControls(i, redraw);
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
        const result = requestFaceChange(h, k, j, "swap", type);
        if (!result) return;
        workshopEditReceipt = {
          heroId: h.id,
          text:
            result.status === "bought"
              ? `${FACE_LABELS[type]} inscribed · ${pointChangeLabel(cost)}.`
              : result.status === "queued"
                ? `${FACE_LABELS[type]} queued for ${cost} points. No points spent.`
                : "Plan cancelled. No points spent.",
        };
        redraw(`[data-set-face-type="${type}"]`);
      }),
  );
  document.querySelectorAll("[data-set-face-tier]").forEach(
    (b) =>
      (b.onclick = () => {
        const target = Number(b.dataset.setFaceTier),
          quote = quoteFaceTier(h, k, j, target);
        const result = requestFaceChange(h, k, j, "tier", target);
        if (!quote || !result) return;
        workshopEditReceipt = {
          heroId: h.id,
          text:
            result.status === "bought"
              ? `Rank ${tierName(target)} · ${pointChangeLabel(quote.cost)}.`
              : result.status === "queued"
                ? `Rank ${tierName(target)} queued for ${quote.cost} points. No points spent.`
                : "Plan cancelled. No points spent.",
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
