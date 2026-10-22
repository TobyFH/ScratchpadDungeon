// Camp progression is separate from the replaceable expedition save. Stable IDs
// are used in storage; this catalogue owns costs, prerequisites and UI copy.
// Gameplay hooks consult the expedition snapshot through ruleEnabled().
const PROFILE_KEY = "scratchpad-dungeon-camp-v1";
const CAMP_UNLOCKS = {
  ranger: {
    name: "A ranger's invitation",
    category: "ranger",
    cost: 80,
    permanent: true,
    description:
      "Rangers can appear as wandering companions. Their middle-reel Aim seal banks power for a later hit.",
  },
  rangerFocus: {
    name: "Patient aim",
    category: "ranger",
    cost: 110,
    requires: "ranger",
    description: "Rangers store 2 extra power whenever Aim lands.",
  },
  rangerHeart: {
    name: "Trail endurance",
    category: "ranger",
    cost: 90,
    requires: "ranger",
    description: "New rangers have 6 extra maximum HP.",
  },
  rangerStart: {
    name: "A place at the campfire",
    category: "ranger",
    cost: 140,
    requires: "ranger",
    description: "Offer Ranger as a starting class.",
  },
  provisions: {
    name: "A little spending money",
    category: "boons",
    cost: 60,
    description: "Begin each expedition with 20 gold.",
  },
  hearty: {
    name: "A hearty breakfast",
    category: "boons",
    cost: 100,
    description: "New adventurers have 4 extra maximum HP.",
  },
  company: {
    name: "Spread the word",
    category: "boons",
    cost: 95,
    description: "Wandering companions are 25% more likely to appear.",
  },
  springs: {
    name: "Follow the water",
    category: "boons",
    cost: 85,
    description: "One additional healing well on each floor.",
  },
  iron: {
    name: "Iron margins",
    category: "challenges",
    cost: 65,
    description:
      "Enemies have 20% more HP and 10% more base damage (rounded up).",
  },
  crowded: {
    name: "Never alone",
    category: "challenges",
    cost: 70,
    description:
      "Double encounters are 8 percentage points more likely, capped at 33%.",
  },
  drought: {
    name: "Dry ink",
    category: "challenges",
    cost: 55,
    description: "One fewer healing well on each floor.",
  },
  hunted: {
    name: "Restless pages",
    category: "challenges",
    cost: 60,
    description:
      "The Unwritten begins hunting after 12 revealed tiles instead of 18, from floor 3.",
  },
  golden: {
    name: "Heavy pockets",
    category: "oddities",
    cost: 90,
    description: "One extra treasure chest per floor.",
  },
  lanterns: {
    name: "Leave a light on",
    category: "oddities",
    cost: 75,
    description: "One extra beacon per floor.",
  },
  markets: {
    name: "Travelling market",
    category: "oddities",
    cost: 100,
    description: "Shop chance rises from 30% to 60% per floor.",
  },
  sharp: {
    name: "Both ends sharpened",
    category: "oddities",
    cost: 80,
    description:
      "Heroes gain 1 damage on damaging rolls; enemies gain 1 base damage.",
  },
};
function emptyProfile() {
  return { version: 1, gold: 0, owned: [], enabled: [], deposits: {} };
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
  const owned = [
    ...new Set(p.owned.filter((id) => Object.hasOwn(CAMP_UNLOCKS, id))),
  ];
  return {
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
    deposits,
  };
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
  return [...p.owned.filter((id) => CAMP_UNLOCKS[id].permanent), ...p.enabled];
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
    if (
      Object.hasOwn(p.deposits, key) &&
      !Object.hasOwn(state.bankedFloors, depth)
    ) {
      state.gold = Math.max(0, state.gold - p.deposits[key]);
      state.bankedFloors[depth] = p.deposits[key];
    }
  }
}
function bankGold(percent) {
  if (
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
    p.gold += amount;
    p.deposits[key] = amount;
    localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
    state.gold -= amount;
    state.bankedFloors ??= {};
    state.bankedFloors[state.depth] = amount;
    save();
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
    p.gold -= def.cost;
    p.owned.push(id);
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
function campPage(category = "ranger") {
  const p = campProfile(),
    tabs = {
      ranger: "Ranger",
      boons: "Provisions",
      challenges: "Challenges",
      oddities: "Oddities",
    };
  if (!Object.hasOwn(tabs, category)) category = "ranger";
  openModal(
    "Camp upgrades",
    `<div class="camp-balance">${icon("coin")}<strong>${p.gold} gold banked</strong><span>Unlock once. Choose your rules for the next expedition.</span></div>${p.error ? `<p role="alert">${escapeHTML(p.error)}</p>` : ""}<div class="settings-tabs" role="tablist" aria-label="Camp upgrades">${Object.entries(
      tabs,
    )
      .map(
        ([id, label]) =>
          `<button role="tab" aria-selected="${id === category}" data-camp-tab="${id}">${label}</button>`,
      )
      .join("")}</div><div class="camp-grid">${Object.entries(CAMP_UNLOCKS)
      .filter(([, d]) => d.category === category)
      .map(([id, d]) => {
        const owned = p.owned.includes(id),
          locked = d.requires && !p.owned.includes(d.requires);
        return `<article class="pencil-card camp-card"><h3>${d.name}</h3><p>${d.description}</p>${owned ? (d.permanent ? '<strong class="camp-owned">Unlocked · always available</strong>' : `<button data-camp-toggle="${id}" aria-pressed="${p.enabled.includes(id)}">${p.enabled.includes(id) ? "Enabled next run ✓" : "Enable next run"}</button>`) : `<button data-camp-buy="${id}" ${p.gold < d.cost || locked || p.error ? "disabled" : ""}>${locked ? "Requires Ranger invitation" : "Unlock · " + d.cost + " gold"}</button>`}</article>`;
      })
      .join(
        "",
      )}</div><div class="modal-actions"><button class="primary" id="camp-return">Choose adventurer ↗</button></div>`,
    "camp",
  );
  if (campInitial) $("#modal .close").hidden = true;
  $("#camp-return").onclick = () => chooseStartingClass(campInitial);
  document
    .querySelectorAll("[data-camp-tab]")
    .forEach((b) => (b.onclick = () => campPage(b.dataset.campTab)));
  document
    .querySelectorAll("[data-camp-buy]")
    .forEach((b) => (b.onclick = () => purchaseUnlock(b.dataset.campBuy)));
  document
    .querySelectorAll("[data-camp-toggle]")
    .forEach((b) => (b.onclick = () => toggleUnlock(b.dataset.campToggle)));
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
