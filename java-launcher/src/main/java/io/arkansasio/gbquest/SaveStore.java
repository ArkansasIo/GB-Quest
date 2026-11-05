package io.arkansasio.gbquest;

import java.io.*;
import java.nio.file.*;

/** Versioned local save file for native Java progress. */
public final class SaveStore {
    private SaveStore() {}
    public static void save(GameState s) throws IOException {
        Path file=Path.of("saves","java-edition.properties");Files.createDirectories(file.getParent());
        try(var out=Files.newOutputStream(file)){var p=new java.util.Properties();
            p.setProperty("version","1");p.setProperty("x",Double.toString(s.x));p.setProperty("y",Double.toString(s.y));
            p.setProperty("hp",Integer.toString(s.hp));p.setProperty("level",Integer.toString(s.level));
            p.setProperty("xp",Integer.toString(s.xp));p.setProperty("gold",Integer.toString(s.gold));
            p.setProperty("potions",Integer.toString(s.potions));\n            p.setProperty("species",s.hero.speciesId);p.setProperty("class",s.hero.classId);p.setProperty("heroName",s.hero.name);p.store(out,"GB-Quest native Java save");}
    }
    public static void load(GameState s) throws IOException {
        Path file=Path.of("saves","java-edition.properties");if(!Files.isRegularFile(file))return;
        var p=new java.util.Properties();try(var in=Files.newInputStream(file)){p.load(in);}
        if(!"1".equals(p.getProperty("version")))throw new IOException("Unsupported Java save version");
        s.x=number(p,"x",s.x);s.y=number(p,"y",s.y);s.hp=clamp(integer(p,"hp",s.hp),0,s.maxHp);
        s.level=clamp(integer(p,"level",s.level),1,50);s.xp=Math.max(0,integer(p,"xp",s.xp));
        s.gold=Math.max(0,integer(p,"gold",s.gold));s.potions=Math.max(0,integer(p,"potions",s.potions));\n        s.wallet.gold=s.gold;s.restoreProgress();
    }
    private static double number(java.util.Properties p,String k,double d){try{return Double.parseDouble(p.getProperty(k));}catch(Exception e){return d;}}
    private static int integer(java.util.Properties p,String k,int d){try{return Integer.parseInt(p.getProperty(k));}catch(Exception e){return d;}}
    private static int clamp(int v,int lo,int hi){return Math.max(lo,Math.min(hi,v));}
}
