package io.arkansasio.gbquest;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;

/** Deterministic gameplay state for the native Java edition. */
public final class GameState {
    public static final int WORLD_W = 40, WORLD_H = 30, TILE = 16;
    public final int[][] tiles = new int[WORLD_H][WORLD_W];
    public final List<Enemy> enemies = new ArrayList<>();
    public final List<Loot> loot = new ArrayList<>();
    public final Random random = new Random(7319);
    public final CharacterRules.Character hero = CharacterRules.create("Adventurer", "hearthkin", "warden");
    public final ItemSystem.Inventory inventory = new ItemSystem.Inventory();
    public final ItemSystem.Wallet wallet = new ItemSystem.Wallet(25);
    public final ItemSystem.Vendor vendor = new ItemSystem.Vendor(random, 1);
    public double x = 8 * TILE, y = 8 * TILE;
    public int hp = 42, maxHp = 42, mana = 18, maxMana = 18;
    public int level = 1, xp = 0, gold = 25, potions = 3;
    public int strength = 12, dexterity = 11, vitality = 13, intelligence = 10;
    public int attack = 6, defense = 3;
    public int facingX = 0, facingY = 1;
    public int attackTicks = 0, invulnerability = 0;
    public String message = "Explore the ruins. WASD/arrows move; SPACE attacks; H drinks a potion.";
    public int messageTicks = 420;
    private long nextEnemyId = 1;

    public GameState() {
        generateWorld();
        inventory.add(ItemSystem.generate("rusted_sword", ItemSystem.Rarity.COMMON, 1, random));
        inventory.add(ItemSystem.generate("padded_vest", ItemSystem.Rarity.COMMON, 1, random));
        inventory.equip(0); inventory.equip(0);
        syncHeroStats();
        spawnEnemy(16, 10, "Ash Wolf", 22, 4, 8);
        spawnEnemy(25, 17, "Grave Raider", 30, 5, 12);
        spawnEnemy(11, 22, "Cave Stalker", 18, 3, 7);
        loot.add(new Loot(10 * TILE, 8 * TILE, 12, "gold"));
        loot.add(new Loot(20 * TILE, 12 * TILE, 1, "potion"));
    }

    private void generateWorld() {
        for (int ty=0; ty<WORLD_H; ty++) for (int tx=0; tx<WORLD_W; tx++) {
            boolean edge = tx==0 || ty==0 || tx==WORLD_W-1 || ty==WORLD_H-1;
            tiles[ty][tx] = edge ? 1 : 0;
            if (!edge && (random.nextDouble() < 0.045) && !(tx<12 && ty<12)) tiles[ty][tx]=1;
        }
        // Keep the starting clearing and a path through the centre open.
        for (int ty=4; ty<13; ty++) for (int tx=4; tx<14; tx++) tiles[ty][tx]=0;
        for (int tx=8; tx<31; tx++) tiles[15][tx]=0;
    }

    public void spawnEnemy(int tx,int ty,String name,int hp,int damage,int xp) {
        enemies.add(new Enemy(nextEnemyId++, tx*TILE+4, ty*TILE+4, name, hp, damage, xp));
    }
    public boolean blocked(double px,double py) {
        int tx=(int)Math.floor(px/TILE), ty=(int)Math.floor(py/TILE);
        return tx<0 || ty<0 || tx>=WORLD_W || ty>=WORLD_H || tiles[ty][tx]==1;
    }
    public void move(double dx,double dy) {
        if (dx!=0 || dy!=0) { facingX=dx==0?0:(dx>0?1:-1); facingY=dy==0?0:(dy>0?1:-1); }
        double nx=x+dx, ny=y+dy;
        if (!blocked(nx+5,y+5) && !blocked(nx+10,y+10)) x=nx;
        if (!blocked(x+5,ny+5) && !blocked(x+10,ny+10)) y=ny;
    }
    public void attack() {
        if (attackTicks>0) return;
        attackTicks=14;
        int cx=(int)(x+8+facingX*20), cy=(int)(y+8+facingY*20);
        Enemy target=null; double best=30*30;
        for (Enemy e:enemies) if(e.alive) {
            double dx=e.x+6-cx,dy=e.y+6-cy,d=dx*dx+dy*dy;
            if(d<best){best=d;target=e;}
        }
        if(target!=null) {
            int damage=attack+CharacterRules.modifier(hero.base.getOrDefault("STR",10))/2+random.nextInt(4);
            target.hp-=damage;
            if(target.hp<=0){target.alive=false;xp+=target.xp;gold+=target.xp/2;wallet.gold=gold;boolean leveled=hero.grantXp(target.xp);level=hero.level;xp=hero.xp;syncHeroStats();message=target.name+" defeated! +"+target.xp+" XP"+(leveled?" — LEVEL UP!":"");messageTicks=150;}
            else {message="Hit "+target.name+" for "+damage;messageTicks=70;}
        } else { message="Your strike cuts through the air.";messageTicks=45; }
    }
    public void drinkPotion() {
        if(potions<=0){message="No healing potions.";messageTicks=90;return;}
        if(hp>=maxHp){message="Health is already full.";messageTicks=90;return;}
        potions--; int healed=Math.min(20,maxHp-hp);hp+=healed;message="Potion restored "+healed+" HP.";messageTicks=100;
    }
    public void update() {
        if(attackTicks>0)attackTicks--; if(invulnerability>0)invulnerability--;
        if(messageTicks>0)messageTicks--;
        for(Enemy e:enemies) if(e.alive) {
            double dx=x-e.x,dy=y-e.y,d=Math.hypot(dx,dy);
            if(d<150 && d>13) { double speed=0.48; double nx=e.x+dx/d*speed,ny=e.y+dy/d*speed;
                if(!blocked(nx+6,e.y+6))e.x=nx;if(!blocked(e.x+6,ny+6))e.y=ny; }
            if(d<17 && invulnerability==0){hp=Math.max(0,hp-e.damage);invulnerability=45;message=e.name+" hit you for "+e.damage+".";messageTicks=90;}
        }
        for(Loot l:loot) if(!l.taken && Math.hypot(x-l.x,y-l.y)<19) {
            l.taken=true;if(l.kind.equals("gold")){gold+=l.amount;wallet.gold=gold;message="Found "+l.amount+" gold.";}
            else {potions+=l.amount;message="Found a healing potion.";}messageTicks=100;
        }
    }
    public void restoreProgress(){hero.level=Math.max(1,Math.min(CharacterRules.MAX_LEVEL,level));hero.xp=Math.max(0,xp);syncHeroStats();hp=Math.max(0,Math.min(maxHp,hp));hero.hp=hp;}\n    public void refreshDerivedStats(){syncHeroStats();}\n    private void syncHeroStats(){inventory.applyTo(hero);gold=wallet.gold;CharacterRules.Derived d=CharacterRules.derive(hero);maxHp=d.hpMax();hp=Math.min(hp,maxHp);attack=4+d.proficiency()+d.modifiers().get("STR")+inventory.totalStats().getOrDefault("DMG",0);defense=d.armorClass();hero.hp=hp;hero.maxHp=maxHp;hero.level=level;hero.xp=xp;}
    public static final class Enemy {
        public final long id; public double x,y; public final String name; public int hp; public final int maxHp,damage,xp; public boolean alive=true;
        Enemy(long id,double x,double y,String name,int hp,int damage,int xp){this.id=id;this.x=x;this.y=y;this.name=name;this.hp=hp;this.maxHp=hp;this.damage=damage;this.xp=xp;}
    }
    public static final class Loot {
        public final double x,y;public final int amount;public final String kind;public boolean taken;
        Loot(double x,double y,int amount,String kind){this.x=x;this.y=y;this.amount=amount;this.kind=kind;}
    }
}
