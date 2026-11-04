# GB-Quest Unreal Engine 5.7 port

This is an additive conversion. Runtime C++ foundations include 9 attributes, modifier/proficiency rules, d20 attacks with advantage/disadvantage/critical hits, and Primary DataAsset schemas for characters, items and abilities. The editor asset importer reads assets/index.json and imports repository PNGs. Blueprint/DataAsset generation runs inside UE 5.7 because genuine .uasset packages must be serialized by Unreal Editor.

The existing game catalog includes 9 species, 16 classes, 32 subclasses, 59 spells, 400 creatures, 350 bosses, 28 regions and 90 zones. This PR establishes schemas/import foundations; it does not claim all catalog entries, AI, maps, quests, networking or UMG screens have been ported yet.
