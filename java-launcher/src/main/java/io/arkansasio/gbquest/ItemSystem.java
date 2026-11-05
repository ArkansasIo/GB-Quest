package io.arkansasio.gbquest;

import java.util.*;

/** Data-driven equipment, affix, inventory and vendor economy for the Java edition. */
public final class ItemSystem {
    public enum Rarity {
        COMMON(1,1.0), UNCOMMON(2,1.25), RARE(3,1.6), EPIC(4,2.2), LEGENDARY(5,3.0), MYTHIC(6,4.2);
        public final int tier; public final double priceScale;
        Rarity(int tier,double priceScale){this.tier=tier;this.priceScale=priceScale;}
    }
    public enum Slot { WEAPON, HEAD, CHEST, HANDS, LEGS, FEET, BACK, WAIST, NECK, RING1, RING2, OFFHAND }
    public record Template(String id,String name,Slot slot,int basePrice,Map<String,Integer> stats) {}
    public record Affix(String name,String stat,int min,int max) {}
    public static final class Item {
        public final String id,name; public final Slot slot; public final Rarity rarity;
        public final int level,basePrice; public final Map<String,Integer> stats; public final List<String> affixes;
        Item(String id,String name,Slot slot,Rarity rarity,int level,int basePrice,Map<String,Integer> stats,List<String> affixes){
            this.id=id;this.name=name;this.slot=slot;this.rarity=rarity;this.level=level;this.basePrice=basePrice;
            this.stats=Map.copyOf(stats);this.affixes=List.copyOf(affixes);
        }
        public int value(){return Math.max(1,(int)Math.round(basePrice*rarity.priceScale*(1+level*.08)));}
    }
    private static final Map<String,Template> TEMPLATES;
    private static final List<Affix> AFFIXES=List.of(
        new Affix("of Might","STR",1,3),new Affix("of Finesse","DEX",1,3),
        new Affix("of Fortitude","CON",1,3),new Affix("of Insight","INT",1,3),
        new Affix("of Wisdom","WIS",1,3),new Affix("of Vitality","HP",5,20),
        new Affix("of Precision","HIT",1,4),new Affix("of Warding","AC",1,2),
        new Affix("of Ruin","DMG",2,8),new Affix("of Fortune","LCK",1,3));
    static {
        Map<String,Template> m=new LinkedHashMap<>();
        add(m,"rusted_sword","Rusted Sword",Slot.WEAPON,12,Map.of("DMG",2));
        add(m,"iron_longsword","Iron Longsword",Slot.WEAPON,65,Map.of("DMG",5,"STR",1));
        add(m,"moonsteel_blade","Moonsteel Blade",Slot.WEAPON,420,Map.of("DMG",10,"DEX",2,"CRIT",2));
        add(m,"oak_staff","Oak Staff",Slot.WEAPON,24,Map.of("DMG",3,"INT",1));
        add(m,"hunter_bow","Hunter Bow",Slot.WEAPON,48,Map.of("DMG",4,"DEX",1,"HIT",1));
        add(m,"padded_vest","Padded Vest",Slot.CHEST,18,Map.of("AC",1));
        add(m,"chain_hauberk","Chain Hauberk",Slot.CHEST,95,Map.of("AC",3,"CON",1));
        add(m,"warden_plate","Warden Plate",Slot.CHEST,360,Map.of("AC",5,"CON",2));
        add(m,"leather_cap","Leather Cap",Slot.HEAD,14,Map.of("AC",1));
        add(m,"iron_gauntlets","Iron Gauntlets",Slot.HANDS,30,Map.of("AC",1,"STR",1));
        add(m,"traveller_boots","Traveller Boots",Slot.FEET,20,Map.of("DEX",1));
        add(m,"warding_cloak","Warding Cloak",Slot.BACK,55,Map.of("AC",1,"WIS",1));
        add(m,"iron_buckler","Iron Buckler",Slot.OFFHAND,45,Map.of("AC",2));
        add(m,"silver_ring","Silver Ring",Slot.RING1,80,Map.of("LCK",1));
        add(m,"vitality_amulet","Amulet of Vitality",Slot.NECK,110,Map.of("HP",12,"CON",1));
        TEMPLATES=Map.copyOf(m);
    }
    private static void add(Map<String,Template> m,String id,String name,Slot slot,int price,Map<String,Integer> stats){m.put(id,new Template(id,name,slot,price,stats));}
    private ItemSystem() {}
    public static Set<String> templateIds(){return TEMPLATES.keySet();}
    public static Item restoreItem(String templateId,String name,Rarity rarity,int level,Map<String,Integer> stats,List<String> affixes){
        Template t=TEMPLATES.get(templateId);if(t==null)throw new IllegalArgumentException("Unknown item template: "+templateId);
        return new Item(t.id,name,t.slot,rarity,Math.max(1,Math.min(720,level)),t.basePrice,stats,affixes);
    }
    public static Item generate(String templateId,Rarity rarity,int level,Random rng){
        Template t=TEMPLATES.get(templateId);if(t==null)throw new IllegalArgumentException("Unknown item template: "+templateId);
        int ilvl=Math.max(1,Math.min(720,level));Map<String,Integer> stats=new LinkedHashMap<>(t.stats());List<String> names=new ArrayList<>();
        int affixCount=Math.max(0,rarity.tier-1);
        for(int i=0;i<affixCount;i++){Affix a=AFFIXES.get(rng.nextInt(AFFIXES.size()));int v=a.min()+rng.nextInt(a.max()-a.min()+1)+Math.max(0,ilvl/20);stats.merge(a.stat(),v,Integer::sum);names.add(a.name());}
        int scale=1+Math.max(0,ilvl-1)/10;stats.replaceAll((k,v)->v*scale);
        String suffix=names.isEmpty()?"":" "+String.join(" ",names);
        return new Item(t.id,t.name+suffix,t.slot,rarity,ilvl,t.basePrice,stats,names);
    }
    public static final class Inventory {
        private final List<Item> bag=new ArrayList<>();
        private final EnumMap<Slot,Item> equipped=new EnumMap<>(Slot.class);
        public int capacity=40;
        public List<Item> items(){return Collections.unmodifiableList(bag);}
        public Map<Slot,Item> equipment(){return Collections.unmodifiableMap(equipped);}
        public boolean add(Item item){if(bag.size()>=capacity)return false;bag.add(item);return true;}
        public void clear(){bag.clear();equipped.clear();}
        public void restoreEquipped(Slot slot,Item item){equipped.put(slot,item);}
        public void restoreBag(Item item){if(!add(item))throw new IllegalStateException("Save exceeds inventory capacity");}
        public Item equip(int bagIndex){
            if(bagIndex<0||bagIndex>=bag.size())throw new IndexOutOfBoundsException("Invalid inventory index");
            Item item=bag.remove(bagIndex);Slot slot=item.slot;
            if(slot==Slot.RING1&&equipped.containsKey(Slot.RING1))slot=Slot.RING2;
            Item old=equipped.put(slot,item);if(old!=null)bag.add(old);return old;
        }
        public Item unequip(Slot slot){Item item=equipped.remove(slot);if(item!=null&&!add(item)){equipped.put(slot,item);throw new IllegalStateException("Inventory is full");}return item;}
        public int sell(int bagIndex){if(bagIndex<0||bagIndex>=bag.size())throw new IndexOutOfBoundsException();return Math.max(1,bag.remove(bagIndex).value()/2);}
        public Map<String,Integer> totalStats(){
            Map<String,Integer> out=new LinkedHashMap<>();for(Item item:equipped.values())item.stats.forEach((k,v)->out.merge(k,v,Integer::sum));return Map.copyOf(out);
        }
        public void applyTo(CharacterRules.Character c){
            Map<String,Integer> s=totalStats();for(String a:CharacterRules.ATTRIBUTES)c.gearBonuses.put(a,s.getOrDefault(a,0));
            c.armorBonus=s.getOrDefault("AC",0);c.flatHp=s.getOrDefault("HP",0);
        }
    }
    public static final class Vendor {
        private final List<Item> stock=new ArrayList<>();
        public Vendor(Random rng,int playerLevel){
            String[] ids={"rusted_sword","padded_vest","leather_cap","oak_staff","hunter_bow","iron_buckler","traveller_boots"};
            for(String id:ids)stock.add(generate(id,Rarity.COMMON,playerLevel,rng));
        }
        public List<Item> stock(){return Collections.unmodifiableList(stock);}
        public boolean buy(int index,Inventory inventory,Wallet wallet){
            if(index<0||index>=stock.size())return false;Item item=stock.get(index);
            if(wallet.gold<item.value()||inventory.items().size()>=inventory.capacity)return false;
            wallet.gold-=item.value();inventory.add(item);stock.remove(index);return true;
        }
        public boolean sell(Inventory inventory,int index,Wallet wallet){
            if(index<0||index>=inventory.items().size())return false;wallet.gold+=inventory.sell(index);return true;
        }
    }
    public static final class Wallet {public int gold;public Wallet(int gold){this.gold=Math.max(0,gold);}}
}
