import test from "node:test";
import assert from "node:assert/strict";
import {
  getCatalogItem, listCatalogItems, createItemInstance, bindItem,
  damageDurability, repairItem, getEquipmentCatalogSummary
} from "../../src/mmorpg/systems/itemization.js";
import { createAuctionHouse, listAuction, searchAuctions, buyAuction, cancelAuction } from "../../src/mmorpg/systems/auction-house.js";
import { createInventory, addItem, countItem } from "../../src/mmorpg/systems/inventory.js";
import { createMailbox, sendMail, readMail, claimMail, claimMailToCharacter } from "../../src/mmorpg/systems/mail.js";
import { createCollections, collectAppearance, applyTransmog, collectMount } from "../../src/mmorpg/systems/collections.js";
import { createDungeonFinder, queueForDungeon, formDungeonGroups } from "../../src/mmorpg/systems/dungeon-finder.js";
import { WORLD_MAP_COUNT, getWorldMap, listWorldMaps, getWorldMapSummary, validateWorldMapAtlas } from "../../src/mmorpg/world/map-registry.js";
import { generateMapChunk, getMapChunkBounds } from "../../src/mmorpg/world/map-generator.js";

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

test("auction escrow reserves seller stock, delivers purchases and refunds cancelled stock", () => {
  const house = createAuctionHouse();
  const item = createItemInstance("Potion of Healing");
  const sellerInventory = createInventory();
  const sellerWallet = { copper: 1000 };
  addItem(sellerInventory, { id: item.templateId, ...item }, 3);
  const listed = listAuction(house, {
    sellerId: "seller", item, quantity: 2, unitPriceCopper: 5000,
    expiresAt: Date.now() + 10000, sellerInventory, sellerWallet
  });
  assert.equal(listed.ok, true);
  assert.equal(countItem(sellerInventory, item.templateId), 1);
  assert.equal(sellerWallet.copper, 800);
  assert.equal(searchAuctions(house, { query: "potion" }).length, 1);

  const buyerInventory = createInventory();
  const buyerWallet = { copper: 20000 };
  const result = buyAuction(house, listed.listing.id, "buyer", buyerWallet, buyerInventory, Date.now(), sellerWallet);
  assert.equal(result.ok, true);
  assert.equal(result.sellerProceedsCopper, 9500);
  assert.equal(countItem(buyerInventory, item.templateId), 2);
  assert.equal(buyerWallet.copper, 10000);
  assert.equal(sellerWallet.copper, 10300);

  const other = listAuction(house, {
    sellerId: "seller", item, quantity: 1, unitPriceCopper: 1000,
    expiresAt: Date.now() + 10000, sellerInventory, sellerWallet
  });
  assert.equal(other.ok, true);
  assert.equal(cancelAuction(house, other.listing.id, "seller", sellerInventory).ok, true);
  assert.equal(countItem(sellerInventory, item.templateId), 1);
});

test("failed auction delivery does not charge the buyer or close the listing", () => {
  const house = createAuctionHouse();
  const item = createItemInstance("Potion of Healing");
  const sellerInventory = createInventory();
  addItem(sellerInventory, { id: item.templateId, ...item }, 1);
  const listed = listAuction(house, { sellerId: "seller", item, quantity: 1, unitPriceCopper: 50, expiresAt: Date.now()+10000, sellerInventory, sellerWallet: { copper: 100 } });
  const wallet = { copper: 100 };
  const inventory = createInventory({ capacity: 0 });
  const result = buyAuction(house, listed.listing.id, "buyer", wallet, inventory);
  assert.equal(result.ok, false);
  assert.equal(wallet.copper, 100);
  assert.equal(listed.listing.state, "active");
});

test("mail supports delivery, reading, transactional one-time claims and retry after capacity failure", () => {
  const mailbox = createMailbox();
  const sent = sendMail(mailbox, { senderId: "a", recipientId: "b", attachments: [{ templateId: "gear:torch", quantity: 2 }], currencyCopper: 10 });
  assert.equal(sent.ok, true);
  assert.equal(readMail(mailbox, sent.message.id, "b").read, true);

  const inventory = createInventory({ capacity: 0 });
  const wallet = { copper: 5 };
  const failed = claimMailToCharacter(mailbox, sent.message.id, "b", inventory, wallet);
  assert.equal(failed.ok, false);
  assert.equal(wallet.copper, 5);
  assert.equal(sent.message.claimed, false);

  const workingInventory = createInventory();
  const claimed = claimMailToCharacter(mailbox, sent.message.id, "b", workingInventory, wallet);
  assert.equal(claimed.ok, true);
  assert.equal(countItem(workingInventory, "gear:torch"), 2);
  assert.equal(wallet.copper, 15);
  assert.equal(claimMailToCharacter(mailbox, sent.message.id, "b", workingInventory, wallet).reason, "unavailable");

  const legacy = sendMail(mailbox, { senderId: "a", recipientId: "c", currencyCopper: 10 });
  assert.equal(claimMail(mailbox, legacy.message.id, "c").currencyCopper, 10);
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
  assert.equal(listWorldMaps({ continentId: "europe" }).length, 10);
});

test("procedural map chunks are deterministic, bounded and expose terrain layers", () => {
  const first = generateMapChunk("map-asia-zone-01", 0, 0);
  const again = generateMapChunk("map-asia-zone-01", 0, 0);
  assert.equal(first.ok, true);
  assert.deepEqual(first.layers, again.layers);
  assert.equal(first.chunk.width, 32);
  assert.equal(first.chunk.height, 32);
  assert.equal(first.layers.terrain.length, 1024);
  assert.ok(first.layers.terrain.every(tile => Number.isInteger(tile) && tile >= 0 && tile <= 7));
  assert.equal(generateMapChunk("map-asia-zone-01", 99, 0).reason, "chunk_out_of_bounds");
  assert.deepEqual(getMapChunkBounds("map-asia-zone-01"), { columns: 16, rows: 16, chunkSize: 32 });
});
