import test from 'node:test';
import assert from 'node:assert/strict';
await import('../src/ui_menu_chrome.js');
const chrome=globalThis.GBQMenuChrome;
test('menu chrome declares the main and nested interface areas',()=>{assert.ok(chrome);for(const name of ['title','save-slots','character-creation','main-menu','character','inventory','equipment','spellbook','skills','talents','quests','world-map','crafting','auction-house','guild','social','settings','key-bindings','dialogue','confirmation','choice-lists'])assert.ok(chrome.surfaces.includes(name),name);});
test('menu chrome exposes reusable components for screens and submenus',()=>{for(const name of ['ornate-panel','section-heading','active-tab','selected-row','item-slot','rarity-frame','progress-meter','scroll-track','modal-choice','dialogue-plaque','footer-hint'])assert.ok(chrome.components.includes(name),name);});
