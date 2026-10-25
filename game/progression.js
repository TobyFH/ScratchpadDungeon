// The catalogue owns stable purchase IDs. Owned lessons and selected active ranks
// are independent; only selected ranks are snapshotted into a new expedition.
const PROFILE_KEY = "scratchpad-dungeon-camp-v1";
const CAMP_LESSONS = Object.freeze({
  vitality: {
    name: "Stouter hearts",
    step: 10,
    unit: "% base health",
    costs: [750, 1500, 3000, 5500, 9000],
  },
  power: {
    name: "Practised strikes",
    step: 5,
    unit: "% blade and magic damage",
    costs: [900, 2000, 4500, 7500, 12000],
  },
  experience: {
    name: "Lessons remembered",
    step: 5,
    unit: "% earned EXP",
    costs: [800, 1800, 4000, 6800, 10500],
  },
  purse: {
    name: "Coins for the road",
    step: 50,
    unit: " starting gold",
    costs: [400, 800, 1400, 2300, 3600],
  },
  recovery: {
    name: "Mending hands",
    step: 1,
    unit: " HP to each healing effect",
    costs: [650, 1400, 2800, 4800, 7600],
  },
  warding: {
    name: "Shields by the fire",
    step: 1,
    unit: " opening team block",
    costs: [600, 1300, 2600, 4500, 7200],
  },
  fellowship: {
    name: "A welcome at the fire",
    step: 5,
    unit: "% companion likelihood",
    costs: [650, 1400, 2800, 4700, 7400],
  },
  fortune: {
    name: "An eye for silver",
    step: 3,
    unit: "% gold from chests and spoils",
    costs: [550, 1200, 2400, 4100, 6500],
  },
});
const CAMP_UNLOCKS = {
  ranger: {
    name: "A ranger's invitation",
    category: "classes",
    cost: 900,
    permanent: true,
    description:
      "Unlock Ranger starts and companions. Build patience, then Execute wounded enemies.",
  },
  berserker: {
    name: "A berserker’s oath",
    category: "classes",
    cost: 750,
    permanent: true,
    description:
      "Unlock Berserker starts and companions. Wounds fuel Fury; Bloodrush and lifesteal mend them.",
  },
  jester: {
    name: "A jester’s invitation",
    category: "classes",
    cost: 1400,
    permanent: true,
    description:
      "Unlock Jester starts and companions. Trick marks build anticipation for a stronger Punchline roll.",
  },
  iron: {
    name: "Iron margins",
    category: "challenges",
    cost: 600,
    description: "Enemies gain 20% HP and 10% base damage.",
  },
  crowded: {
    name: "Never alone",
    category: "challenges",
    cost: 700,
    description:
      "Double encounters gain 8 percentage points of likelihood, capped at 33%.",
  },
  drought: {
    name: "Dry ink",
    category: "challenges",
    cost: 500,
    description: "One fewer healing well on every floor.",
  },
  hunted: {
    name: "Restless pages",
    category: "challenges",
    cost: 650,
    description:
      "The Unwritten wakes after 12 revealed tiles rather than 18, from floor 3.",
  },
  sharp: {
    name: "Both ends sharpened",
    category: "challenges",
    cost: 800,
    description:
      "Damaging hero rolls gain 1 damage; enemy base damage also increases by 1.",
  },
  glass: {
    name: "Glass courage",
    category: "challenges",
    cost: 1100,
    description:
      "New heroes have 15% less base HP, but blade and magic rolls gain 10% damage.",
  },
  richFoes: {
    name: "Gilded foes",
    category: "challenges",
    cost: 1000,
    description: "Enemies gain 15% HP. Battle spoils yield 25% more gold.",
  },
  restless: {
    name: "Quick tempers",
    category: "challenges",
    cost: 1200,
    description:
      "Enemies attack one spin sooner (minimum one). Earn 15% more battle EXP.",
  },
  golden: {
    name: "Coin-scarred rooms",
    category: "oddities",
    cost: 1900,
    description: "One extra chest and one extra trap on every floor.",
  },
  lanterns: {
    name: "Leave a light on",
    category: "oddities",
    cost: 1200,
    description: "An extra beacon changes what you can discover on each floor.",
  },
  markets: {
    name: "Travelling market",
    category: "oddities",
    cost: 2200,
    get description() {
      return `A travelling shop appears on ${Math.round(WORLD_BALANCE.marketChance * 100)}% of floors, instead of ${Math.round(WORLD_BALANCE.shopChance * 100)}%.`;
    },
  },
  echoes: {
    name: "Hollow footsteps",
    category: "oddities",
    cost: 1500,
    description:
      "Paired tunnels become much more common, changing your routes through the notebook.",
  },
};
for (const [family, lesson] of Object.entries(CAMP_LESSONS))
  lesson.costs.forEach((cost, index) => {
    const rank = index + 1;
    CAMP_UNLOCKS[family + rank] = {
      name: lesson.name,
      category: "training",
      family,
      rank,
      cost,
      permanent: true,
      requires: index ? family + index : null,
      description: `+${lesson.step * rank}${lesson.unit}.`,
    };
  });
const LEGACY_CAMP_LESSONS = Object.freeze({
  provisions: ["purse", 3],
  hearty: ["vitality", 1],
  company: ["fellowship", 5],
  springs: ["recovery", 3],
});
function ownedLessonRank(family, profile) {
  return Math.max(
    0,
    ...profile.owned
      .filter((id) => CAMP_UNLOCKS[id]?.family === family)
      .map((id) => CAMP_UNLOCKS[id].rank),
  );
}
function selectedLessonRank(family, profile) {
  const owned = ownedLessonRank(family, profile),
    chosen = profile.activeTraining?.[family];
  return Number.isSafeInteger(chosen)
    ? Math.max(0, Math.min(owned, chosen))
    : owned;
}
function emptyProfile() {
  return {
    version: 1,
    gold: 0,
    owned: [],
    enabled: [],
    activeTraining: {},
    deposits: {},
  };
}
function readProfile() {
  const raw = localStorage.getItem(PROFILE_KEY);
  if (!raw) return emptyProfile();
  const p = JSON.parse(raw);
  const money = (n) => Number.isSafeInteger(n) && n >= 0;
  if (
    p?.version !== 1 ||
    !money(p.gold) ||
    !Array.isArray(p.owned) ||
    !Array.isArray(p.enabled) ||
    !p.deposits ||
    typeof p.deposits !== "object" ||
    Array.isArray(p.deposits)
  )
    throw Error(
      "The camp record is invalid. Keep a backup before restoring it.",
    );
  const deposits = {};
  for (const [id, amount] of Object.entries(p.deposits)) {
    if (!/^[a-zA-Z0-9-]+:\d{1,2}$/.test(id) || !money(amount))
      throw Error("The camp's banking record is invalid.");
    deposits[id] = amount;
  }
  let migratedLessons = false;
  const legacyActive = {};
  const priorRanks = Object.fromEntries(
    Object.keys(CAMP_LESSONS).map((family) => [
      family,
      Math.max(
        0,
        ...p.owned
          .filter((id) => CAMP_UNLOCKS[id]?.family === family)
          .map((id) => CAMP_UNLOCKS[id].rank),
      ),
    ]),
  );
  for (const [oldId, [family, rank]] of Object.entries(LEGACY_CAMP_LESSONS)) {
    if (!p.owned.includes(oldId)) continue;
    migratedLessons = true;
    const active = p.enabled.includes(oldId);
    p.owned = p.owned.filter((id) => id !== oldId);
    p.enabled = p.enabled.filter((id) => id !== oldId);
    for (let r = 1; r <= rank; r++) p.owned.push(family + r);
    legacyActive[family] = Math.max(priorRanks[family], active ? rank : 0);
  }
  const owned = [
    ...new Set(p.owned.filter((id) => Object.hasOwn(CAMP_UNLOCKS, id))),
  ];
  const profile = {
    version: 1,
    gold: p.gold,
    owned,
    enabled: [
      ...new Set(
        p.enabled.filter(
          (id) => owned.includes(id) && !CAMP_UNLOCKS[id].permanent,
        ),
      ),
    ],
    activeTraining: {},
    deposits,
    rangerRefunded: p.rangerRefunded === true,
  };
  for (const family of Object.keys(CAMP_LESSONS)) {
    const ownedRank = ownedLessonRank(family, profile),
      raw = p.activeTraining?.[family];
    profile.activeTraining[family] = Number.isSafeInteger(raw)
      ? Math.max(0, Math.min(raw, ownedRank))
      : Object.hasOwn(legacyActive, family)
        ? Math.min(ownedRank, legacyActive[family])
        : ownedRank;
  }
  const removed = { rangerFocus: 110, rangerHeart: 90, rangerStart: 140 };
  const obsolete = p.owned.filter((id) => Object.hasOwn(removed, id));
  if (obsolete.length) {
    const refund = profile.rangerRefunded
      ? 0
      : [...new Set(obsolete)].reduce((n, id) => n + removed[id], 0);
    if (!Number.isSafeInteger(profile.gold + refund))
      throw Error("The camp refund exceeds its balance limit.");
    profile.gold += refund;
    profile.rangerRefunded = true;
    // Persist the refund and retirement together so repeated reads cannot pay twice.
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  }
  if (migratedLessons)
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  return profile;
}
function campProfile() {
  try {
    return readProfile();
  } catch (error) {
    console.warn("Camp record:", error.message);
    return { ...emptyProfile(), error: error.message };
  }
}
function expeditionRules() {
  const p = campProfile();
  return [
    ...p.owned.filter(
      (id) => CAMP_UNLOCKS[id].permanent && !CAMP_UNLOCKS[id].family,
    ),
    ...Object.keys(CAMP_LESSONS).flatMap((family) => {
      const rank = selectedLessonRank(family, p);
      return rank ? [family + rank] : [];
    }),
    ...p.enabled,
  ];
}
function ruleEnabled(id) {
  return !!state?.runRules?.includes(id);
}
function newExpeditionId() {
  return (
    globalThis.crypto?.randomUUID?.() ||
    "run-" + Date.now() + "-" + performance.now().toString().replace(".", "-")
  );
}
function reconcileBanking() {
  state.runId ??= newExpeditionId();
  state.bankedFloors ??= {};
  const p = campProfile();
  // The profile write is the banking commit. If writing the run save failed
  // immediately afterwards, apply the committed withdrawal exactly once here.
  for (let depth = 1; depth <= 10; depth++) {
    const key = state.runId + ":" + depth;
    if (Object.hasOwn(p.deposits, key)) {
      const acknowledged = state.bankedFloors[depth] || 0,
        difference = p.deposits[key] - acknowledged;
      if (difference > 0) {
        state.gold = Math.max(0, state.gold - difference);
        state.bankedFloors[depth] = p.deposits[key];
      }
    }
  }
}
// Shared commit order: profile first, expedition acknowledgement second.
// Extending the tenth-floor deposit also upgrades older partially banked wins.
function commitCampDeposit(profile, amount) {
  const key = state.runId + ":" + state.depth;
  if (
    !Number.isSafeInteger(amount) ||
    amount <= 0 ||
    amount > state.gold ||
    !Number.isSafeInteger(profile.gold + amount) ||
    !Number.isSafeInteger((profile.deposits[key] || 0) + amount)
  )
    throw Error("The deposit exceeds its balance limit.");
  profile.gold += amount;
  profile.deposits[key] = (profile.deposits[key] || 0) + amount;
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  state.gold -= amount;
  state.bankedFloors ??= {};
  state.bankedFloors[state.depth] = profile.deposits[key];
  save();
}
function bankVictoryGold() {
  if (!state.won || state.depth !== 10) return false;
  try {
    // Reconcile a previous successful profile write before considering a retry.
    reconcileBanking();
    const profile = readProfile(),
      amount = state.gold;
    if (!Number.isSafeInteger(amount) || amount < 0)
      throw Error("The carried gold balance is invalid.");
    if (amount > 0) commitCampDeposit(profile, amount);
    state.victoryBanked = profile.deposits[state.runId + ":10"] || 0;
    state.victoryBankPending = false;
    save();
    document
      .querySelectorAll("[data-run-gold]")
      .forEach((el) => (el.textContent = state.gold));
    document
      .querySelectorAll("[data-run-banked]")
      .forEach(
        (el) =>
          (el.textContent = Object.values(state.bankedFloors || {}).reduce(
            (n, v) => n + v,
            0,
          )),
      );
    return amount;
  } catch (error) {
    state.victoryBankPending = true;
    save();
    toast("Victory gold is still with the party: " + error.message);
    return false;
  }
}
function victoryBankingMarkup() {
  const total = state.bankedFloors?.[10] || 0;
  return `<section class="victory-banking" aria-label="Victory gold"><strong>${total} gold sent to camp</strong><p>${state.victoryBankPending ? "Your remaining gold is safe with the party until camp can be saved." : "All carried gold, including the final reward, has been banked."}</p>${state.victoryBankPending ? "<button data-retry-victory-bank>Retry saving victory gold</button>" : ""}</section>`;
}
function bankGold(percent) {
  if (
    state.won ||
    ![25, 50, 75, 100].includes(percent) ||
    !state.floorClears?.some((f) => f.depth === state.depth) ||
    (!state.floorBossDefeated && !state.won)
  )
    return false;
  try {
    const p = readProfile(),
      key = state.runId + ":" + state.depth;
    if (Object.hasOwn(p.deposits, key)) {
      reconcileBanking();
      return false;
    }
    if (!Number.isSafeInteger(state.gold) || state.gold <= 0) return false;
    const amount = Math.floor((state.gold * percent) / 100);
    if (amount <= 0 || !Number.isSafeInteger(p.gold + amount)) return false;
    commitCampDeposit(p, amount);
    render();
    log(
      amount + " gold sent to camp. " + state.gold + " stays with the party.",
    );
    GameSound.play("reward");
    goldCelebration(amount, true);
    document
      .querySelectorAll("[data-bank]")
      .forEach((b) => (b.disabled = true));
    document
      .querySelectorAll(".bank-status")
      .forEach(
        (el) =>
          (el.textContent =
            amount +
            " gold banked · " +
            p.gold +
            " at camp · " +
            state.gold +
            " carried"),
      );
    document
      .querySelectorAll("[data-run-gold]")
      .forEach((el) => (el.textContent = state.gold));
    document
      .querySelectorAll("[data-run-banked]")
      .forEach(
        (el) =>
          (el.textContent = Object.values(state.bankedFloors).reduce(
            (n, amount) => n + amount,
            0,
          )),
      );
    return amount;
  } catch (error) {
    toast("Gold was not banked: " + error.message);
    return false;
  }
}
function bankingMarkup() {
  const amount = state.bankedFloors?.[state.depth],
    p = campProfile();
  return `<section class="banking-panel" aria-label="Bank gold"><p class="bank-status">${amount !== undefined ? amount + " gold banked on this floor" : "Send some gold to camp? Keep the rest for this expedition."} · ${p.gold} at camp</p><div class="bank-choices">${[25, 50, 75, 100].map((percent) => `<button data-bank="${percent}" ${amount !== undefined || Math.floor((state.gold * percent) / 100) <= 0 || p.error ? "disabled" : ""}>Bank ${percent}%<small>${Math.floor((state.gold * percent) / 100)} gold</small></button>`).join("")}</div></section>`;
}
function purchaseUnlock(id) {
  if (!Object.hasOwn(CAMP_UNLOCKS, id) || modalKind !== "camp") return false;
  const def = CAMP_UNLOCKS[id];
  try {
    const p = readProfile();
    if (
      p.owned.includes(id) ||
      p.gold < def.cost ||
      (def.requires && !p.owned.includes(def.requires))
    )
      return false;
    const previouslyOwned = def.family ? ownedLessonRank(def.family, p) : 0,
      previouslySelected = def.family ? selectedLessonRank(def.family, p) : 0;
    p.gold -= def.cost;
    p.owned.push(id);
    if (def.family && previouslySelected === previouslyOwned)
      p.activeTraining[def.family] = def.rank;
    // Buying a modifier never silently enables it. Players choose their rules.
    localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
    GameSound.play("reward");
    campPage(def.category);
    return true;
  } catch (error) {
    toast("Purchase was not saved: " + error.message);
    return false;
  }
}
function toggleUnlock(id) {
  if (
    modalKind !== "camp" ||
    !Object.hasOwn(CAMP_UNLOCKS, id) ||
    CAMP_UNLOCKS[id].permanent
  )
    return false;
  try {
    const p = readProfile();
    if (!p.owned.includes(id)) return false;
    p.enabled = p.enabled.includes(id)
      ? p.enabled.filter((key) => key !== id)
      : [...p.enabled, id];
    localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
    campPage(CAMP_UNLOCKS[id].category);
    return true;
  } catch (error) {
    toast("Camp settings were not saved: " + error.message);
    return false;
  }
}
let campInitial = false;
function nextTrainingCard(family, p) {
  const entries = Object.entries(CAMP_UNLOCKS)
    .filter(([, d]) => d.family === family)
    .sort((a, b) => a[1].rank - b[1].rank);
  return (entries.find(([id]) => !p.owned.includes(id)) || entries.at(-1))[0];
}
let campLeaf = 0,
  campCategory = "classes",
  campPageSize = 4;
function responsiveCampPage() {
  const size = campCategory !== "classes" && innerWidth <= 760 ? 2 : 4;
  if (modalKind !== "camp" || size === campPageSize) return false;
  campPage(campCategory, Math.floor((campLeaf * campPageSize) / size));
  return true;
}
function setActiveLesson(family, rank) {
  if (
    modalKind !== "camp" ||
    !Object.hasOwn(CAMP_LESSONS, family) ||
    !Number.isSafeInteger(rank)
  )
    return false;
  try {
    const p = readProfile();
    if (rank < 0 || rank > ownedLessonRank(family, p)) return false;
    p.activeTraining[family] = rank;
    localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
    campPage("training", campLeaf);
    return true;
  } catch (error) {
    toast("Active lesson was not saved: " + error.message);
    return false;
  }
}
function campPage(category = "classes", leaf = null) {
  const p = campProfile(),
    tabs = {
      classes: "Adventurers",
      training: "Campfire Lessons",
      challenges: "Challenges",
      oddities: "Oddities",
    };
  if (category === "boons") category = "training";
  if (!Object.hasOwn(tabs, category)) category = "classes";
  if (category !== campCategory) campLeaf = 0;
  campCategory = category;
  const entries = Object.entries(CAMP_UNLOCKS).filter(
      ([id, d]) =>
        d.category === category &&
        (!d.family || id === nextTrainingCard(d.family, p)),
    ),
    pageSize = category !== "classes" && innerWidth <= 760 ? 2 : 4,
    count = Math.ceil(entries.length / pageSize);
  campLeaf = Math.max(0, Math.min(count - 1, leaf ?? campLeaf));
  campPageSize = pageSize;
  const visible = entries.slice(
    campLeaf * pageSize,
    campLeaf * pageSize + pageSize,
  );
  openModal(
    "By the campfire",
    `
    <div class="camp-balance">${icon("coin")}<strong>${p.gold} gold banked</strong><span>Buy once. Choose your lessons and rules before the next expedition.</span></div>
    ${p.error ? `<p role="alert">${escapeHTML(p.error)}</p>` : ""}
    <nav class="settings-tabs" role="tablist" aria-label="Camp pages">${Object.entries(
      tabs,
    )
      .map(
        ([id, name]) =>
          `<button role="tab" aria-selected="${id === category}" data-camp-tab="${id}">${name}</button>`,
      )
      .join("")}</nav>
    <nav class="camp-leaf-nav" aria-label="More camp choices"><button id="camp-previous" ${campLeaf === 0 ? "disabled" : ""}>← Previous</button><span>${tabs[category]} · ${campLeaf + 1} / ${count}</span><button id="camp-next" ${campLeaf === count - 1 ? "disabled" : ""}>Next →</button></nav>
    <div class="camp-grid" data-category="${category}">${visible
      .map(([id, d]) => {
        const owned = p.owned.includes(id),
          locked = d.requires && !p.owned.includes(d.requires),
          rank = d.family ? selectedLessonRank(d.family, p) : 0,
          earned = d.family ? ownedLessonRank(d.family, p) : 0;
        return `<article class="pencil-card camp-card" data-camp-id="${id}">
        ${d.category === "classes" ? `<div class="camp-class-art">${portraitArt(id)}</div>` : ""}
        <h3>${d.name}${d.family ? ` · ${earned}/5` : ""}</h3>
        <p>${d.family ? `${earned === 5 ? "Highest learned" : "Next lesson"}: ${d.description}` : d.description}</p>
        ${d.family ? `<div class="active-lesson" aria-label="Active ${d.name}"><button data-lesson-family="${d.family}" data-lesson-rank="${rank - 1}" aria-label="Decrease ${d.name}" ${!rank ? "disabled" : ""}>−</button><span><b>Active ${rank} / ${earned}</b><small>${rank ? CAMP_UNLOCKS[d.family + rank].description : "No bonus next run"}</small></span><button data-lesson-family="${d.family}" data-lesson-rank="${rank + 1}" aria-label="Increase ${d.name}" ${rank >= earned ? "disabled" : ""}>+</button></div>` : ""}
        ${owned ? (d.family ? '<strong class="camp-owned">All five lessons learned</strong>' : d.permanent ? '<strong class="camp-owned">Unlocked · always available</strong>' : `<button data-camp-toggle="${id}" aria-pressed="${p.enabled.includes(id)}">${p.enabled.includes(id) ? "Enabled next run ✓" : "Enable next run"}</button>`) : `<button data-camp-buy="${id}" ${p.gold < d.cost || locked || p.error ? "disabled" : ""}>${d.family ? `Learn tier ${d.rank} · ` : "Unlock · "}${d.cost} gold</button>`}
      </article>`;
      })
      .join("")}</div>
    <div class="modal-actions"><button class="primary" id="camp-return">Choose adventurer ↗</button></div>`,
    "camp",
  );
  if (campInitial) $("#modal .close").hidden = true;
  $("#camp-return").onclick = () => chooseStartingClass(campInitial);
  $("#camp-previous").onclick = () => campPage(category, campLeaf - 1);
  $("#camp-next").onclick = () => campPage(category, campLeaf + 1);
  document
    .querySelectorAll("[data-camp-tab]")
    .forEach((b) => (b.onclick = () => campPage(b.dataset.campTab)));
  document
    .querySelectorAll("[data-camp-buy]")
    .forEach((b) => (b.onclick = () => purchaseUnlock(b.dataset.campBuy)));
  document
    .querySelectorAll("[data-camp-toggle]")
    .forEach((b) => (b.onclick = () => toggleUnlock(b.dataset.campToggle)));
  document
    .querySelectorAll("[data-lesson-rank]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          setActiveLesson(
            b.dataset.lessonFamily,
            Number(b.dataset.lessonRank),
          )),
    );
  wireSettingsTabs();
}
function wireSettingsTabs() {
  const tabs = [...document.querySelectorAll('#modal [role="tab"]')];
  tabs.forEach(
    (b, i) =>
      (b.onkeydown = (e) => {
        let n =
          e.key === "ArrowRight"
            ? (i + 1) % tabs.length
            : e.key === "ArrowLeft"
              ? (i + tabs.length - 1) % tabs.length
              : e.key === "Home"
                ? 0
                : e.key === "End"
                  ? tabs.length - 1
                  : -1;
        if (n < 0) return;
        e.preventDefault();
        tabs[n].click();
        document.querySelectorAll('#modal [role="tab"]')[n]?.focus();
      }),
  );
}
