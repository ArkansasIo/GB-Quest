# D20 Rules Implementation Plan

## Scope
Provide a rules engine that can support a D&D 5e-compatible ruleset using permitted SRD material, plus original MMO-specific extensions. Do not reproduce non-SRD book content.

## Core primitives
- Ability scores and modifiers.
- Proficiency bonus and proficiency states.
- d20 ability checks, attack rolls and saving throws.
- Advantage/disadvantage.
- Skills and tool checks.
- Armor Class, hit points, temporary hit points and hit dice.
- Initiative, movement, actions, bonus actions and reactions.
- Conditions and durations.
- Spell attack rolls, save DCs, spell slots and concentration.
- Resting, death saves and recovery.
- Equipment properties, damage types and resistance rules.

## Data-driven rules
Each class, feature, spell, item, condition and monster is represented as structured data with a stable ID, source/license metadata, ruleset version and effect definition. Text descriptions must be original or sourced from material the project is licensed to use.

## MMO extensions
- Cooldowns, threat, telegraphs, encounter phases and group roles are optional MMO layers.
- Keep tabletop action economy distinct from MMO cooldown economy.
- Every ability declares which profile it uses.
- Encounter scripts are deterministic and server authoritative.

## Test requirements
- Ability modifier boundaries.
- Proficiency scaling by level.
- Advantage/disadvantage cancellation.
- Attack vs AC and saving throw resolution.
- Concentration checks and condition expiration.
- Action economy limits.
- Spell slot spending and recovery.
- Damage resistance/vulnerability/critical-hit cases.
- Save/load round-trip of character state.
