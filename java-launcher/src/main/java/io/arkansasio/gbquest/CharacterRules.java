package io.arkansasio.gbquest;

import java.util.*;

/**
 * Java port of GB-Quest's character creation and core derived-stat rules.
 * Values and progression are based on src/data_rules.js and src/rules.js.
 */
public final class CharacterRules {
    public static final List<String> ATTRIBUTES=List.of("STR","DEX","CON","INT","WIS","CHA","LCK","WIL","SPD");
    public static final int MAX_LEVEL=720, PARAGON_XP=40_000;
    private static final int[] XP={0,300,900,2700,6500,14000,23000,34000,48000,64000,85000,100000,120000,140000,165000,195000,225000,265000,305000,355000};
    public record Species(String id,String name,Map<String,Integer> bonuses,Set<String> traits) {}
    public record ClassDef(String id,String name,int hitDie,String primary,String role) {}
    public record Derived(int hpMax,int armorClass,int proficiency,int initiative,
                          Map<String,Integer> abilityScores,Map<String,Integer> modifiers,
                          Map<String,Integer> savingThrows,Map<String,Integer> skills) {}
    private static Map<String,Integer> bonus(Object... kv){Map<String,Integer> m=new LinkedHashMap<>();for(int i=0;i<kv.length;i+=2)m.put((String)kv[i],(Integer)kv[i+1]);return Map.copyOf(m);}
    private static final Map<String,Species> SPECIES;
    private static final Map<String,ClassDef> CLASSES;
    private static final Map<String,String> SKILLS;
    static {
        Map<String,Species> sp=new LinkedHashMap<>();
        addSpecies(sp,"hearthkin","Hearthkin",bonus("STR",1,"DEX",1,"CON",1,"INT",1,"WIS",1,"CHA",1),"versatile");
        addSpecies(sp,"thornelf","Thornelf",bonus("DEX",2,"WIS",1),"keen","feyblood");
        addSpecies(sp,"stonekin","Stonekin",bonus("CON",2,"STR",1),"stoneblood","poison-resistance");
        addSpecies(sp,"wispling","Wispling",bonus("DEX",2,"CHA",1),"lucky","brave");
        addSpecies(sp,"emberborn","Emberborn",bonus("CHA",2,"INT",1),"emberbolt","fire-resistance");
        addSpecies(sp,"burrowkin","Burrowkin",bonus("INT",2,"CON",1),"cunning");
        addSpecies(sp,"twinblood","Twinblood",bonus("CHA",2,"DEX",1,"CON",1),"feyblood","versatile");
        addSpecies(sp,"tuskborn","Tuskborn",bonus("STR",2,"CON",1),"relentless");
        addSpecies(sp,"drakkin","Drakkin",bonus("STR",2,"CHA",1),"breath","fire-resistance");
        addSpecies(sp,"hornfolk","Hornfolk",bonus("STR",2,"CON",1),"stalwart","warstomp");
        addSpecies(sp,"felinar","Felinar",bonus("DEX",2,"WIS",1),"keen","nimble");
        addSpecies(sp,"pipkin","Pipkin",bonus("INT",2,"DEX",1),"cunning","spellspark");
        addSpecies(sp,"lunari","Lunari",bonus("DEX",2,"INT",1),"feyblood","shadowmeld");
        addSpecies(sp,"wolfkin","Wolfkin",bonus("STR",2,"DEX",1),"feral");
        addSpecies(sp,"starkin","Starkin",bonus("WIS",2,"CHA",1),"lightsgift","radiant-resistance");
        SPECIES=Map.copyOf(sp);
        Map<String,ClassDef> cl=new LinkedHashMap<>();
        addClass(cl,"warden","Warden",10,"STR","tank"); addClass(cl,"vanguard","Vanguard",10,"STR","tank");
        addClass(cl,"berserker","Berserker",12,"STR","dps"); addClass(cl,"chaplain","Chaplain",8,"WIS","healer");
        addClass(cl,"cantor","Cantor",8,"CHA","healer"); addClass(cl,"verdant","Verdant",8,"WIS","healer");
        addClass(cl,"arcanist","Arcanist",6,"INT","dps"); addClass(cl,"strider","Strider",10,"DEX","dps");
        addClass(cl,"shade","Shade",8,"DEX","dps"); addClass(cl,"wildblood","Wildblood",10,"WIS","dps");
        addClass(cl,"pactbound","Pactbound",8,"CHA","dps"); addClass(cl,"ascetic","Ascetic",8,"DEX","dps");
        addClass(cl,"ronin","Ronin",10,"STR","dps"); addClass(cl,"shinobi","Shinobi",8,"DEX","dps");
        addClass(cl,"bladedancer","Bladedancer",8,"DEX","healer"); addClass(cl,"wyrmlancer","Wyrmlancer",10,"STR","dps");
        addClass(cl,"corsair","Corsair",8,"DEX","dps"); addClass(cl,"beastcaller","Beastcaller",10,"CHA","tank");
        addClass(cl,"puppeteer","Puppeteer",8,"INT","tank"); addClass(cl,"dreadknight","Dreadknight",10,"STR","tank");
        addClass(cl,"voidhunter","Voidhunter",10,"DEX","dps"); addClass(cl,"scalesage","Scalesage",8,"INT","healer");
        addClass(cl,"stormcaller","Stormcaller",8,"WIS","healer");
        // Additional legacy job slots use conservative defaults until their exact class records are ported.
        addClass(cl,"necromancer","Necromancer",6,"INT","dps"); addClass(cl,"summoner","Summoner",8,"CHA","dps");
        addClass(cl,"sunwarden","Sunwarden",10,"WIS","healer"); addClass(cl,"runeblade","Runeblade",10,"STR","tank");
        CLASSES=Map.copyOf(cl);
        SKILLS=Map.ofEntries(Map.entry("athletics","STR"),Map.entry("acrobatics","DEX"),Map.entry("stealth","DEX"),
          Map.entry("sleight","DEX"),Map.entry("arcana","INT"),Map.entry("history","INT"),Map.entry("investigation","INT"),
          Map.entry("nature","INT"),Map.entry("religion","INT"),Map.entry("animal","WIS"),Map.entry("insight","WIS"),
          Map.entry("medicine","WIS"),Map.entry("perception","WIS"),Map.entry("survival","WIS"),Map.entry("deception","CHA"),
          Map.entry("intimidation","CHA"),Map.entry("performance","CHA"),Map.entry("persuasion","CHA"));
    }
    private static void addSpecies(Map<String,Species> m,String id,String name,Map<String,Integer> b,String... traits){m.put(id,new Species(id,name,b,Set.of(traits)));}
    private static void addClass(Map<String,ClassDef> m,String id,String name,int hd,String primary,String role){m.put(id,new ClassDef(id,name,hd,primary,role));}
    private CharacterRules() {}
    public static Set<String> speciesIds(){return SPECIES.keySet();}
    public static Set<String> classIds(){return CLASSES.keySet();}
    public static int xpForLevel(int level){int l=Math.max(1,Math.min(MAX_LEVEL,level));return l<=20?XP[l-1]:XP[19]+(l-20)*PARAGON_XP;}
    public static int levelForXp(int xp){int level=1;while(level<MAX_LEVEL&&xp>=xpForLevel(level+1))level++;return level;}
    public static int modifier(int score){return (int)Math.floor((score-10)/2.0);}
    public static int proficiency(int level){int l=Math.max(1,Math.min(MAX_LEVEL,level));return 2+(l-1)/4+Math.max(0,l-20)/60;}
    public static Character create(String name,String speciesId,String classId){
        Species sp=SPECIES.get(speciesId);ClassDef cls=CLASSES.get(classId);
        if(sp==null)throw new IllegalArgumentException("Unknown species: "+speciesId);
        if(cls==null)throw new IllegalArgumentException("Unknown class: "+classId);
        int[] array={15,14,13,12,10,8};String[] priority={cls.primary(),"CON","DEX","WIS","STR","INT","CHA"};
        LinkedHashMap<String,Integer> scores=new LinkedHashMap<>();int i=0;
        for(String a:priority)if(!scores.containsKey(a)&&i<array.length)scores.put(a,array[i++]);
        for(String a:List.of("STR","DEX","CON","INT","WIS","CHA"))scores.putIfAbsent(a,10);
        sp.bonuses().forEach((a,v)->scores.merge(a,v,Integer::sum));
        scores.put("LCK",10+(sp.traits().contains("lucky")?2:0));
        scores.put("WIL",10+(classId.equals("ascetic")||classId.equals("chaplain")?2:0));
        scores.put("SPD",10+(classId.equals("shade")||classId.equals("strider")?2:0));
        Character c=new Character(name,speciesId,classId,scores);Derived d=derive(c);
        c.hp=d.hpMax();c.maxHp=d.hpMax();return c;
    }
    public static Derived derive(Character c){
        ClassDef cls=CLASSES.get(c.classId);if(cls==null)throw new IllegalArgumentException("Unknown class");
        Map<String,Integer> a=new LinkedHashMap<>(),m=new LinkedHashMap<>();
        for(String key:ATTRIBUTES){int score=c.base.getOrDefault(key,10)+c.ascension.getOrDefault(key,0)+c.gearBonuses.getOrDefault(key,0);a.put(key,score);m.put(key,modifier(score));}
        int level=Math.max(1,Math.min(MAX_LEVEL,c.level)),con=m.get("CON"),dex=m.get("DEX");
        double rawHp=cls.hitDie()+con+(level-1)*(cls.hitDie()/2.0+1+con)+Math.max(0,level-20)*(cls.hitDie()/2.0+Math.max(1,con));
        int hp=(int)Math.round(rawHp);
        hp=Math.max(1,hp+c.flatHp);
        int ac=10+dex+c.armorBonus+c.shieldBonus;
        int pb=proficiency(level);
        Set<String> proficientSaves=saveProficiencies(c.classId);
        Map<String,Integer> saves=new LinkedHashMap<>();for(String k:List.of("STR","DEX","CON","INT","WIS","CHA"))saves.put(k,m.get(k)+(proficientSaves.contains(k)?pb:0));
        Map<String,Integer> skills=new LinkedHashMap<>();SKILLS.forEach((skill,ability)->skills.put(skill,m.get(ability)));
        return new Derived(hp,ac,pb,m.get("DEX"),Map.copyOf(a),Map.copyOf(m),Map.copyOf(saves),Map.copyOf(skills));
    }
    private static Set<String> saveProficiencies(String id){
        return switch(id){
            case "warden","vanguard","berserker","wyrmlancer","dreadknight" -> Set.of("STR","CON");
            case "chaplain","cantor","stormcaller","sunwarden" -> Set.of("WIS","CHA");
            case "verdant","arcanist","scalesage","necromancer" -> Set.of("INT","WIS");
            case "strider","ronin","ascetic" -> Set.of("STR","DEX");
            case "shade","shinobi","puppeteer" -> Set.of("DEX","INT");
            case "wildblood" -> Set.of("STR","WIS");
            case "pactbound" -> Set.of("WIS","CHA");
            case "bladedancer","corsair" -> Set.of("DEX","CHA");
            case "beastcaller" -> Set.of("STR","CHA");
            case "voidhunter" -> Set.of("DEX","CON");
            case "summoner" -> Set.of("CON","CHA");
            case "runeblade" -> Set.of("STR","CON");
            default -> Set.of("STR","CON");
        };
    }
    public static final class Character {
        public final String name,speciesId,classId;
        public final Map<String,Integer> base=new LinkedHashMap<>(),ascension=new LinkedHashMap<>(),gearBonuses=new LinkedHashMap<>();
        public int level=1,xp=0,hp=1,maxHp=1,flatHp=0,armorBonus=0,shieldBonus=0,gold=0;
        public Character(String name,String speciesId,String classId,Map<String,Integer> scores){this.name=name;this.speciesId=speciesId;this.classId=classId;this.base.putAll(scores);}
        public boolean grantXp(int amount){if(amount<0)throw new IllegalArgumentException("XP cannot be negative");xp=Math.min(Integer.MAX_VALUE,xp+amount);int next=levelForXp(xp);if(next>level){level=next;Derived d=derive(this);maxHp=d.hpMax();hp=maxHp;return true;}return false;}
    }
}
