import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");

test("GM and debug scripts are compile-time disabled in the public client", () => {
  const admin = read("../src/admin.js");
  const debug = read("../src/debug.js");
  assert.match(admin, /const GAME_ADMIN_ENABLED = false;/);
  assert.match(debug, /const GAME_DEBUG_ENABLED = false;/);
  assert.doesNotThrow(() => new vm.Script(admin, { filename: "src/admin.js" }));
  assert.doesNotThrow(() => new vm.Script(debug, { filename: "src/debug.js" }));
});

test("player settings do not expose GM, developer mode or debug panel entries", () => {
  const menus = read("../src/scenes_menu.js");
  const match = menus.match(/items\(\) \{ return \[([^\]]+)\]; \}/);
  assert.ok(match, "settings list exists");
  assert.doesNotMatch(match[1], /ADMIN CONTROL|DEVELOPER MODE|DEBUG PANEL/);
  assert.doesNotMatch(menus, /S\.devMode = !S\.devMode/);
});
