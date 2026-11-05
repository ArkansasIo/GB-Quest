package io.arkansasio.gbquest;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class CharacterRulesTest {
    @Test void createsKnownSpeciesAndClasses() {
        var c=CharacterRules.create("Test Hero","thornelf","arcanist");
        assertEquals(1,c.level);
        assertEquals("thornelf",c.speciesId);
        assertEquals("arcanist",c.classId);
        assertTrue(CharacterRules.derive(c).hpMax()>0);
        assertEquals(13+2,c.base.get("DEX"));
        assertEquals(12+1,c.base.get("WIS"));
    }
    @Test void progressionUsesReferenceThresholds() {
        assertEquals(300,CharacterRules.xpForLevel(2));
        assertEquals(355000,CharacterRules.xpForLevel(20));
        assertEquals(395000,CharacterRules.xpForLevel(21));
        var c=CharacterRules.create("Hero","hearthkin","warden");
        assertTrue(c.grantXp(300));
        assertEquals(2,c.level);
    }
    @Test void rejectsUnknownCharacterOptions() {
        assertThrows(IllegalArgumentException.class,()->CharacterRules.create("Hero","unknown","warden"));
        assertThrows(IllegalArgumentException.class,()->CharacterRules.create("Hero","hearthkin","unknown"));
    }
}
