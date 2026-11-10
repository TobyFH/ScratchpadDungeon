// Browser-only benchmark setup. Real combat calculations and turn order stay live.
const noop = () => {};
const quick = async () => {};
for (const name of [
  "render",
  "renderParty",
  "renderEncounter",
  "renderMap",
  "renderBlock",
  "syncHero",
  "syncEnemy",
  "syncRangerAim",
  "syncStatusFX",
  "save",
  "log",
  "result",
  "toast",
  "burst",
  "shakeBook",
  "shakeElement",
  "floatAt",
  "combatNumber",
  "combatCallout",
  "actionLabel",
  "lunge",
  "sayHero",
  "sayEnemy",
  "portraitMotion",
  "partyCardFeedback",
  "armourFX",
  "shieldedFX",
  "screenFX",
  "levelUpFX",
  "passiveFX",
  "impactFlash",
  "smokePoof",
  "popTitle",
  "healingFX",
  "animate",
  "announceEnemyBadges",
  "enemyDeathPoof",
])
  window[name] = noop;
for (const name of [
  "pause",
  "feedbackPause",
  "classAbilityFX",
  "punchlineFX",
  "automaticOpeningPause",
  "classSignatureFX",
  "jackInTheBoxFX",
  "executionPayoffFX",
  "enemyWindup",
])
  window[name] = quick;
beam = () => Promise.resolve();
GameSound.play = noop;
enemyCry = noop;
characterLuck = () => 0.999999; // Rare personal saves do not carry the benchmark.
runMachine = async (id, reels) => {
  const combat = /^(hero-|enemy)/.test(id),
    faces = reels.map((r) => ({ ...weightedPick(r) }));
  if (combat) recoverStunsAfterRoll();
  return faces;
};
rollCritical = async (owner, symbols, enemy = false, options = {}) => {
  if (matchCount(symbols) !== 3) return 1;
  const n = pick(
    criticalPool(options.actor, { enemy, context: options.context }),
  );
  if (!enemy && options.actor && alive(options.actor)) addXP(options.actor, 1);
  return n;
};
processDeaths = quick;
recordDeath = (h, cause) => {
  h.dead = true;
  h.causeOfDeath = cause;
};
checkDefeat = () => {
  if (!state.party.some(alive)) {
    state.over = true;
    return true;
  }
  return false;
};
victory = async (e) => {
  for (const h of state.party.filter(alive)) {
    h.stats.battles++;
    addXP(h, encounterXP(state.depth, e, state.encounterReward?.count || 1));
    h.points++;
  }
  state.battlesWon++;
  clearBattleStatuses();
  state.enemy = null;
  state.enemies = [];
  state.block = 0;
  state.enemyBlock = 0;
};
