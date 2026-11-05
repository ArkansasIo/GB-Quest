package io.arkansasio.gbquest;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import java.nio.file.Path;
import java.util.Random;
import static org.junit.jupiter.api.Assertions.*;

class SaveStoreTest {
    @TempDir Path temp;
    @Test void roundTripsProgressWalletAndExactEquipment() throws Exception {
        GameState original=new GameState("Ari","thornelf","arcanist");
        original.level=7;original.hero.level=7;original.xp=14000;original.hero.xp=14000;
        original.wallet.gold=444;original.gold=444;original.hp=Math.min(17,original.maxHp);
        original.inventory.add(ItemSystem.generate("moonsteel_blade",ItemSystem.Rarity.EPIC,12,new Random(88)));
        Path file=temp.resolve("hero.properties");
        SaveStore.save(original,file);
        GameState loaded=new GameState();
        SaveStore.load(loaded,file);
        assertEquals(7,loaded.level);
        assertEquals(14000,loaded.xp);
        assertEquals(444,loaded.gold);
        assertEquals(original.inventory.equipment().get(ItemSystem.Slot.WEAPON).name,
                loaded.inventory.equipment().get(ItemSystem.Slot.WEAPON).name);
        assertEquals(original.inventory.items().get(0).stats,loaded.inventory.items().get(0).stats);
        assertEquals(original.hp,loaded.hp);
    }
}
