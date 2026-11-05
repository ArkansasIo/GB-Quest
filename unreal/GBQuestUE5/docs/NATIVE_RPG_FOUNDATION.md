# Native Unreal RPG foundation

This module adds a Blueprint-callable C++ foundation alongside the existing browser wrapper. It does not replace the browser game or claim that its JavaScript systems have been transpiled.

## Components

- UGBQuestStatsComponent: six primary attributes, vitality/constitution health formula, damage, healing and health-change events.
- UGBQuestInventoryComponent: stack-aware inventory with capacity checks, add/remove operations and change events.
- UGBQuestCombatComponent: resolves a basic attack against a target actor carrying UGBQuestStatsComponent.
- GBQuestRPGTypes.h: shared Blueprint-visible attribute, item-stack and damage-result structures.

## Add to an actor

In an Unreal Blueprint, add Stats, Inventory and Combat components. Set attributes and attack tuning in the Details panel. Call TryApplyAttack from an authoritative server-side action; the current component is a gameplay foundation, not a network-security boundary.

## Integration boundaries

- The current wrapper GameMode still launches the browser widget.
- The C++ components are available to native Unreal actors and Blueprint classes but are not yet wired into the browser UI.
- Item definitions, persistence, replication, anti-cheat validation, abilities, animation notifies, equipment slots and MMO services remain separate implementation tasks.
- Validate compilation and Blueprint exposure in the target Unreal Engine 5.8 installation. Repository CI does not run UnrealBuildTool.
