import catalog from "../data/expansion-catalog.json" with { type: "json" };
export const EXPANSION_MENU = Object.freeze([
  { id: "character", label: "Character", children: ["Overview", "Attributes", "Equipment", "Talents", "Achievements"] },
  { id: "social", label: "Social", children: ["Guild", "Guild Bank", "Guild Events", "Party Finder", "Friends", "Mail"] },
  { id: "world", label: "World", children: ["World Map", "Quest Log", "World Events", "Dungeons", "Raids", "Collections"] },
  { id: "trade", label: "Trade", children: ["Auction House", "Player Trading", "Professions", "Crafting", "Gathering"] },
  { id: "system", label: "System", children: ["Settings", "Accessibility", "Keybindings", "Help", "Exit"] }
]);
export function buildExpansionMenuState({ character = null, guild = null, collections = null, online = false } = {}) {
  return EXPANSION_MENU.map(section => ({ ...section, children: section.children.map(label => ({
    label,
    enabled: label === "Character" || label === "Overview" ? !!character :
      ["Guild", "Guild Bank", "Guild Events"].includes(label) ? !!guild :
      label === "Collections" ? !!collections :
      ["Party Finder", "Friends", "Mail", "Auction House", "Player Trading"].includes(label) ? !!online : true
  })) }));
}
export function getExpansionCatalog() { return structuredClone(catalog); }
