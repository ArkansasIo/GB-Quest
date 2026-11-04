# Unreal UI implementation targets

Create these as Widget Blueprints after the C++ project compiles:

- WBP_MainMenu: title, character selection, realm selection, settings and credits.
- WBP_MainHUD: health/mana/stamina, level/XP, minimap, action bar and chat.
- WBP_CharacterPanel: species, class/subclass, attributes, derived stats and equipment.
- WBP_Inventory: item grid, rarity treatment, filters, currency and item details.
- WBP_QuestJournal: quest categories, objectives, tracking and rewards.
- WBP_WorldAtlas: world map, region/zone layers, markers and route planning.
- WBP_CombatOverlay: target frame, status effects, combat log and ability bar.

Visual direction: dark navy/charcoal surfaces, restrained teal highlights, gold for legendary rarity. Keep data in DataAssets/DataTables rather than hard-coded widget text.
