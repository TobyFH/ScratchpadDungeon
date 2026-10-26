// Side pages suspend the current interaction rather than replacing its DOM or
// resolving its promise. Keeping the nodes preserves shop/equipment callbacks.
let utilityOpen = false,
  utilityContext = null,
  utilityWaiters = [];
function waitForUtility() {
  return utilityOpen
    ? new Promise((resolve) => utilityWaiters.push(resolve))
    : Promise.resolve();
}
function openUtilityPage(kind) {
  if (!utilityOpen) {
    const modal = $("#modal"),
      layer = $("#overlay"),
      fragment = document.createDocumentFragment();
    utilityContext = {
      kind: modalKind,
      previous: modalPrevious,
      hidden: layer.hidden,
      attributes: [...modal.attributes].map((a) => [a.name, a.value]),
      nodes: fragment,
      focus: document.activeElement,
    };
    while (modal.firstChild) fragment.append(modal.firstChild);
    pauseAutomaticReading();
    utilityOpen = true;
    document.body.classList.add("utility-open");
    for (const animation of liveAnimations)
      if (animation.playState === "running") {
        animation.pause();
        animation.utilityPaused = true;
      }
  }
  if (kind === "options") optionsPage();
  else if (kind === "bestiary") bestiaryPage();
  else help();
}
function closeUtilityPage() {
  if (!utilityOpen) return false;
  const context = utilityContext,
    modal = $("#modal");
  modal.replaceChildren(context.nodes);
  for (const attr of [...modal.attributes]) modal.removeAttribute(attr.name);
  for (const [key, value] of context.attributes) modal.setAttribute(key, value);
  $("#overlay").hidden = context.hidden;
  modalKind = context.kind;
  modalPrevious = context.previous;
  utilityOpen = false;
  resumeAutomaticReading();
  utilityContext = null;
  document.body.classList.remove("utility-open");
  for (const animation of liveAnimations)
    if (animation.utilityPaused) {
      animation.utilityPaused = false;
      if (animation.playState === "paused") animation.play();
    }
  context.focus?.isConnected && context.focus.focus();
  for (const resume of utilityWaiters.splice(0)) resume();
  fitDialogs();
  updateKeyboardBar();
  scheduleStunRecovery();
  return true;
}
const portraitMotions = new WeakMap();
function portraitMotion(el, kind = "talk", enemy = false) {
  if (
    !el ||
    preferences().portraitMotion <= 0 ||
    matchMedia("(prefers-reduced-motion: reduce)").matches
  )
    return;
  const art = el.querySelector(":scope > svg") || el;
  portraitMotions.get(art)?.cancel();
  const strength = preferences().portraitMotion,
    dir = enemy ? -1 : 1;
  const frames = {
    talk: [
      { transform: "translateY(0)" },
      {
        transform: `translateY(${-3 * strength}px) rotate(${-2 * strength}deg) scaleY(1.025)`,
      },
      { transform: `translateY(0) rotate(${2 * strength}deg)` },
      { transform: "none" },
    ],
    attack: [
      { transform: "none" },
      {
        transform: `translateX(${-5 * dir * strength}px) rotate(${-5 * dir * strength}deg)`,
        offset: 0.25,
      },
      {
        transform: `translateX(${15 * dir * strength}px) rotate(${9 * dir * strength}deg) scaleX(1.08) scaleY(.94)`,
        offset: 0.5,
      },
      { transform: "none" },
    ],
    hurt: [
      { transform: "none" },
      {
        transform: `translateX(${-10 * dir * strength}px) rotate(${-9 * dir * strength}deg) scaleY(.9) scaleX(1.07)`,
        offset: 0.2,
      },
      {
        transform: `translateX(${3 * dir * strength}px) rotate(${3 * dir * strength}deg)`,
        offset: 0.65,
      },
      { transform: "none" },
    ],
    death: [
      { transform: "none" },
      {
        transform: `translateY(${-4 * strength}px) rotate(${-6 * dir * strength}deg)`,
        offset: 0.2,
      },
      { transform: `translateY(${5 * strength}px) scaleY(.92)`, offset: 0.65 },
      { transform: "none" },
    ],
  };
  const animation = art.animate(frames[kind] || frames.talk, {
    duration: kind === "talk" ? 700 : kind === "death" ? 850 : 420,
    easing: "cubic-bezier(.2,.7,.3,1)",
  });
  animation.portraitMotion = true;
  portraitMotions.set(art, animation);
  animation.finished.catch(() => {});
}
// Retained function name for callers: all finds are visible together now.
function lootFindCarousel(entries) {
  const target = $("#artefact-loot");
  if (!target) return;
  target.dataset.presenting = "false";
  target.innerHTML = `<div class="loot-find-grid" data-count="${entries.length}">${entries.map((entry) => `<div class="loot-find-tile">${entry}</div>`).join("")}</div>`;
  target.querySelectorAll(".loot-find-tile").forEach((tile, i) => {
    const name = tile.querySelector("b")?.textContent || "";
    const item = Object.values(ITEM_DEFS).find((d) => name.startsWith(d.name));
    if (item) {
      tile.dataset.tooltip =
        (item.equipment ? equipmentScope(item) + ". " : "") + item.description;
      tile.tabIndex = 0;
      const p = tile.querySelector("p");
      if (p)
        p.innerHTML =
          (item.equipment
            ? `<b class="equipment-scope">${equipmentScope(item)}</b> `
            : "") +
          escapeHTML(
            item.equipment
              ? item.brief.replace(/^[^·]+only\s*·\s*/i, "")
              : item.brief,
          );
    }
    const artefact = state.artefacts.find((a) => a.name === name);
    if (artefact) {
      tile.dataset.tooltip = artefactText(artefact);
      tile.tabIndex = 0;
      const p = tile.querySelector("p");
      if (p)
        p.textContent =
          {
            attack: `+${artefact.power} physical damage`,
            heal: `+${artefact.power} healing`,
            block: `+${artefact.power} block · once per roll`,
            gold: `+${artefact.power}% loot gold`,
            guard: `${artefact.power} opening block`,
            revive: "Revive once · 75% HP",
          }[artefact.key] || artefactText(artefact);
    }
    setTimeout(() => {
      if (!tile.isConnected || $("#spotlight").hidden) return;
      GameSound.play("itemFind");
      burst(tile, "gold", 12);
      animate(
        tile,
        [
          { opacity: 0, transform: "scale(.86)" },
          { opacity: 1, transform: "scale(1.03)" },
          { opacity: 1, transform: "none" },
        ],
        { duration: 350, juice: true },
      );
    }, i * 180);
  });
  requestFitUI();
}

// Reset only this game's progress namespace; option preferences live separately.
function confirmProgressReset() {
  if (busy) {
    toast("Finish the current journey or event before resetting progress.");
    return;
  }
  openModal(
    "Start an empty notebook?",
    `<div class="reset-progress"><div class="stage-art">${icon("eraser")}</div><p>This erases the current run, banked gold, unlocked adventurers, camp lessons, bestiary and remembered companions.</p><p><b>Your options stay as they are.</b> Sound, lighting, controls and animation preferences are kept.</p></div><div class="modal-actions"><button id="confirm-save-reset" class="danger-button">Erase all progress</button><button class="primary" id="cancel-save-reset">Keep my notebook</button></div>`,
    "reset-save",
  );
  $("#cancel-save-reset").onclick = () => optionsPage("play");
  $("#confirm-save-reset").onclick = resetSaveProgress;
}
function resetSaveProgress() {
  if (busy || modalKind !== "reset-save") return false;
  const preserved = readSettings(),
    keys = [],
    backup = new Map();
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key.startsWith("scratchpad-dungeon-") &&
        key !== "scratchpad-dungeon-settings"
      )
        keys.push(key);
    }
    for (const key of keys) backup.set(key, localStorage.getItem(key));
    for (const key of keys) localStorage.removeItem(key);
    localStorage.setItem(
      "scratchpad-dungeon-settings",
      JSON.stringify(preserved),
    );
  } catch (error) {
    for (const [key, value] of backup)
      try {
        localStorage.setItem(key, value);
      } catch {}
    toast("The notebook could not be reset: " + error.message);
    return false;
  }
  if (utilityOpen) closeUtilityPage();
  stopCoinRain();
  document
    .querySelectorAll(".speech-bubble,.discovery-whisper,.rolled-projectile")
    .forEach((el) => el.remove());
  newRun();
  state.awaitingStarter = true;
  chooseStartingClass(true);
  save();
  toast("A clean notebook. Your options have been kept.");
  return true;
}

function fitLootFind(find) {
  const card = find?.querySelector(".item-find,.artefact-card");
  if (!card) return;
  const text = card.querySelector("div"),
    para = text?.querySelector("p"),
    title = text?.querySelector("b");
  if (!text || !para || !title) return;
  title.style.fontSize = "16px";
  para.style.fontSize = "14px";
  for (
    let size = 14;
    size >= 12 &&
    (text.scrollHeight > text.clientHeight + 1 ||
      text.scrollWidth > text.clientWidth + 1);
    size -= 0.5
  ) {
    para.style.fontSize = size + "px";
    title.style.fontSize = size + 2 + "px";
  }
}
