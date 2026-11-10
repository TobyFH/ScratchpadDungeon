#!/usr/bin/env node
// Reproducible, browser-based class probes. These are controlled comparisons,
// not campaign win-rate predictions. All edits, rolls and combat rules are real.
const fs = require("node:fs"),
  http = require("node:http"),
  path = require("node:path");
const { chromium } = require("playwright");
(async () => {
  const html = fs.readFileSync(
    process.env.BALANCE_HTML || path.join(__dirname, "../index.html"),
  );
  const server = http.createServer((_, res) => {
    res.setHeader("Content-Type", "text/html");
    res.end(html);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://127.0.0.1:" + server.address().port);
    await page.evaluate(() => CompanyIntro.skip(true));
    await page.evaluate(
      fs.readFileSync(
        path.join(__dirname, "lib/blood-audit-fixture.js"),
        "utf8",
      ),
    );
    const data = await page.evaluate(
      async ({ runs }) => {
        let rng = 1;
        Math.random = () => {
          rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
          return rng / 4294967296;
        };
        const cases = [
          ["bloodbinder", "drain"],
          ["bloodbinder", "hybrid"],
          ["bloodbinder", "mender"],
          ["bloodbinder", "striker"],
          ["mage", "mender"],
          ["rogue", "striker"],
          ["ranger", "striker"],
        ];
        const stages = [
          { level: 2, depth: 2, budget: 8 },
          { level: 7, depth: 5, budget: 40 },
          { level: 13, depth: 10, budget: 90 },
        ];
        function build(job, style, stage) {
          const h = makeHero(job, job, null, [], {
            specialism: ["mender", "hybrid", "drain"].includes(style)
              ? "defence"
              : "offence",
          });
          h.level = stage.level;
          h.maxHp += 6 * (h.level - 1);
          h.hp = h.maxHp;
          h.points = stage.budget;
          h.xp = 0;
          const target = {
            drain: ["bloodseed"],
            hybrid: ["bloodseed", "heal", "magic", "bloodseed", "heal"],
            mender: ["heal"],
            striker: ["attack"],
          }[style];
          // Spread legal swaps/upgrades across all three reels, paying live prices.
          const faces = [];
          for (let j = 0; j < Math.max(...h.reels.map((r) => r.length)); j++)
            for (let k = 0; k < 3; k++)
              if (h.reels[k][j] && h.reels[k][j].type !== "class")
                faces.push([k, j]);
          for (const [k, j] of faces) {
            const f = h.reels[k][j],
              type = target[j % target.length];
            if (f.type !== type) applyFaceEdit(h, k, j, "swap", type);
          }
          const clone = (x) => JSON.parse(JSON.stringify(x));
          const score = (x) => {
            const fx = expectedHeroEffects(x);
            return style === "striker"
              ? fx.damage
              : style === "mender"
                ? fx.heal + fx.teamHeal * 3
                : fx.damage + fx.heal * 0.8 - fx.selfharm * 0.35;
          };
          // Retain the best affordable intermediate build. Spending the last points
          // on mismatched ranks can reduce combo odds; do not deliberately cripple
          // an attacker merely to report a higher points-spent figure.
          let best = clone(h),
            bestScore = score(h);
          for (let tier = 2; tier <= 4; tier++)
            for (
              let j = 0;
              j < Math.max(...h.reels.map((r) => r.length));
              j++
            ) {
              const group = faces.filter(
                ([k, index]) => index === j && h.reels[k][j].tier < tier,
              );
              const cost = group.reduce(
                (n, [k, index]) =>
                  n + (faceEditCost(h, k, index, "upgrade") || 100000),
                0,
              );
              if (cost <= h.points)
                for (const [k, index] of group)
                  applyFaceEdit(h, k, index, "upgrade");
              const value = score(h);
              if (value > bestScore + 1e-8) {
                best = clone(h);
                bestScore = value;
              }
            }
          return best;
        }
        function setup(job, style, stage, seed, party = true) {
          rng = seed;
          newRun("fighter");
          closeModal();
          closeSpotlight();
          busy = false;
          state.awaitingStarter = false;
          state.autoplay = state.autoresolve = false;
          state.runRules = [];
          state.depth = stage.depth;
          state.map.forEach((c) => {
            c.terrain = c.wall ? "stone" : "floor";
            c.env = null;
          });
          const h = build(job, style, stage);
          state.party = party
            ? [
                build("fighter", "striker", stage),
                build("rogue", "striker", stage),
                h,
              ]
            : [h];
          state.artefacts = [];
          state.equippedArtefact = null;
          beginEncounter(true, { count: 1 });
          finishOpeningRoll();
          closeSpotlight();
          state.opening = null;
          state.party.forEach((a) => {
            a.surprised = false;
            a.initiative = null;
            a.trait = null;
          });
          return h;
        }
        const rows = [];
        for (const stage of stages)
          for (const [job, style] of cases) {
            const probes = [],
              duels = [];
            for (let seed = 1; seed <= runs; seed++) {
              const h = setup(job, style, stage, seed),
                e = state.enemy,
                spent = stage.budget - h.points;
              // Injured-team throughput: enemy never attacks, but its real whole turn
              // (every three rolls) ticks Bleeding/Clotted. Keep wounds available.
              Object.assign(e, {
                hp: 100000,
                maxHp: 100000,
                passive: null,
                damage: 0,
                frequency: 3,
                countdown: 3,
                strikes: 1,
                reels: [0, 1, 2].map(() => [
                  { type: "blank", tier: 1, weight: 1 },
                ]),
              });
              let healing = 0,
                clotted = 0,
                directDamage = 0,
                bleedingDamage = 0;
              const realDamage = damageEnemy;
              damageEnemy = (n, label, target, options) => {
                const dealt = realDamage(n, label, target, options);
                if (label === "Bleeding") bleedingDamage += dealt;
                else if (label !== "Blood Exchange") directDamage += dealt;
                return dealt;
              };
              for (let i = 0; i < 18 && state.enemy; i++) {
                state.party.forEach(
                  (a) => (a.hp = Math.max(1, Math.floor(a.maxHp * 0.2))),
                );
                state.target = 0;
                const oldH = h.stats.healingDone;
                await spin(state.party.indexOf(h));
                healing += h.stats.healingDone - oldH;
                if (e.clotted) clotted++;
              }
              damageEnemy = realDamage;
              const hpCost = h.stats.bloodSpent || 0;
              probes.push({
                healing: healing / 18,
                hpCost: hpCost / 18,
                netHealing: (healing - hpCost) / 18,
                directDamage: directDamage / 18,
                bleedingDamage: bleedingDamage / 18,
                clotCoverage: clotted / 18,
                spent,
                faces: h.reels.flat().map((f) => f.type + ":" + f.tier),
              });
              // A fresh actual staircase guardian. Solo builds are a fallback check;
              // party comparisons keep the other two members and actor policy equal.
              for (const party of [true, false]) {
                const actor = setup(job, style, stage, seed, party),
                  foe = state.enemy;
                let actions = 0;
                while (state.enemy && !state.over && actions < 180) {
                  const candidates = state.party
                    .map((h, i) => ({ h, i }))
                    .filter((x) => alive(x.h));
                  const next = party
                    ? autoChooseActor(candidates)
                    : candidates[0];
                  if (!next) break;
                  state.target = autoHealth().weakest.i;
                  const prior = next.h.stats.damageDealt;
                  await spin(next.i);
                  recordAutoCombatProgress(next.h, prior);
                  actions++;
                }
                duels.push({
                  party,
                  won: !state.enemy && !state.over,
                  actions,
                  survivors: state.party.filter(alive).length,
                  healing: actor.stats.healingDone,
                  damage: actor.stats.damageDealt,
                  enemyHp: foe.hp,
                });
              }
            }
            const avg = (xs, key) =>
              Number(
                (xs.reduce((s, x) => s + x[key], 0) / xs.length).toFixed(2),
              );
            rows.push({
              ...stage,
              job,
              style,
              spent: avg(probes, "spent"),
              healingPerRoll: avg(probes, "healing"),
              hpCostPerRoll: avg(probes, "hpCost"),
              netHealingPerRoll: avg(probes, "netHealing"),
              directDamagePerRoll: avg(probes, "directDamage"),
              bleedingDamagePerRoll: avg(probes, "bleedingDamage"),
              clotCoverage: avg(probes, "clotCoverage"),
              faces: probes[0].faces,
              party: {
                wins: duels.filter((x) => x.party && x.won).length,
                runs,
                meanActions: avg(
                  duels.filter((x) => x.party),
                  "actions",
                ),
              },
              solo: {
                wins: duels.filter((x) => !x.party && x.won).length,
                runs,
                meanActions: avg(
                  duels.filter((x) => !x.party),
                  "actions",
                ),
              },
            });
          }
        return rows;
      },
      { runs: Number(process.env.BALANCE_RUNS || 12) },
    );
    if (errors.length) throw Error(errors.join("\n"));
    const report = {
      scenario:
        "Equal point allowances; legal paid edits to intended archetypes; levels 2/7/13 at floors 2/5/10. Injury-throughput probe resets wounds before each of 18 rolls against a harmless, three-roll-frequency dummy. Separate fresh real staircase guardian trials use unchanged actor selection, no gear, items, lessons, rare luck saves or travel. Fixed stages are not campaign outcomes; some builds leave points unspent because the next purchase is unaffordable.",
      rows: data,
    };
    const target =
      process.env.BALANCE_REPORT || "test-results/bloodbinder-balance.json";
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify(report, null, 2) + "\n");
    console.table(
      data.map(
        ({
          level,
          job,
          style,
          spent,
          healingPerRoll,
          clotCoverage,
          party,
          solo,
        }) => ({
          level,
          job,
          style,
          spent,
          healingPerRoll,
          clotCoverage,
          party: party.wins + "/" + party.runs,
          partyActions: party.meanActions,
          solo: solo.wins + "/" + solo.runs,
        }),
      ),
    );
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
