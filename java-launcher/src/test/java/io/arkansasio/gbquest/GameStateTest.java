package io.arkansasio.gbquest;

import org.junit.jupiter.api.Test;
import java.util.Random;
import static org.junit.jupiter.api.Assertions.*;

class GameStateTest {
    @Test void picksUpEquipmentIntoInventory() {
        GameState game=new GameState();
        int before=game.inventory.items().size();
        ItemSystem.Item drop=ItemSystem.generate("iron_longsword",ItemSystem.Rarity.RARE,3,new Random(4));
        GameState.Loot loot=GameState.Loot.item(game.x,game.y,drop);
        game.loot.add(loot);
        game.update();
        assertTrue(loot.taken);
        assertEquals(before+1,game.inventory.items().size());
        assertSame(drop,game.inventory.items().get(game.inventory.items().size()-1));
    }
    @Test void leavesEquipmentOnGroundWhenInventoryIsFull() {
        GameState game=new GameState();
        while(game.inventory.items().size()<game.inventory.capacity)
            game.inventory.add(ItemSystem.generate("rusted_sword",ItemSystem.Rarity.COMMON,1,new Random(game.inventory.items().size())));
        ItemSystem.Item drop=ItemSystem.generate("iron_longsword",ItemSystem.Rarity.EPIC,5,new Random(9));
        GameState.Loot loot=GameState.Loot.item(game.x,game.y,drop);
        game.loot.add(loot);
        game.update();
        assertFalse(loot.taken);
        assertEquals(game.inventory.capacity,game.inventory.items().size());
    }
}
