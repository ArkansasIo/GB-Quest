package io.arkansasio.gbquest;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;

/** Versioned local persistence for character progression, wallet and exact equipment rolls. */
public final class SaveStore {
    private SaveStore() {}
    public static void save(GameState s) throws IOException {
        Path file=Path.of("saves","java-edition.properties");
        Files.createDirectories(file.getParent());
        Properties p=new Properties();
        p.setProperty("version","2");
        p.setProperty("x",Double.toString(s.x));p.setProperty("y",Double.toString(s.y));
        p.setProperty("hp",Integer.toString(s.hp));p.setProperty("level",Integer.toString(s.level));
        p.setProperty("xp",Integer.toString(s.xp));p.setProperty("gold",Integer.toString(s.gold));
        p.setProperty("potions",Integer.toString(s.potions));
        p.setProperty("bag.count",Integer.toString(s.inventory.items().size()));
        for(int i=0;i<s.inventory.items().size();i++)writeItem(p,"bag."+i,s.inventory.items().get(i));
        for(var entry:s.inventory.equipment().entrySet())writeItem(p,"equip."+entry.getKey().name(),entry.getValue());
        try(var out=Files.newOutputStream(file)){p.store(out,"GB-Quest native Java save");}
    }
    public static void load(GameState s) throws IOException {
        Path file=Path.of("saves","java-edition.properties");
        if(!Files.isRegularFile(file))return;
        Properties p=new Properties();try(var in=Files.newInputStream(file)){p.load(in);}
        String version=p.getProperty("version","1");
        if(!version.equals("1")&&!version.equals("2"))throw new IOException("Unsupported Java save version: "+version);
        s.x=number(p,"x",s.x);s.y=number(p,"y",s.y);
        s.level=clamp(integer(p,"level",s.level),1,CharacterRules.MAX_LEVEL);
        s.xp=Math.max(0,integer(p,"xp",s.xp));s.gold=Math.max(0,integer(p,"gold",s.gold));
        s.potions=Math.max(0,integer(p,"potions",s.potions));s.wallet.gold=s.gold;
        if(version.equals("2"))readInventory(p,s.inventory);
        s.restoreProgress();s.hp=clamp(integer(p,"hp",s.hp),0,s.maxHp);s.hero.hp=s.hp;
    }
    private static void writeItem(Properties p,String prefix,ItemSystem.Item item){
        p.setProperty(prefix+".id",item.id);p.setProperty(prefix+".name",item.name);
        p.setProperty(prefix+".rarity",item.rarity.name());p.setProperty(prefix+".level",Integer.toString(item.level));
        StringJoiner stats=new StringJoiner(",");
        item.stats.forEach((k,v)->stats.add(k+"="+v));p.setProperty(prefix+".stats",stats.toString());
        p.setProperty(prefix+".affixes",String.join(";",item.affixes));
    }
    private static ItemSystem.Item readItem(Properties p,String prefix) throws IOException {
        String id=p.getProperty(prefix+".id");if(id==null)return null;
        try{
            ItemSystem.Rarity rarity=ItemSystem.Rarity.valueOf(p.getProperty(prefix+".rarity","COMMON"));
            int level=clamp(integer(p,prefix+".level",1),1,CharacterRules.MAX_LEVEL);
            Map<String,Integer> stats=new LinkedHashMap<>();
            String encoded=p.getProperty(prefix+".stats","");
            if(!encoded.isBlank())for(String part:encoded.split(",")){String[] pair=part.split("=",2);if(pair.length==2)stats.put(pair[0],Integer.parseInt(pair[1]));}
            List<String> affixes=encodedList(p.getProperty(prefix+".affixes",""));
            return ItemSystem.restoreItem(id,p.getProperty(prefix+".name",id),rarity,level,stats,affixes);
        }catch(RuntimeException ex){throw new IOException("Invalid saved item at "+prefix,ex);}
    }
    private static void readInventory(Properties p,ItemSystem.Inventory inventory) throws IOException {
        inventory.clear();
        int count=clamp(integer(p,"bag.count",0),0,inventory.capacity);
        for(int i=0;i<count;i++){ItemSystem.Item item=readItem(p,"bag."+i);if(item!=null)inventory.restoreBag(item);}
        for(ItemSystem.Slot slot:ItemSystem.Slot.values()){
            ItemSystem.Item item=readItem(p,"equip."+slot.name());if(item!=null)inventory.restoreEquipped(slot,item);
        }
    }
    private static List<String> encodedList(String s){return s.isBlank()?List.of():Arrays.asList(s.split(";"));}
    private static double number(Properties p,String k,double d){try{return Double.parseDouble(p.getProperty(k));}catch(Exception e){return d;}}
    private static int integer(Properties p,String k,int d){try{return Integer.parseInt(p.getProperty(k));}catch(Exception e){return d;}}
    private static int clamp(int v,int lo,int hi){return Math.max(lo,Math.min(hi,v));}
}
