// Spending curves only. Gold income and banking amounts are deliberately unchanged.
const SUPPLY_PRICE_PREMIUM = Object.freeze({
  aegis: 70,
  salve: 45,
  firebomb: 25,
  venom: 30,
  oil: 15,
  ember: 15,
  frost: 15,
  chalk: 10,
  antidote: -15,
  ration: -10,
  bandage: -10,
});
const ECONOMY = Object.freeze({
  supplyBase: 80,
  supplyDepth: 12,
  supplyQuality: 35,
  equipmentBase: 170,
  equipmentDepth: 18,
  healBase: 120,
  healDepth: 30,
  mapBase: 90,
  mapDepth: 16,
  startingPurse: 150,
});
function shopPrices() {
  return {
    ...Object.fromEntries(
      Object.entries(ITEM_DEFS).map(([type, item]) => [
        type,
        item.equipment
          ? ECONOMY.equipmentBase + state.depth * ECONOMY.equipmentDepth
          : ECONOMY.supplyBase +
            (SUPPLY_PRICE_PREMIUM[item.family || type] || 0) +
            state.depth * ECONOMY.supplyDepth +
            ((item.quality || 1) - 1) * ECONOMY.supplyQuality,
      ]),
    ),
    heal: Math.round(
      (ECONOMY.healBase + state.depth * ECONOMY.healDepth) *
        (1 + 0.3 * Math.max(0, state.party.filter(alive).length - 1)),
    ),
    reveal: ECONOMY.mapBase + state.depth * ECONOMY.mapDepth,
  };
}
function campTier(family, rules = state?.runRules || []) {
  return Math.max(
    0,
    ...rules
      .filter((id) => CAMP_UNLOCKS[id]?.family === family)
      .map((id) => CAMP_UNLOCKS[id].rank),
  );
}
function lessonBonus(family, rules = state?.runRules || []) {
  return campTier(family, rules) * (CAMP_LESSONS[family]?.step || 0);
}
function campRollBonus(base) {
  const multiplier =
    1 + lessonBonus("power") / 100 + (ruleEnabled("glass") ? 0.1 : 0);
  for (const key of ["attack", "magic"])
    if (base[key]) base[key] = Math.round(base[key] * multiplier);
  return base;
}
