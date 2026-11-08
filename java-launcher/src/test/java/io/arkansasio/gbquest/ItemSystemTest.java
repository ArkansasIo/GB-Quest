package io.arkansasio.gbquest;

import org.junit.jupiter.api.Test;
import java.util.Random;
import static org.junit.jupiter.api.Assertions.*;

class ItemSystemTest {
    @Test void rarityAddsAffixesAndScalesValue() {
        var common=ItemSystem.generate("iron_longsword",ItemSystem.Rarity.COMMON,1,new Random(7));
        var epic=ItemSystem.generate("iron_longsword",ItemSystem.Rarity.EPIC,10,new Random(7));
        assertEquals(ItemSystem.Slot.WEAPON,common.slot);
        assertTrue(epic.stats.size()>=common.stats.size());
        assertTrue(epic.value()>common.value());
    }
    @Test void inventoryEquipsAndReplacesItems() {
        var inv=new ItemSystem.Inventory();
        inv.add(ItemSystem.generate("rusted_sword",ItemSystem.Rarity.COMMON,1,new Random(1)));
        inv.add(ItemSystem.generate("iron_longsword",ItemSystem.Rarity.UNCOMMON,2,new Random(2)));
        assertNull(inv.equip(0));
        assertNotNull(inv.equip(0));
        assertEquals(1,inv.items().size());
        assertNotNull(inv.unequip(ItemSystem.Slot.WEAPON));
    }
    @Test void vendorRequiresGoldAndInventorySpace() {
        var inv=new ItemSystem.Inventory();var wallet=new ItemSystem.Wallet(0);
        var vendor=new ItemSystem.Vendor(new Random(3),1);
        assertFalse(vendor.buy(0,inv,wallet));
        wallet.gold=10000;
        assertTrue(vendor.buy(0,inv,wallet));
        assertEquals(1,inv.items().size());
        assertTrue(vendor.sell(inv,0,wallet));
    }
}
