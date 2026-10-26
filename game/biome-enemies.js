// Biome species are explicit depth bands. Ordinary encounter pools exclude them;
// the matching floor adds only its eligible species to the random draw.
const BIOME_ENEMIES = Object.freeze({
  veilweaver: {
    name: "Veil weaver",
    biome: "shadow",
    minDepth: 4,
    maxDepth: 10,
    hp: 1.08,
    damage: 0.95,
    trait: "veil",
    faces: [
      ["magic", 1],
      ["magic", 2],
      ["stun", 1],
      ["block", 1],
      ["miss", 1],
    ],
    lore: "Its cloak keeps the darkness others leave behind. Switch adventurers to shake its veil; fogged reels clear when rolled.",
  },
  shalecrab: {
    name: "Shale-back scuttler",
    biome: "unstable",
    minDepth: 2,
    maxDepth: 10,
    hp: 1.2,
    damage: 0.95,
    trait: "carapace",
    faces: [
      ["attack", 1],
      ["block", 1],
      ["attack", 2],
      ["stun", 1],
      ["miss", 1],
    ],
    lore: "A creature of loose stone, always listening for the next crack overhead. Its shell is tougher than the ceiling.",
  },
  powderimp: {
    name: "Powder imp",
    biome: "cave",
    minDepth: 2,
    maxDepth: 10,
    hp: 0.78,
    damage: 1.05,
    trait: "detonate",
    faces: [
      ["attack", 1],
      ["miss", 1],
    ],
    lore: "A tiny fuse burns above a belly of stolen blasting powder. Two of its turns are all the warning it gives.",
  },
  rootling: {
    name: "Rootbound prowler",
    biome: "overgrown",
    minDepth: 1,
    maxDepth: 4,
    hp: 1.1,
    damage: 0.95,
    faces: [
      ["attack", 1],
      ["attack", 1],
      ["poison", 1],
      ["block", 1],
      ["miss", 1],
    ],
    lore: "It keeps perfectly still among the roots, waiting for a passing boot to disturb the moss.",
  },
  thornhulk: {
    name: "Thornwood ancient",
    biome: "overgrown",
    minDepth: 5,
    maxDepth: 10,
    hp: 1.35,
    damage: 1.05,
    trait: "carapace",
    faces: [
      ["attack", 2],
      ["block", 2],
      ["stun", 1],
      ["poison", 1],
      ["miss", 1],
    ],
    lore: "An old root has grown around a forgotten suit of armour. Cutting blows struggle through its bark.",
  },
  capstalker: {
    name: "Sporecap stalker",
    biome: "fungal",
    minDepth: 2,
    maxDepth: 5,
    hp: 0.9,
    damage: 0.9,
    faces: [
      ["poison", 1],
      ["poison", 2],
      ["attack", 1],
      ["heal", 1],
      ["miss", 1],
    ],
    lore: "Its cap glows when the colony wakes. The dust under its gills is much less welcoming.",
  },
  myconarch: {
    name: "The myconid monarch",
    biome: "fungal",
    minDepth: 6,
    maxDepth: 10,
    hp: 1.22,
    damage: 0.95,
    trait: "summoner",
    faces: [
      ["poison", 2],
      ["magic", 2],
      ["heal", 2],
      ["stun", 1],
      ["miss", 1],
    ],
    lore: "A crown of old caps speaks for the colony. Give it time and smaller things answer.",
  },
  cinderhopper: {
    name: "Cinder hopper",
    biome: "lava",
    minDepth: 5,
    maxDepth: 7,
    hp: 0.85,
    damage: 1.15,
    faces: [
      ["attack", 2],
      ["attack", 2],
      ["magic", 1],
      ["stimulant", 1],
      ["miss", 1],
    ],
    lore: "It skips between cool stones, carrying a bright coal behind its ribs. Watch for the leap.",
  },
  basaltwyrm: {
    name: "Basalt wyrm",
    biome: "lava",
    minDepth: 8,
    maxDepth: 10,
    hp: 1.35,
    damage: 1.12,
    trait: "carapace",
    faces: [
      ["attack", 2],
      ["magic", 2],
      ["block", 2],
      ["stun", 1],
      ["miss", 1],
    ],
    lore: "A ribbon of molten stone has learned to coil. Its cooling scales can turn a blade.",
  },
  frostmite: {
    name: "Frostglass mite",
    biome: "ice",
    minDepth: 3,
    maxDepth: 6,
    hp: 0.85,
    damage: 0.95,
    faces: [
      ["stun", 2],
      ["attack", 1],
      ["magic", 1],
      ["block", 1],
      ["miss", 1],
    ],
    lore: "Its thin legs hardly mark the ice. A touch of its frozen antenna can numb a whole arm.",
  },
  rimewarden: {
    name: "Rime sentinel",
    biome: "ice",
    minDepth: 7,
    maxDepth: 10,
    hp: 1.28,
    damage: 1,
    trait: "secondWind",
    faces: [
      ["stun", 2],
      ["block", 2],
      ["magic", 2],
      ["heal", 1],
      ["miss", 1],
    ],
    lore: "A guardian buried in clear ice. When its shell cracks, a colder shape rises inside.",
  },
});
for (const [id, def] of Object.entries(BIOME_ENEMIES))
  ENEMY_PROFILES[id] = { ...def };
function biomeEnemyPool(depth, theme = floorBiome()) {
  if (depth < (BIOMES[theme]?.minDepth || 1)) return [];
  return Object.entries(BIOME_ENEMIES)
    .filter(
      ([id, p]) =>
        depth >= p.minDepth &&
        depth <= p.maxDepth &&
        (p.biome === theme || (id === "powderimp" && theme === "lava")),
    )
    .map(([art, p]) => ({ art, name: p.name }));
}
function biomeCryProfiles() {
  return Object.fromEntries(
    Object.keys(BIOME_ENEMIES).map((id, i) => [
      id,
      [
        i % 2 ? "triangle" : "sawtooth",
        92 + i * 37,
        [1, 1.2 + i * 0.03, 0.75, 1.4, 0.6],
        0.4 + i * 0.02,
        0.04,
      ],
    ]),
  );
}
function isExploder(e) {
  return e?.passive?.key === "detonate";
}
function exploderDamage(e) {
  return Math.max(3, Math.ceil(e.damage * 1.8));
}
async function exploderTurn(e) {
  if (!isExploder(e)) return false;
  e.fuseLeft = Math.max(0, (e.fuseLeft ?? 2) - 1);
  if (e.fuseLeft) {
    e.turnsTaken = (e.turnsTaken || 0) + 1;
    combatCallout(enemyArtEl(e), "FUSE LIT · NEXT TURN!", "danger");
    GameSound.play("fuse");
    burst(enemyArtEl(e), "gold", 28);
    shakeElement(enemyArtEl(e), 3, "fuse");
    syncEnemy(e);
    await feedbackPause(skip ? 220 : 500);
    return true;
  }
  const power = exploderDamage(e),
    art = enemyArtEl(e);
  combatCallout(art, "SELF-DESTRUCT!", "danger");
  GameSound.play("explosion");
  screenFX("damage", 1.4);
  burst(art, "damage", 85);
  smokePoof(art, true);
  shakeElement(art, 11, "explosion");
  shakeBook(11, "explosion");
  await feedbackPause(skip ? 180 : 380);
  for (const h of state.party.filter(alive)) {
    const i = state.party.indexOf(h);
    if (i < 0) continue;
    damageHero(i, power, e.name + " self-destructs", {
      attacker: e,
      impact: { type: "attack", critical: true },
    });
  }
  e.selfDestructed = true;
  damageEnemy(e.hp, e.name + " burns out", e, { piercing: true });
  log(
    `${e.name} explodes for ${power} damage toward each hero. Team block protects the party.`,
  );
  result(
    icon("explosion") + `${e.name} self-destructs · ${power} power per hero`,
  );
  await processDeaths();
  checkDefeat();
  return true;
}
