// All manual edits, recruitment and autoplay share these validated operations.
const tierName = (tier) => ["", "I", "II", "III", "IV"][tier];
const maxFaceTier = (type) =>
  [
    "attack",
    "magic",
    "heal",
    "block",
    "stun",
    "poison",
    "stimulant",
    "selfharm",
  ].includes(type)
    ? 4
    : type === "class"
      ? 1
      : 3;
const CLASS_PRICES = {
  berserker: { attack: 1, heal: 1.25, selfharm: 1 },
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
  "selfharm",
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
  selfharm: "Blood Price",
  blank: "Empty",
});
const primaryFace = (h) =>
  h.job === "mage" ? (h.specialism === "defence" ? "heal" : "magic") : "attack";
function editableTypes(h) {
  return h.job === "berserker"
    ? ["attack", "heal", "selfharm", "blank"]
    : EDITABLE_TYPES.filter((t) => t !== "selfharm");
}
function faceDescription(face, h) {
  const tier = face.tier || 1;
  if (face.type === "class") return classAbilityDescription(h);
  const area = tier >= 3 ? " every enemy" : " the selected enemy";
  return (
    {
      attack: `Deal ${ATTACK_POWER[tier]} blade damage to${area}.`,
      magic: `Deal ${ATTACK_POWER[tier]} magic damage to${area}, with a chance to leave the target Vulnerable.`,
      heal: `Restore ${POWER.heal * tier} HP to your healing target. Can clear stun; more healing helps and more team block reduces the chance.`,
      block: `Add ${tier} shared team block. It absorbs damage for any party member and is spent as it protects them.`,
      stun: `Apply ${tier} stun power. Stops one enemy turn; higher power consumes more block and can break through it.`,
      poison: `Apply ${tier} poison power. Lasts up to 3 turns; repeated doses increase tick damage instead of adding a long duration.`,
      stimulant: `Apply ${tier} stimulant power to your ally: a short damage and resistance boost.`,
      selfharm: `Pay up to ${2 * tier} HP, staying above 0. Wounds feed Fury and this mark adds ${3 * tier} extra Fury.`,
      blank: "No effect. Inscribe a useful mark here with personal points.",
    }[face.type] || "A mark on this weighted reel."
  );
}
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
  return editableTypes(h)[
    (editableTypes(h).indexOf(type) + 1) % editableTypes(h).length
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
  if (!editableTypes(h).includes(type) || type === face.type) return undefined;
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
    `<div class="workshop-summary"><strong>${h.points} personal points</strong>${heroBuildMarkup(h)}</div>
    <p class="workshop-ability">Middle class mark: <b>${classAbilityName(h)}</b> · ${workshopAbilitySummary(h)}</p>
    <div class="workshop-step-label"><b>1. Choose a reel</b><span>Each reel rolls one weighted mark.</span></div>
    <div class="workshop-tabs" role="tablist" aria-label="Choose reel">${h.reels.map((_, r) => `<button role="tab" aria-selected="${r === k}" data-editor-reel="${r}">Reel ${r + 1}${r === 1 ? " · permanent class mark" : ""}</button>`).join("")}</div>
    <div class="reel-workshop"><div class="workshop-mark-list"><b class="workshop-step-label">2. Choose a mark to edit</b><div class="workshop-faces" role="group" aria-label="Weighted faces on reel ${k + 1}">${h.reels[k].map((f, n) => `<button data-editor-face="${n}" aria-pressed="${n === j}" title="${escapeHTML(faceDescription(f, h))}">${symbolMarkup(f)}<span>${f.type === "class" ? classAbilityName(h) : FACE_LABELS[f.type]}${!["class", "blank"].includes(f.type) ? " " + tierName(f.tier) : ""}</span><small>${Math.round((100 * (f.weight || 1)) / h.reels[k].reduce((sum, x) => sum + (x.weight || 1), 0))}% chance</small></button>`).join("")}</div></div>
    <section class="workshop-detail" aria-label="Selected face"><b class="workshop-step-label">3. Change this mark</b><div class="workshop-selected"><div class="workshop-preview">${symbolMarkup(face)}</div><h3>${locked ? classAbilityName(h) : FACE_LABELS[face.type] + (face.type !== "blank" ? " " + tierName(face.tier) : "")}</h3></div><p class="face-effect"><b>When it lands:</b> ${faceDescription(face, h)}</p>
    ${
      locked
        ? `<p class="locked-seal">${icon("class")}Permanent middle class mark<br>Cannot be upgraded, removed or copied.</p>`
        : `<div class="workshop-actions"><button class="primary" data-upgrade="${data}" ${!upgrade || h.points < upgrade ? "disabled" : ""}>${face.type === "blank" ? "Inscribe a mark" : "Upgrade ↑"}<small>${upgrade ? `${face.type === "blank" ? FACE_LABELS[primaryFace(h)] + " I" : "Rank " + tierName(face.tier) + " → " + tierName(face.tier + 1)} · spend ${upgrade} pts` : "Already at maximum rank"}</small></button><button data-weaken="${data}" ${!refund ? "disabled" : ""}>Downgrade ↓<small>${refund ? `Rank ${tierName(face.tier)} → ${tierName(face.tier - 1)} · get ${refund} pts back` : "Already at lowest rank"}</small></button></div><label class="swap-choice"><b>Or replace this symbol</b><select id="face-destination">${editableTypes(
            h,
          )
            .filter((t) => t !== face.type)
            .map(
              (t) =>
                `<option value="${t}">${FACE_LABELS[t]}${t !== "blank" ? " " + tierName(face.tier) : ""}</option>`,
            )
            .join(
              "",
            )}</select></label><p class="swap-effect" id="swap-effect"></p><button class="swap-face" id="face-swap">Replace symbol <small id="swap-price"></small></button>`
    }
    </section></div><p class="workshop-note">Percentages are the chance of this mark landing on this reel. Editing keeps those odds. Downgrade returns half the paid rank cost (at least 1 point); upgrading it again costs the full price.</p><div class="modal-actions"><button class="primary" data-close>Done · back to the adventure</button></div>`,
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
      $("#swap-price").textContent = "Spend " + cost + " points · same odds";
      $("#swap-effect").textContent = faceDescription(
        { type: select.value, tier: face.tier },
        h,
      );
      swap.disabled = h.points < cost;
    };
    select.onchange = update;
    update();
    swap.onclick = () => editFace(data, "swap", select.value);
  }
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

function workshopAbilitySummary(h) {
  return {
    fighter: "Build damage and resistance this fight.",
    rogue: "Roll three extra blade attacks.",
    mage: "Echo the rolled magic, healing, shield or poison marks across the whole team.",
    ranger: "Charge patience for a stronger finishing shot.",
    berserker: "Gain 4 Fury and +2 blade damage. Every 4 Fury adds 1 damage.",
  }[h.job];
}
