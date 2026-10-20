# Balance authoring

`data/balance.json` is the only runtime balance source. `index.html` is generated; never edit its data block. The workbook at `balance/Scratchpad-Dungeon-Balance.xlsx` is an editable export, not another runtime database.

1. Run `npm ci --ignore-scripts` with Node 22 or newer.
2. Run `npm run balance:export` before editing. Open the workbook in Excel or LibreOffice. Change blue **Value** cells, keeping sheets, field IDs and rows intact. Save as `.xlsx`.
3. Run `npm run balance:validate -- /path/to/edited.xlsx` to get errors without writing anything.
4. Run `npm run balance:import -- /path/to/edited.xlsx`. The importer validates everything, stages a complete offline build, backs up the previous JSON to `data/balance.json.backup`, then replaces the data and HTML. Write failures restore the previous files. A process or machine crash between renames is recoverable from version control and the backup; run `npm run build` after recovery.
5. Run `npm run balance:export` again to refresh statistics, then `npm run validate` and `npm test`. Commit the JSON, workbook and generated HTML together.

Reload the game to use the rebuilt HTML. Use a fresh run when testing starter HP/reels, floor generation or item distribution. Existing saves deliberately retain wounds, level progress, personalised wheels, current enemies and already-generated floors. They are not silently reset by a balance import.

## Workbook contents

| Sheet                      | Editable content                                                                                                              |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Classes                    | Starting health and display names                                                                                             |
| Reels                      | Weighted class faces, enemy reel sets, class flurry and event wheels                                                          |
| Enemies                    | Species, floor eligibility, reel references, stat multipliers/overrides, elite affixes, encounter pools and curves            |
| Items / Equipment          | Consumable effects, class equipment, names and descriptions                                                                   |
| Abilities / Slots          | Class powers, poison/stimulant behaviour, tier powers, editing costs, critical multipliers                                    |
| Progression                | EXP, level health/points, party/bag limits and rewards                                                                        |
| World                      | Event counts/chances, rooms, rivers, recruitment, ambushes and travel events                                                  |
| Loot / Artefacts / Economy | Loot weights, relic scaling and shop costs                                                                                    |
| Engine                     | Protected geometry and simulation structure                                                                                   |
| Roll Analysis / Statistics | Calculated class odds, expected base damage/healing/block, enemy health, frequency, strikes and a critical-damage upper bound |

Stable entity IDs such as `enemy.ink-rat`, `ability.rage` and `reel.enemy.rat` identify content. Stable field IDs use JSON pointers, for example `/classes/fighter/maxHp`. A reel face is addressed by its fixed reel/face index. Renaming an entity's display name does not rename its ID. Enemy species reference shared reel sets, so changing one set updates all species that reference it. The legacy preview-art mapping is read-only and references those same sets.

Names, descriptions and icon names are data too. Item/equipment descriptions use tokens such as `{heal}`, `{block}` and `{attack}` so their numbers follow edited effects. Keep those tokens when rewriting descriptions. `stunEveryOrdinal`, `stimEveryOrdinal`, `poisonTurns`, `stimulantTurns` and `healthPercent` are calculated display tokens.

Some values are structural: three reels, three matching symbols, ten stair guardians, three supported heroes, map dimensions, room geometry and spawn coordinates. They are protected or have fixed bounds. Altering these requires an intentional source/schema update and regression testing. Adding/removing entities or face rows also requires source/schema work; importing arbitrary new rows is intentionally rejected.

## Statistics and validation

Excel formulas reference input cells and recalculate in Excel/LibreOffice. Cached values make the distributed workbook readable without recalculation. Class expected values are level-one face totals before class powers, criticals, gear, buffs or defence. Triple probability includes a middle class seal as a wild card and excludes blanks. Enemy statistics exclude random affix rolls and paired modifiers unless explicitly named. The critical upper bound is conservative: maximum damage faces may not match each other. These are comparison tools, not a combat simulator.

The importer never trusts calculated cells. It checks schema/source fingerprints, all required IDs, duplicate/unknown rows, protected identity, numeric bounds, types, symbol tiers, middle-only class seals, references, encounter eligibility and probability ordering. Formulas and structured objects in input values, unsafe text, macro/external-link archives, oversized compressed files and excessive expanded ZIP contents are rejected. Sheet protection is an editing convenience, not a security boundary. A stale workbook must be freshly exported and its intended edits transferred; it cannot overwrite a newer revision silently.

Default values were captured from the previous game and are regression-tested. This infrastructure does not intentionally retune the game.
