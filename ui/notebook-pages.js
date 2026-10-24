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
function lootFindCarousel(entries) {
  const target = $("#artefact-loot");
  if (!target) return;
  if (!entries.length) {
    target.innerHTML = "";
    return;
  }
  let page = 0;
  target.innerHTML = `<div class="loot-carousel"><div class="loot-find-page"></div><nav aria-label="Loot finds"><button id="loot-previous">←</button><span id="loot-count"></span><button id="loot-next">→</button></nav></div>`;
  const show = () => {
    target.querySelector(".loot-find-page").innerHTML = entries[page];
    $("#loot-count").textContent = `Find ${page + 1} / ${entries.length}`;
    $("#loot-previous").disabled = page === 0;
    $("#loot-next").disabled = page === entries.length - 1;
  };
  $("#loot-previous").onclick = () => {
    page--;
    show();
  };
  $("#loot-next").onclick = () => {
    page++;
    show();
  };
  show();
}
