// All manual edits, recruitment and autoplay share these validated operations.
const tierName = (tier) => ["", "I", "II", "III", "IV"][tier];
const maxFaceTier = (type) =>
  ["attack", "magic", "heal", "block", "stun", "poison", "stimulant"].includes(
    type,
  )
    ? 4
    : type === "class"
      ? 1
      : 3;
const CLASS_PRICES = {
  ranger: {
    attack: 1,
    poison: 1.25,
    stun: 1,
    block: 1.5,
    heal: 2,
    magic: 2,
    stimulant: 1.25,
  },
  fighter: {
    attack: 1,
    block: 1,
    stun: 1,
    heal: 2,
    magic: 1.75,
    poison: 1.5,
    stimulant: 1.25,
  },
  healer: {
    heal: 1,
    block: 1,
    stun: 1,
    magic: 1.25,
    attack: 2,
    poison: 1.75,
    stimulant: 1.25,
  },
  mage: {
    magic: 1,
    poison: 1,
    stimulant: 1,
    heal: 1,
    attack: 2,
    block: 1,
    stun: 1,
  },
  rogue: {
    attack: 1,
    poison: 1,
    stun: 1.25,
    heal: 2,
    block: 1.5,
    magic: 1.75,
    stimulant: 1.25,
  },
};
const EDITABLE_TYPES = Object.freeze([
  "attack",
  "magic",
  "heal",
  "block",
  "stun",
  "poison",
  "stimulant",
  "blank",
]);
const FACE_LABELS = Object.freeze({
  attack: "Blade damage",
  magic: "Spell damage",
  heal: "Healing",
  block: "Team block",
  stun: "Stun",
  poison: "Poison",
  stimulant: "Stimulant",
  blank: "Empty",
});
const primaryFace = (h) =>
  h.job === "mage" ? mageRole(h) : h.job === "healer" ? "heal" : "attack";
function classFacePrice(h, type, base) {
  return base
    ? Math.ceil(base * (CLASS_PRICES[h?.job]?.[type] || 1))
    : undefined;
}
function faceUpgradeCost(face, h = null) {
  if (!face || face.type === "class") return undefined;
  return face.type === "blank"
    ? classFacePrice(h, primaryFace(h || {}), 3)
    : face.tier < maxFaceTier(face.type)
      ? classFacePrice(h, face.type, FACE_COST[face.tier + 1])
      : undefined;
}
function faceRefund(h, face) {
  if (!face || face.type === "class" || face.type === "blank" || face.tier <= 1)
    return 0;
  const paid =
    face.investments?.[face.tier] ||
    classFacePrice(h, face.type, FACE_COST[face.tier]);
  return Math.max(1, Math.floor(paid / 2));
}
function nextFaceType(h, reel, index) {
  // Kept for old callers; the live editor always selects an explicit destination.
  const type = h.reels[reel][index].type;
  return EDITABLE_TYPES[
    (EDITABLE_TYPES.indexOf(type) + 1) % EDITABLE_TYPES.length
  ];
}
function faceEditCost(h, reel, index, operation, destination = null) {
  const face = h?.reels[reel]?.[index];
  if (!face || face.type === "class") return undefined;
  if (operation === "upgrade") return faceUpgradeCost(face, h);
  if (operation === "weaken")
    return faceRefund(h, face) ? -faceRefund(h, face) : undefined;
  if (!["swap", "cycle"].includes(operation)) return undefined;
  const type =
    destination ||
    (operation === "cycle" ? nextFaceType(h, reel, index) : null);
  if (!EDITABLE_TYPES.includes(type) || type === face.type) return undefined;
  return type === "blank"
    ? 1
    : classFacePrice(h, type, face.type === "blank" ? 3 : FACE_COST[face.tier]);
}
function applyFaceEdit(h, reel, index, operation, destination = null) {
  const face = h?.reels[reel]?.[index],
    cost = faceEditCost(h, reel, index, operation, destination);
  if (
    !face ||
    face.type === "class" ||
    !Number.isFinite(cost) ||
    !Number.isFinite(h.points) ||
    h.points < Math.max(0, cost)
  )
    return false;
  if (operation === "upgrade") {
    if (face.type === "blank") {
      face.type = primaryFace(h);
      face.tier = 1;
    } else {
      face.tier++;
      face.investments = { ...face.investments, [face.tier]: cost };
    }
  } else if (operation === "weaken") {
    if (face.investments) delete face.investments[face.tier];
    face.tier--;
  } else {
    face.type = destination || nextFaceType(h, reel, index);
    face.tier =
      face.type === "blank" ? 1 : Math.min(face.tier, maxFaceTier(face.type));
    // A swap pays for the destination value; future refunds use its actual cost.
    face.investments = face.tier > 1 ? { [face.tier]: cost } : {};
    delete face.job;
  }
  h.points -= cost;
  h.last[reel] = { type: face.type, tier: face.tier, job: h.job };
  return true;
}
let editorSelection = { heroId: null, reel: 0, face: 0 };
function editor(i) {
  if (busy || state.over) return;
  const h = state.party[i];
  if (!h || !alive(h)) return;
  if (editorSelection.heroId !== h.id)
    editorSelection = { heroId: h.id, reel: 0, face: 0 };
  const k = editorSelection.reel,
    j = Math.min(editorSelection.face, h.reels[k].length - 1),
    face = h.reels[k][j],
    locked = face.type === "class";
  const upgrade = faceUpgradeCost(face, h),
    refund = faceRefund(h, face),
    data = `${i},${k},${j}`;
  openModal(
    `${h.name}’s reel workshop`,
    `<div class="workshop-summary"><strong>${h.points} personal points</strong>${heroBuildMarkup(h)}<span>Class seal stays in the middle reel.</span></div>
    ${
      h.job === "mage"
        ? `<label class="mage-role-choice">Mage role <select id="mage-role">${Object.entries(
            MAGE_ROLES,
          )
            .map(
              ([id, r]) =>
                `<option value="${id}" ${mageRole(h) === id ? "selected" : ""}>${r.name}</option>`,
            )
            .join(
              "",
            )}</select><span>${classAbilityDescription(h)}</span></label>`
        : `<p class="workshop-ability">${classAbilityDescription(h)}</p>`
    }
    <div class="workshop-tabs" role="tablist" aria-label="Choose reel">${h.reels.map((_, r) => `<button role="tab" aria-selected="${r === k}" data-editor-reel="${r}">Reel ${r + 1}${r === 1 ? " · class seal" : ""}</button>`).join("")}</div>
    <div class="reel-workshop"><div class="workshop-faces" role="group" aria-label="Weighted faces on reel ${k + 1}">${h.reels[k].map((s, f) => `<button data-editor-face="${f}" aria-pressed="${f === j}">${symbolMarkup(s)}<span>${s.type === "class" ? classAbilityName(h) : FACE_LABELS[s.type]}${s.type !== "class" && s.type !== "blank" ? " " + tierName(s.tier) : ""}</span><small>${Math.round((100 * (s.weight || 1)) / h.reels[k].reduce((n, x) => n + (x.weight || 1), 0))}%</small></button>`).join("")}</div>
    <section class="workshop-detail" aria-label="Selected face"><div class="workshop-preview">${symbolMarkup(face)}</div><h3>${locked ? classAbilityName(h) : FACE_LABELS[face.type] + (face.type !== "blank" ? " " + tierName(face.tier) : "")}</h3>
    ${
      locked
        ? `<p class="locked-seal">${icon("class")}Permanent class seal<br>This face cannot be changed, removed or copied.</p>`
        : `<div class="workshop-actions"><button class="primary" data-upgrade="${data}" ${!upgrade || h.points < upgrade ? "disabled" : ""}>${face.type === "blank" ? "Inscribe " + FACE_LABELS[primaryFace(h)] : "Upgrade ↑"}<small>${upgrade ? "Spend " + upgrade + " points" : "Maximum tier"}</small></button><button data-weaken="${data}" ${!refund ? "disabled" : ""}>Downgrade ↓<small>${refund ? "Refund +" + refund + " points" : "Already lowest tier"}</small></button></div><label class="swap-choice">Change symbol to<select id="face-destination">${EDITABLE_TYPES.filter(
            (type) => type !== face.type,
          )
            .map(
              (type) => `<option value="${type}">${FACE_LABELS[type]}</option>`,
            )
            .join(
              "",
            )}</select></label><button class="swap-face" id="face-swap">Swap symbol <small id="swap-price"></small></button>`
    }
    </section></div><p class="workshop-note">Downgrades return half the tier’s price, rounded down (at least 1). Each click removes one tier. Swaps preserve face odds. Spend points freely between actions.</p><div class="modal-actions"><button class="primary" data-close>Back to the adventure</button></div>`,
    "editor",
  );
  document.querySelectorAll("[data-editor-reel]").forEach(
    (b) =>
      (b.onclick = () => {
        editorSelection.reel = Number(b.dataset.editorReel);
        editorSelection.face = 0;
        editor(i);
      }),
  );
  document.querySelectorAll("[data-editor-face]").forEach(
    (b) =>
      (b.onclick = () => {
        editorSelection.face = Number(b.dataset.editorFace);
        editor(i);
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
          : (editorSelection.reel + (e.key === "ArrowRight" ? 1 : 2)) % 3;
    $(`[data-editor-reel="${next}"]`).click();
    $(`[data-editor-reel="${next}"]`)?.focus();
  };
  $(".workshop-faces").onkeydown = (e) => {
    if (!["ArrowUp", "ArrowDown"].includes(e.key)) return;
    e.preventDefault();
    const size = h.reels[k].length,
      next =
        (editorSelection.face + (e.key === "ArrowDown" ? 1 : size - 1)) % size;
    $(`[data-editor-face="${next}"]`).click();
    $(`[data-editor-face="${next}"]`)?.focus();
  };
  const select = $("#face-destination"),
    swap = $("#face-swap");
  if (select) {
    const update = () => {
      const cost = faceEditCost(h, k, j, "swap", select.value);
      $("#swap-price").textContent = "Spend " + cost + " points";
      swap.disabled = h.points < cost;
    };
    select.onchange = update;
    update();
    swap.onclick = () => editFace(data, "swap", select.value);
  }
  if ($("#mage-role"))
    $("#mage-role").onchange = (e) => {
      h.mageRole = e.target.value;
      normaliseHeroBuild(h);
      save();
      renderParty();
      editor(i);
      $(`[data-editor-reel="${editorSelection.reel}"]`)?.focus();
    };
}
function editFace(data, operation, destination = null) {
  if (busy || state.over) return;
  const [i, r, f] = data.split(",").map(Number),
    h = state.party[i];
  const op =
    operation === true ? "upgrade" : operation === false ? "cycle" : operation;
  if (!applyFaceEdit(h, r, f, op, destination)) return;
  editorSelection = { heroId: h.id, reel: r, face: f };
  renderParty();
  save();
  editor(i);
}
