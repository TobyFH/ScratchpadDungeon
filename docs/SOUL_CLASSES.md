# Blood Seeds and the Soul Collector

These are the current save-24 rules. They replace the Bloodbinder's former
timed Bleeding, Clotted and percentage Blood Exchange. The later
[notebook polish pass](NOTEBOOK_POLISH.md) adds earned Necromancer availability,
Seed maturity and normal-healing bonuses; it also documents the current Rogue,
temperament, enemy-budget and loot changes. Artwork is unchanged.

## Bloodbinder

The existing 1,200-gold invitation, 32 base HP and critical pool remain. Ordinary
faces are **ally heal, Blood Seed, spell damage, ally stimulant and Empty**.
Blood Seed is private to this class. One permanent middle seal casts **Blood
Bloom**; it cannot be removed or copied.

- A Seed face adds its tier's worth of Seeds to the selected enemy. Criticals
  increase the number planted using the ordinary class multiplier.
- From level 5, planting adds one extra Seed per roll; from level 9, two. This
  bonus applies once after critical multiplication, without an extra HP fee.
  Normal Bloodbinder healing gains 2.5% per level after level 4, capped at 20%;
  the fixed one-HP Seed pool is never multiplied by this bonus.
- Each rolled Seed face costs **ceil(tier / 2) caster HP**, paid once before
  critical multiplication: ranks I/II cost 1 HP; III/IV cost 2 HP. This bypasses
  block but stops at 1 HP. A caster already at 1 HP may still plant Seeds.
- Each enemy has its own reservoir. There is **no gameplay stack cap or expiry**.
  Completing combat clears it. Normalization accepts finite safe integer counts.
- Each point of actual HP damage consumes one Seed and releases one shared HP
  of healing. Shields, resistance and overkill cannot manufacture healing.
  Direct attacks, poison, Skeletons and damaging supplies use the same hook.
- Healing is allocated among injured living allies, lowest HP ratio first.
  One pool is shared, not duplicated per ally. Excess is lost. It uses exact
  shared healing, retaining Fury spending and health/stat feedback without camp
  or equipment multiplying the fixed pool. It never resurrects a fallen hero.
- **Blood Bloom** removes every remaining Seed on every living enemy. Each
  deals **1 piercing damage and releases 1 shared healing**, as confirmed by the
  player. Its healing is based on the number detonated, even if damage overkills.
  It cannot recursively consume itself, crit twice, cleave again or consume
  Vulnerable. Accompanying ordinary marks keep their normal critical rules.
- Newly rolled Seeds plant before that roll's spell damage and Bloom, so a mixed
  roll can immediately release them. Seed costs are paid only once.

Maroon drop bursts appear at separate randomized positions around the victim.
Green healing marks fly from that enemy to the actual recipients. Very large
counts use up to 18 labelled simultaneous bursts; this is a presentation bound,
not a limit on damage, stacks or healing. Pending flights finish before the
victory sheet replaces combat. The machine footnote shows target and total Seeds.

Autoplay retains legal spell damage and recovery alongside Seeds, rather than
treating an unused reservoir as automatic damage or endlessly planting without
an allied way to consume it.

## Necromancer: Soul Collector

An **earned, starting-only** class with **22 base HP**, unlocked by defeating
floor ten for the first time. It cannot be purchased early or appear in the
wandering recruit pool. It uses ordinary levels, personal points, paid edits,
targeting and action clocks. Living adventurers still appear, but a frightened
introduction always leads to the hostile-adventurer battle instead of recruitment.
Legacy winning saves and legitimate floor-ten deposit receipts recover the unlock.

The master is the sole real hero in `state.party`. Up to two Skeleton auxiliaries
occupy the existing companion rows visually. They have HP and automatic damage,
but no clickable reels, personal points, equipment, independent XP/levels or
normal death records. Normal keyboard/portrait targeting still applies to the
master and selected enemy.

### Reels and Souls

Ordinary faces are **spell damage, poison, Harvest and Empty**. All three ability
families have ranks I–IV: twelve rankable choices using existing prices, refunds,
equal-face probabilities and critical rules. Harvest is class-private. The
permanent middle **Soul Call** seal contributes Harvest power, rather than
introducing a second reel framework.

| Parameter | Current value |
| --- | --- |
| Soul capacity | 22 + 2 × master level |
| Souls from actual enemy HP damage | 0.3 per HP, including poison and Skeletons |
| Harvest | 2 Souls per power and ceil(power × 0.5) spell power |
| Soul Call Harvest power | 2 + floor((level − 1) / 4) |
| Personal damage adjustment | 90%, rounded down, minimum 1 for positive damage |
| Critical pool | ×1.5, ×1.75, ×2, ×2.5 |
| Skeleton maximum HP | 8 + 3 × master level |
| Each Skeleton's physical attack | 1 + floor((level − 1) × 0.45) |
| Full-bar healing with both Skeletons | ceil(10% of each member's maximum HP) |
| Skeleton-death Soul return | 3 |
| Skeleton-death master recovery | max(1, floor(3% of master's maximum HP)) |
| Enemy-death master recovery | ceil(12% enemy max HP), capped at floor(50% master max HP) |

Filling the bar creates a Skeleton immediately if there is an empty position.
**With two alive, keep their identities and heal the entire team**, following the
player's explicit choice where the attachment conflicted. Every completion
empties the bar; excess from that one grant does not chain further completions.
Damage Souls exclude enemy self-harm and self-destruction. Enemy deaths still
provide recovery regardless of who killed them, including enemy summons.

Soul Commander builds favour Harvest, Plague Lord favours poison with some
Harvest, and Death Sorcerer favours spells. These are editing preferences, not
new selectable roles or progression tracks. Autoplay uses paid validators and
retains both a source of personal damage and Harvest.

### Automatic actions and protection

After each completed master action, including a missed stunned action, surviving
Skeletons each hit the selected living enemy once before enemy clocks advance.
They do not spend actions or advance clocks themselves. If the selected enemy
died, they use another living foe. A Skeleton raised by another Skeleton's hit
waits until the next action; the current action uses a snapshot of auxiliaries.

For each whole enemy turn, the **first eligible single-target attack** aimed at
the master is intercepted by the healthiest Skeleton; equal HP chooses the
oldest. A critical's original and bonus hit count as that one intercepted attack,
even if its first segment kills the Skeleton. Later multi-strikes can hit the
master. Area, piercing and unblockable attacks bypass interception. Shared team
block and the existing full-turn ward can protect the intercepted attack.

Killed Skeletons leave their position immediately with a brief pile-of-bones
effect and return their small Soul/recovery reward. They never open burial or
revival prompts. **Master death immediately ends the run**, discards summons and
records only the adventurer. Revive Stones cannot bypass this class rule.

### Recovery, persistence and presentation

Ordinary healing cannot restore the master or Skeletons, including wells,
supplies, exact healing, gear and level-up recovery. Healing rewards remain in
the dungeon; they have not been replaced for this class. Soul Harvest, a full
bar with two Skeletons and Skeleton deaths are its recovery sources. Autoplay
avoids wasting healing supplies/wells and may seek manageable fights to recover.

Souls and remaining Skeleton HP persist across combat, floors and saves.
Skeleton maximum HP/attack scale with the master; level growth does not restore
missing HP. A purple Soul meter sits immediately below the master's health bar,
above its reels. Pencil hands rising through paper, purple bursts, bodyguard
callouts, bone piles and enemy-to-master Soul flights reuse the existing effect,
speed, skip, reduced-motion and utility-pause systems.

## Ownership and migration

- `game/bloodbinder.js`: reservoir counts, costs, allocation, detonation and AI
  forecast. All enemy HP losses enter through shared `damageEnemy()`.
- `game/necromancer.js`: Soul tuning/lifecycle, Skeletons, interception and
  restricted recovery. Skeletons are `hero.skeletons`, never extra party heroes.
- `game/hero-builds.js`, `game/reel-upgrades.js`, `game/auto-builds.js`: shared
  permissions, faces, paid editing and AI preferences.
- `ui/soul-feedback.js/.css`: meters, auxiliary rows and ephemeral effects;
  `ui/drawings.js`: the pencil Necromancer portrait and Harvest mark.
- Authored `index.html`: integration in the normal spin, damage, enemy-turn,
  recruitment, death and save paths. `tools/build-ui.cjs` embeds modules into it.

Save 24 converts old Bleeding into a Seed count of damage × remaining turns,
keeps its source owner and removes retired Clotted. Bloodbinder physical marks
become spells, self stimulants become ally stimulants, and self heals become
ally heals; tiers and paid receipts remain. Other forbidden marks become Empty
without adding refunds or losing paid receipts. There is no save reset.

## Verification

`tests/bloodbinder-balance.test.cjs`, `tests/bloodbinder-update.test.cjs` and
`tests/necromancer.test.cjs` exercise real browser rolls, costs, shared pools,
critical/overkill/shield handling, private faces, paid edits, enemy-death hooks,
interception, healing restrictions, immediate defeat, recruitment, persistence
and desktop/compact layouts. New class captures are in ignored
`test-results/soul-classes/`. Run `npm test`, `npm run review:ui` and rebuild
`index.html` after source edits.

The Skeleton curve starts at two combined damage per master action and reaches
twelve at level 13. This is the conservative initial target from the confirmed
design, not a measured campaign win-rate claim. Controlled balance probes and
playtesting can tune `NECROMANCER` without changing its action economy.
