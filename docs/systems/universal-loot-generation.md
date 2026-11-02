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
