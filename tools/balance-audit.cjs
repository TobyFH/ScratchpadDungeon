#!/usr/bin/env node
// Controlled combat gauntlet, NOT a forecast of human campaign win rates.
// Uses real spin(), weighted faces, class abilities, AI edits, statuses and clocks.
// Presentation/confirmation waits and loot are suppressed; no alternate combat engine.
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright");
(async () => {
  const html = fs.readFileSync(path.join(__dirname, "../index.html"));
  const server = http.createServer((req, res) => {
    res.setHeader("Content-Type", "text/html");
    res.end(html);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (msg) => {
      if (msg.type() === "log") console.error(msg.text());
    });
    await page.goto("http://127.0.0.1:" + server.address().port);
    const result = await page.evaluate(
      async ({ runs }) => {
        // Everything below is test-only. The shipped game has no simulation switch.
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
        ])
          window[name] = noop;
        for (const name of [
          "pause",
          "feedbackPause",
          "classAbilityFX",
          "punchlineFX",
          "automaticOpeningPause",
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
          if (!enemy && options.actor && alive(options.actor))
            addXP(options.actor, 1);
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
            addXP(
              h,
              encounterXP(state.depth, e, state.encounterReward?.count || 1),
            );
            h.points++;
          }
          state.battlesWon++;
          clearBattleStatuses();
          state.enemy = null;
          state.enemies = [];
          state.block = 0;
          state.enemyBlock = 0;
        };
        // Stop asynchronous automatic drivers; choose with the same shipped actor policy.
        const rows = [];
        for (const rank of [0, 2.5, 5])
          for (let seed = 1; seed <= runs; seed++) {
            console.log(`Audit rank ${rank}, seed ${seed}`);
            Date.now = () => 1800000000000 + seed * 1000;
            let rng = seed;
            Math.random = () => {
              rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
              return rng / 4294967296;
            };
            const job = ["fighter", "rogue", "mage"][(seed - 1) % 3];
            newRun(job);
            closeModal();
            closeSpotlight();
            busy = false;
            state.awaitingStarter = false;
            state.autoplay = false;
            state.autoresolve = false;
            state.runRules = rank
              ? Object.keys(CAMP_LESSONS).map(
                  (f, i) => f + (rank === 2.5 ? (i % 2 ? 3 : 2) : rank),
                )
              : [];
            state.party = [
              makeHero("Starter", job, null, state.runRules, {
                specialism: seed % 2 ? "offence" : "defence",
              }),
            ];
            state.artefacts = [];
            state.equippedArtefact = null;
            state.map.forEach((c) => {
              c.terrain = c.wall ? "stone" : "floor";
            });
            let won = true,
              rolls = 0,
              stalled = false;
            for (let depth = 1; depth <= 10 && won; depth++) {
              state.depth = depth;
              state.floorBossDefeated = false;
              if ([3, 5].includes(depth)) {
                const next =
                  depth === 3 ? (job === "mage" ? "fighter" : "mage") : "rogue";
                const h = makeHero(
                  "Companion " + depth,
                  next,
                  null,
                  state.runRules,
                );
                prepareRecruit(h);
                state.party.push(h);
              }
              for (let fight = 0; fight < 4 && won; fight++) {
                state.party.filter(alive).forEach(autoUpgradeHero);
                beginEncounter(fight === 3, {
                  count:
                    fight === 3
                      ? 1
                      : Math.random() < doubleBattleChance(depth)
                        ? 2
                        : 1,
                });
                // Resolve all-surprised opening exactly as the arrival confirmation does.
                if (state.opening?.pending) await resolveBattleOpening();
                let turns = 0;
                while (state.enemy && !state.over && turns++ < 200) {
                  const candidates = state.party
                    .map((h, i) => ({ h, i }))
                    .filter((x) => alive(x.h) && openingEligible(x.h));
                  const actor = autoChooseActor(candidates);
                  if (!actor || (state.autoCombat?.staleSpins || 0) >= 60) {
                    stalled = true;
                    won = false;
                    break;
                  }
                  state.target = autoHealth().weakest?.i || 0;
                  state.enemy = livingEnemies().sort((a, b) => a.hp - b.hp)[0];
                  const beforeDamage = actor.h.stats.damageDealt || 0;
                  await spin(actor.i);
                  recordAutoCombatProgress(actor.h, beforeDamage);
                  rolls++;
                  // Real autofight already has no-progress protection; flag equivalent cap.
                }
                if (turns >= 200) {
                  stalled = true;
                  won = false;
                }
                if (state.over || !state.party.some(alive)) won = false;
                // One used well per floor after the third ordinary encounter, using its real formula.
                if (fight === 2 && won)
                  for (const h of state.party.filter(alive)) {
                    const heal =
                      Math.ceil(h.maxHp * fountainBaseRate(depth)) +
                      Math.ceil(6 * fountainRollRate(depth));
                    healHero(state.party.indexOf(h), heal);
                  }
              }
            }
            rows.push({
              rank,
              seed,
              job,
              won,
              depth: state.depth,
              rolls,
              stalled,
              survivors: state.party.filter(alive).length,
              roster: state.party.map((h) => ({
                job: h.job,
                level: h.level,
                hp: h.hp,
                maxHp: h.maxHp,
                points: h.points,
                archetype: h.autoArchetype,
                fx: expectedHeroEffects(h),
                faces: h.reels
                  .flat()
                  .reduce(
                    (o, f) => ((o[f.type] = (o[f.type] || 0) + 1), o),
                    {},
                  ),
              })),
            });
          }
        return {
          rows,
          summary: [0, 2.5, 5].map((rank) => {
            const group = rows.filter((r) => r.rank === rank);
            return {
              rank,
              runs: group.length,
              wins: group.filter((r) => r.won).length,
              meanFloor: group.reduce((n, r) => n + r.depth, 0) / group.length,
              stalls: group.filter((r) => r.stalled).length,
              byStarter: Object.fromEntries(
                ["fighter", "rogue", "mage"].map((j) => [
                  j,
                  group.filter((r) => r.job === j && r.won).length +
                    "/" +
                    group.filter((r) => r.job === j).length,
                ]),
              ),
            };
          }),
        };
      },
      { runs: Number(process.env.BALANCE_RUNS || 12) },
    );
    if (errors.length) throw Error(errors.join("\n"));
    result.scenario =
      "Four encounters per floor (three ordinary, one guardian); recruits on floors 3 and 5; one well/floor before guardian; no items, equipment, artefacts, gold shops, travel, loot points or rare personal saves. AI edits and actor selection, not perfect human play.";
    result.seedPolicy =
      "Same numeric seeds and starter/temperament for each lesson rank; full configuration applies rank five to every family. The middle configuration alternates ranks 2 and 3 across the eight families: exactly 20 of 40 lesson ranks, not half the gold cost. Different actions consume different RNG draws.";
    const target =
      process.env.BALANCE_REPORT || "test-results/balance-audit.json";
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify(result, null, 2) + "\n");
    console.log(JSON.stringify(result.summary, null, 2));
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
