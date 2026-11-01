import test from "node:test";
import assert from "node:assert/strict";
import {
  getCatalogItem, listCatalogItems, createItemInstance, bindItem,
  damageDurability, repairItem, getEquipmentCatalogSummary
} from "../../src/mmorpg/systems/itemization.js";
import { createAuctionHouse, listAuction, searchAuctions, buyAuction, cancelAuction } from "../../src/mmorpg/systems/auction-house.js";
import { createMailbox, sendMail, readMail, claimMail } from "../../src/mmorpg/systems/mail.js";
import { createCollections, collectAppearance, applyTransmog, collectMount } from "../../src/mmorpg/systems/collections.js";
import { createDungeonFinder, queueForDungeon, formDungeonGroups } from "../../src/mmorpg/systems/dungeon-finder.js";
import { WORLD_MAP_COUNT, getWorldMap, listWorldMaps, getWorldMapSummary, validateWorldMapAtlas } from "../../src/mmorpg/world/map-registry.js";

test("equipment catalog includes weapons, armor, gear, tools, packs, mounts and magic items", () => {
  const summary = getEquipmentCatalogSummary();
  assert.equal(summary.weapons, 38);
  assert.equal(summary.armor, 13);
  assert.ok(summary.adventuringGear >= 60);
  assert.ok(summary.tools >= 20);
  assert.ok(summary.magicItems >= 20);
  assert.ok(getCatalogItem("Longsword"));
  assert.ok(getCatalogItem("Plate Armor"));
  assert.ok(getCatalogItem("Bag of Holding"));
  assert.ok(listCatalogItems({ category: "tool" }).length >= 20);
});

test("item instances support binding, durability and repair", () => {
  const item = createItemInstance("Longsword", { bind: "bind_on_equip", maxDurability: 100 });
  assert.equal(bindItem(item, "hero-1", "equip").bound, true);
  assert.equal(bindItem(item, "hero-2", "equip").reason, "already_bound");
  assert.equal(damageDurability(item, 30).durability, 70);
  assert.equal(repairItem(item).durability, 100);
});

test("auction house lists, searches, sells and cancels listings", () => {
  const house = createAuctionHouse();
  const item = createItemInstance("Potion of Healing");
  const listed = listAuction(house, { sellerId: "seller", item, quantity: 2, unitPriceCopper: 5000, expiresAt: Date.now()+10000 });
  assert.equal(listed.ok, true);
  assert.equal(searchAuctions(house, { query: "potion" }).length, 1);
  const result = buyAuction(house, listed.listing.id, "buyer", { copper: 20000 }, {});
  assert.equal(result.ok, true);
  assert.equal(result.sellerProceedsCopper, 9500);
  const other = listAuction(house, { sellerId: "seller", item, quantity: 1, unitPriceCopper: 1000, expiresAt: Date.now()+10000 });
  assert.equal(cancelAuction(house, other.listing.id, "seller").ok, true);
});

test("mail supports delivery, reading and one-time attachment claims", () => {
  const mailbox = createMailbox();
  const sent = sendMail(mailbox, { senderId: "a", recipientId: "b", attachments: [{ templateId: "gear:torch", quantity: 2 }], currencyCopper: 10 });
  assert.equal(sent.ok, true);
  assert.equal(readMail(mailbox, sent.message.id, "b").read, true);
  assert.equal(claimMail(mailbox, sent.message.id, "b").currencyCopper, 10);
  assert.equal(claimMail(mailbox, sent.message.id, "b").reason, "unavailable");
});

test("collections track transmog appearances and mounts", () => {
  const collection = createCollections();
  const item = createItemInstance("Longsword");
  assert.equal(collectAppearance(collection, item), true);
  assert.equal(applyTransmog(collection, item, item.templateId).ok, true);
  assert.equal(collectMount(collection, "mount:warhorse"), true);
  assert.equal(collectMount(collection, "mount:warhorse"), false);
});

test("dungeon finder composes role-balanced five-player groups", () => {
  const finder = createDungeonFinder();
  for (const [playerId, role] of [["t","tank"],["h","healer"],["d1","damage"],["d2","damage"],["d3","damage"]]) {
    assert.equal(queueForDungeon(finder, { playerId, dungeonId: "crypt", role }).ok, true);
  }
  const group = formDungeonGroups(finder, "crypt");
  assert.equal(group.players.length, 5);
  assert.equal(group.state, "formed");
  assert.equal(formDungeonGroups(finder, "crypt"), null);
});

test("world atlas contains exactly 90 unique maps across overworld, dungeon and raid types", () => {
  assert.equal(WORLD_MAP_COUNT, 90);
  assert.equal(validateWorldMapAtlas().valid, true);
  assert.equal(getWorldMapSummary().overworld, 56);
  assert.equal(getWorldMapSummary().dungeons, 20);
  assert.equal(getWorldMapSummary().raids, 14);
  assert.ok(getWorldMap("map-asia-zone-01"));
  assert.equal(listWorldMaps({ kind: "raid" }).length, 14);
  assert.equal(listWorldMaps({ continentId: "europe" }).length, 8);
});
