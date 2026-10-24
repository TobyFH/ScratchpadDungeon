// Cosmetic identities never alter species, reels, stats, loot or gameplay RNG.
const PUN_ENEMIES = Object.freeze({
  ruler: "The Angry Ruler",
  sketch: "A Sketchy Dude",
  penknight: "Penknight",
  glue: "Glueblin",
  scissors: "Scissor Soldier",
  exclamation: "Exclamation Marksman",
  question: "Question Marksman",
  comma: "Comma Conman",
  apostrophe: "Apostrofiend",
  punch2: "2-Hole Puncher",
  punch3: "3-Hole Puncher",
  alphabat: "Alphabat",
  crook: "Notecrook",
  inkuisitor: "The Inkuisitor",
  protractor: "Velociprotractor",
  postit: "Post-itler",
  stego: "Stegothesaurus",
  spelleton: "Spelleton",
  police: "Grammar Police",
  trex: "T-rexicon",
  pencil: "Pencil Face",
  goat: "Sticky Goat",
  ghostit: "Ghost-it Note",
  pagemage: "Page Mage",
  tankerchief: "Tankerchief",
  eraser: "The Progress Eraser",
  fullstop: "THE FULL STOP",
});
const PUN_SPECIES = Object.freeze({
  berserker: "scissors",
  smudger: "pencil",
  zombie: "spelleton",
  rat: "comma",
  ghost: "ghostit",
  slime: "glue",
  skull: "spelleton",
  mimic: "punch2",
  gnawer: "pencil",
  bellkeeper: "exclamation",
  widow: "scissors",
  oracle: "question",
  pageeater: "punch3",
  pursuer: "eraser",
  revenant: "penknight",
  demon: "apostrophe",
  lich: "inkuisitor",
  abomination: "tankerchief",
  moth: "alphabat",
  rustmite: "ruler",
  sporepilgrim: "postit",
  mirrorhound: "protractor",
  ashcolossus: "trex",
  fighter: "police",
  rogue: "crook",
  mage: "pagemage",
});
function punIdentity(e) {
  const depth = e.stairBossDepth || state.depth;
  if (e.boss)
    return depth === 10
      ? "fullstop"
      : [
          "penknight",
          "punch2",
          "police",
          "exclamation",
          "scissors",
          "goat",
          "pagemage",
          "stego",
          "punch3",
        ][Math.max(0, depth - 1)];
  return PUN_SPECIES[e.art] || "sketch";
}
function applyEnemyPresentation(e) {
  if (!e) return e;
  e.baseName ??= e.name;
  e.punId = punIdentity(e);
  if (e.fragment && !e.baseName.startsWith("Fragment of "))
    e.baseName = "Fragment of " + e.baseName;
  e.name = preferences().punMode
    ? (e.fragment ? "Fragment of " : "") + PUN_ENEMIES[e.punId]
    : e.baseName;
  return e;
}
function refreshEnemyPresentation() {
  for (const e of battleEnemies()) applyEnemyPresentation(e);
  if (state.enemy) renderEncounter();
  renderPursuer();
}
function enemyCry(e, mood = "appear", delay = 0) {
  return GameSound.cry(
    preferences().punMode ? "pun-" + punIdentity(e) : e.art,
    mood,
    delay,
    e.boss ? e.stairBossDepth || state.depth : 0,
  );
}
async function encounterEntrance() {
  const enemies = battleEnemies().filter((e) => e.hp > 0);
  GameSound.play("encounter");
  enemies.forEach((e, i) => enemyCry(e, "appear", i * 0.16));
  if (innerWidth <= 760)
    $(".right-page").scrollIntoView({ behavior: "instant", block: "start" });
  const first = enemies[0],
    names = enemies.map((e) => e.name).join(" & ");
  showSpotlight(
    names,
    first.boss
      ? `STAIR GUARDIAN · ELITE · FLOOR ${state.depth}`
      : first.ambush
        ? "AMBUSH!"
        : enemies.length > 1
          ? "Two enemies step out of the margins."
          : first.elite
            ? "ELITE · " + first.affix
            : "An enemy steps out of the margins.",
    `${encounterTags(enemies)}<div class="entrance-roster ${enemies.length > 1 ? "paired-intro" : ""}" id="entrance-art">${enemies.map((e, i) => `<div class="entrance-member ${i ? "awaiting-second" : ""}" data-entrance-enemy="${e.id}"><div class="entrance-portrait">${portraitArt(e.art, e)}</div><b>${escapeHTML(e.name)}</b><small>${e.strikes} strike${e.strikes > 1 ? "s" : ""} · every ${e.frequency} spins</small></div>`).join("")}<div class="scare-lines"></div></div><p class="encounter-quote">“${enemyLine(first, "entrance")}”</p>`,
    "enemy-intro",
  );
  burst($("#entrance-art"), "scary", 36);
  if (first.ambush) {
    smokePoof($("#entrance-art"), true);
    const banner = document.createElement("div");
    banner.className = "ambush-banner";
    banner.textContent = visualPick(["SURPRISE!", "AMBUSH!"]);
    $("#entrance-art").append(banner);
  }
  shakeBook(4);
  if (enemies.length > 1) {
    await pause(260);
    const second = $(".entrance-member.awaiting-second");
    second.classList.remove("awaiting-second");
    if (!skip && !matchMedia("(prefers-reduced-motion: reduce)").matches)
      second.classList.add("arriving-second");
    combatCallout(second, "ANOTHER FOE!", "danger");
    burst(second, "scary", 38);
    shakeBook(4);
    GameSound.play("encounter");
  }
  await pause(400);
  await eventChoice([
    {
      id: "stage-confirm",
      label:
        enemies.length > 1
          ? "Face both enemies ↗"
          : "Face " + first.name + " ↗",
      value: true,
    },
  ]);
  const transfers = enemies
    .map((e) => {
      const source = $(`[data-entrance-enemy="${e.id}"] .entrance-portrait`),
        target = enemyArtEl(e),
        from = source?.getBoundingClientRect(),
        to = target?.getBoundingClientRect();
      if (!from || !to || skip || sceneFast) return null;
      const ghost = document.createElement("div");
      ghost.className = "encounter-ghost";
      ghost.innerHTML = portraitArt(e.art, e);
      Object.assign(ghost.style, {
        left: from.left + "px",
        top: from.top + "px",
        width: from.width + "px",
        height: from.height + "px",
      });
      document.body.append(ghost);
      target.style.visibility = "hidden";
      return { ghost, target, from, to };
    })
    .filter(Boolean);
  closeSpotlight();
  await Promise.all(
    transfers.map(async ({ ghost, target, from, to }) => {
      const anim = animate(
        ghost,
        [
          { transform: "translate(0,0) scale(1)" },
          {
            transform: `translate(${to.left - from.left}px,${to.top - from.top}px) scale(${to.width / from.width},${to.height / from.height})`,
          },
        ],
        { duration: 480, easing: "cubic-bezier(.4,0,.2,1)", fill: "forwards" },
      );
      await pause(480);
      anim?.cancel();
      ghost.remove();
      target.style.visibility = "";
      burst(target, "dust", 14);
    }),
  );
  for (const enemy of enemies) {
    announceEnemyBadges(enemy);
    if (enemy.passive?.key === "blackout" && !enemy.passive.arrivalUsed) {
      enemy.passive.arrivalUsed = true;
      pencilBlackout(enemy);
    }
  }
  result(
    icon("skull") +
      `${escapeHTML(enemies.map((e) => e.name).join(" and "))} ${enemies.length > 1 ? "block" : "blocks"} the way. Choose any living hero.`,
  );
  sayEnemy("entrance");
  await resolveBattleOpening();
  await automaticOpeningPause();
}
async function declinedRecruit(h) {
  const outcome = Math.random();
  if (outcome < 0.16) {
    log(`${h.name} takes the refusal badly and draws a weapon.`);
    beginEncounter(false, { count: 1, adventurer: h });
    render();
    await encounterEntrance();
  } else if (outcome < 0.38) {
    const gold = 4 + state.depth * 2;
    showSpotlight(
      "A parting gift",
      h.name + " wishes you better luck ahead.",
      `<div class="stage-art">${portraitArt(h.job, h)}</div><div class="stage-result">${icon("coin")} ${gold} gold</div>`,
      "recruit-gift",
    );
    goldCelebration(gold);
    await eventChoice([
      { id: "stage-confirm", label: "Thank them and carry on", value: true },
    ]);
    closeSpotlight();
    state.gold += gold;
    log(`${h.name} leaves ${gold} gold for the expedition.`);
    render();
    save();
  } else {
    log(`${h.name} says goodbye and continues down another passage.`);
    result(icon("recruit") + "A quiet farewell in the margins.");
  }
}

function encounterTags(enemies) {
  const tags = [];
  if (enemies.some((e) => e.pursuer))
    tags.push(
      '<span class="encounter-tag passive">PURSUER · VALUABLE SPOILS</span>',
    );
  if (enemies.length > 1)
    tags.push('<span class="encounter-tag dual">DUAL BATTLE</span>');
  if (state.opening?.surprise)
    tags.push('<span class="encounter-tag">SURPRISE ATTACK</span>');
  for (const e of enemies) {
    if (e.elite)
      tags.push(
        `<span class="encounter-tag">${e.boss ? "BOSS" : "ELITE"}${e.affix ? " · " + escapeHTML(e.affix) : ""}</span>`,
      );
    if (e.passive)
      tags.push(
        `<span class="encounter-tag passive" data-tooltip="${escapeHTML(ENEMY_TRAITS[e.passive.key]?.description || "")}">${ENEMY_TRAITS[e.passive.key]?.name || ""}</span>`,
      );
  }
  const quick = state.party.find((h) => h.initiative);
  if (quick)
    tags.push(
      `<span class="encounter-tag passive">${escapeHTML(quick.name)} · INITIATIVE</span>`,
    );
  return `<div class="encounter-tags">${tags.join("")}</div>`;
}
