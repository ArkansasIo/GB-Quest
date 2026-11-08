# Universal Loot Generation System

## Scope

GB-Quest uses data-driven loot profiles for monsters, creatures, animals, NPCs, humanoid enemies, bosses, dungeons, raids, and world events. Loot generation is server-authoritative: clients may display rolls but cannot choose or modify rewards.

## Entity loot profiles

Each entity definition references a loot profile with:
- entity type, species/faction, rank (F–SSS), star level (1–12), level range, biome/region, encounter difficulty
- guaranteed drops, weighted drop groups, conditional drops, currency, equipment pools, crafting materials
- minimum/maximum quantities, per-player or shared distribution rules, and unique/once-per-lockout flags

Supported profile families:
1. Animal: meat, hide, fur, feathers, bones, glands, trophies.
2. Monster/creature: body materials, organs, essence, elemental components, species-specific trophies.
3. NPC/humanoid: carried equipment, consumables, ammunition, profession goods, faction supplies and currency.
4. Elite/champion: enhanced material pools and a chance at named equipment.
5. Boss/world boss: guaranteed encounter rewards, rare unique drops, crafting components and cosmetic/mount pools.
6. Dungeon/raid/trial: completion chests, difficulty-specific equipment, tokens and weekly/daily reward entitlements.

## Roll order

1. Validate the kill/encounter and eligible recipients on the server.
2. Resolve encounter modifiers: entity profile, level, rank, stars, difficulty, region, event modifiers and party rules.
3. Grant guaranteed drops.
4. Roll each independent weighted drop group using normalized weights.
5. Apply quantity ranges and permitted bonus rolls.
6. Apply ownership, binding, tradeability and anti-duplication rules.
7. Persist the result and emit an auditable loot event before notifying clients.

A weighted group is a list of entries with non-negative weights. The server selects at most the configured number of entries; weights are normalized within that group. Independent groups allow, for example, a material drop and an equipment roll from the same kill. Do not add percentages together across separate groups.

## Rank, star and level scaling

- F, E and D: Bronze loot presentation.
- C and B: Silver loot presentation.
- A: Gold loot presentation.
- S, SS and SSS: Platinum loot presentation.
- Each rank supports 1–12 stars.
- Item level is constrained to 1–720.
- Gear level and power level are stored as separate progression fields; they do not replace item level.

Rank, stars, level and difficulty select eligible loot pools and quantity bands. They must not guarantee a specific high-rarity item. Use bounded curves and explicit caps to prevent runaway drop rates.

## Example profile (illustrative weights, not final balance)

```json
{
  "id": "wolf_forest_common",
  "entityType": "animal",
  "species": "wolf",
  "rank": "D",
  "starRange": [1, 4],
  "guaranteed": [
    { "item": "wolf_meat", "quantity": [1, 3] }
  ],
  "groups": [
    {
      "id": "field_material",
      "rolls": 1,
      "entries": [
        { "item": "wolf_hide", "weight": 70, "quantity": [1, 2] },
        { "item": "wolf_fang", "weight": 25, "quantity": [1, 1] },
        { "item": "alpha_wolf_heart", "weight": 5, "quantity": [1, 1] }
      ]
    }
  ]
}
```

## NPC and character loot

NPC profiles distinguish:
- equipped gear (the NPC's visible loadout; dropped only when explicitly configured)
- carried inventory (consumables, tools, documents, keys and trade goods)
- faction/occupation supplies
- quest-critical items (quest state and ownership checked; never randomly lost)
- currency and bounty rewards

Player characters do not drop their equipped inventory on ordinary defeat. Any PvP loss or item-risk mechanic must be a separate opt-in ruleset with clear warnings, safe exclusions and server-side validation.

## Distribution and fairness

- Solo: rewards go to the eligible player.
- Party: configurable personal loot by player eligibility; avoid first-click ownership.
- Raid: personal reward rolls by default; shared boss loot requires an explicit master-loot/roll policy.
- Bind-on-pickup, bind-on-equip, tradeable and account-bound are item-level properties.
- Duplicate protection may use pity counters for explicitly designated rare pools. Pity state is per character and per pool, persisted server-side.
- Daily/weekly lockouts and contract-token costs are separate from drop chance calculations.

## Data model

Recommended records:
- EntityDefinition(entity_id, entity_type, species_id, rank, star_level, level, loot_profile_id)
- LootProfile(profile_id, version, guaranteed_json, groups_json, eligibility_rules_json)
- LootItem(item_id, category, rarity, bind_policy, stack_limit)
- LootEvent(event_id, encounter_id, killer_id, recipient_id, profile_id, profile_version, seed_reference, drops_json, created_at)
- LootPity(character_id, pool_id, failed_rolls, updated_at)

Store profile versions and loot events for auditability. Use a cryptographically secure server-side random source for authoritative rolls, or a documented deterministic server seed scheme with protected seed material. Never accept client-supplied drop results.

## Balance and test requirements

Test guaranteed drops, zero-weight entries, normalized weights, quantity bounds, invalid profiles, party eligibility, duplicate prevention, lockouts, pity counters, reconnects, retries/idempotency, and concurrent boss claims. Run large simulations to compare observed frequencies with configured weights and detect unintended inflation.

All sample names and weights in this document are design examples. Final drop rates, item IDs, and reward quantities must be tuned against the game's economy and progression data.
```


## Affix, Enchantment and Equipment Modification System

GB-Quest uses an original affix system inspired by the depth of Diablo IV's item modification systems. This is a functional design reference, not a copy of Blizzard's proprietary game data, text, icons, formulas, or assets.

### Affix data model

An affix is a typed modifier that can appear only on compatible item slots and item categories. Each affix definition includes:
- stable affix ID and display name
- category: offensive, defensive, utility, resource, mobility, resistance, skill, summon, profession, or special
- allowed equipment slots and weapon/armor categories
- allowed character classes, if class-restricted
- minimum and maximum item level
- rank and rarity eligibility
- value range, scaling curve, and unit
- mutually exclusive groups and duplicate rules
- source tags: natural, enchanted, tempered, set, legendary, mythical
- whether it is inherent, standard, special, or locked

### Affix families

1. Offensive: physical damage, elemental damage, attack speed, critical chance, critical damage, penetration, damage over time, skill damage.
2. Defensive: armor, maximum health, block, damage reduction, healing received, barrier strength.
3. Resistance: fire, frost, lightning, poison, shadow, arcane, holy, chaos, physical and status resistance.
4. Resource: maximum mana/energy/stamina, generation, regeneration, cost reduction.
5. Mobility: movement speed, dodge, evade cooldown, control duration reduction.
6. Skill: ranks to eligible skills, cooldown reduction, resource cost, area, duration, summon bonuses.
7. Profession: gathering yield, crafting quality, refining efficiency, cooking potency, fishing yield.
8. Creature-specific: companion damage, mount stamina, summon health, beast mastery and species bonuses.

### Enchanting

At an Enchanter NPC or crafting station, a player selects one eligible standard affix on an item and rerolls that affix from the compatible replacement pool. The player sees the candidate result and can accept it or retain the current value. Only the selected affix changes; all other affixes remain unchanged.

- Each item has an enchantment history and reroll count.
- Reroll costs use gold plus slot- and item-level-appropriate materials.
- Costs rise by a configurable curve and have a hard cap.
- The replacement pool is filtered by item slot, item type, class, level, rank, and affix exclusion rules.
- Inherent stats and explicitly locked special powers cannot be rerolled unless a separate recipe explicitly permits it.
- The UI previews the possible affix categories and cost before confirmation.
- A transaction is atomic and server-authoritative; retries cannot charge twice or duplicate results.

### Tempering

Tempering uses profession recipes/manuals to add a limited number of specialized affixes. Each recipe defines eligible slots, affix pool, value range, required materials, and attempt limits. Tempered affixes are tracked separately from standard affixes and cannot be rerolled through ordinary Enchanting.

### Masterworking

Masterworking consumes rare materials and currency to improve eligible affix values according to bounded upgrade curves. Milestone upgrades may select an affix for an additional bonus. All value changes are clamped to the affix's defined maximum and the item's progression limits.

### Imprinting and powers

Imprinting applies an eligible legendary power or aspect from a discovered collection to compatible equipment. Each power defines its own slot restrictions, roll range, rank eligibility, and replacement behavior. A power is not treated as an ordinary affix unless its definition explicitly says so.

### Rarity and equip restrictions

Rarity is independent of equipment rank (F–SSS), star level (1–12), and item level (1–720). Rank describes progression power; rarity describes scarcity, special properties, and equip restrictions.

Rarity order, low to high:
- Common (white)
- Uncommon (green)
- Set (green set identity; tracked separately from ordinary Uncommon if the game uses both)
- Rare (blue)
- Epic (purple)
- Exotic
- Legendary (orange)
- Mythical

Equip rules:
- Exotic: at most one Exotic item equipped per character across all slots.
- Legendary: no global one-piece restriction; equip any number of compatible Legendary items, subject to slot and duplicate-unique rules.
- Mythical: at least one Mythical item may be equipped in each major classification: armor, weapon, and jewelry. This is a minimum allowance, not a forced requirement; slot compatibility still applies. Additional Mythical pieces can be allowed by a later balance rule.
- Set items: set bonuses activate at configured piece thresholds and do not override slot compatibility.
- Common through Epic: normal slot and class restrictions apply.

If Set is intended to be a separate rarity rather than a green Uncommon variant, configure it as its own rarity ID and UI colour while retaining its set-bonus behavior.

### Rarity, rank and affix interaction

Rarity controls the eligible affix pool, special-power access, and affix budget. Rank F–SSS controls the item's progression band and stat ceiling. Stars 1–12 control enhancement progression. Item level 1–720 controls level-scaled ranges and equip requirements. These dimensions remain separate in storage and validation.

### Suggested persistent records

- AffixDefinition(affix_id, category, allowed_slots, class_rules, level_min, level_max, value_min, value_max, source_tags, exclusive_group)
- ItemAffix(item_id, affix_id, value, source, locked, roll_index)
- EnchantmentHistory(event_id, character_id, item_id, old_affix_id, new_affix_id, cost, created_at)
- TemperRecipe(recipe_id, allowed_slots, affix_pool_id, attempt_limit, material_cost)
- ItemPower(item_id, power_id, roll_value)
- ItemRarityRule(rarity_id, equip_limit, slot_class_rules, set_id)

### Balance and validation

Test slot compatibility, class restrictions, duplicate and exclusive groups, reroll pool determinism under a stored server seed, cost escalation and caps, transaction idempotency, locked affixes, temper attempt limits, power compatibility, rarity equip limits, set thresholds, and rank/star/item-level boundaries. Simulate large samples to verify affix frequencies and detect unintended best-in-slot combinations.

All affix names, values, pools, weights, costs and formulas are GB-Quest original content and must be balanced against its own item economy.
