package io.arkansasio.gbquest;

import javax.swing.*;
import java.awt.*;
import java.awt.event.*;
import java.awt.image.BufferedImage;
import java.io.File;
import javax.imageio.ImageIO;

/** Native Swing/AWT renderer; logical world remains tile-based and pixel crisp. */
public final class GamePanel extends JPanel implements ActionListener {
    private static final int SCALE=3, W=640, H=480;
    private final GameState game;
    private final Timer timer=new Timer(16,this);
    private final boolean[] keys=new boolean[512];
    private BufferedImage tileAtlas;
    private int cameraX,cameraY;

    public GamePanel(GameState game) {
        this.game=game;
        setPreferredSize(new Dimension(W*SCALE,H*SCALE));
        setFocusable(true);setBackground(new Color(12,16,24));
        addKeyListener(new KeyAdapter(){@Override public void keyPressed(KeyEvent e){int k=e.getKeyCode();if(k<keys.length)keys[k]=true;
            if(k==KeyEvent.VK_SPACE)game.attack();if(k==KeyEvent.VK_H)game.drinkPotion();if(k==KeyEvent.VK_ESCAPE)System.exit(0);}
            @Override public void keyReleased(KeyEvent e){int k=e.getKeyCode();if(k<keys.length)keys[k]=false;}});
        loadAtlas();timer.start();
    }
    private void loadAtlas(){try{File f=new File("assets_hd64/tiles_0.png");if(f.isFile())tileAtlas=ImageIO.read(f);}catch(Exception ignored){}}
    @Override public void actionPerformed(ActionEvent e){
        double dx=0,dy=0; if(key(KeyEvent.VK_LEFT)||key(KeyEvent.VK_A))dx--;if(key(KeyEvent.VK_RIGHT)||key(KeyEvent.VK_D))dx++;
        if(key(KeyEvent.VK_UP)||key(KeyEvent.VK_W))dy--;if(key(KeyEvent.VK_DOWN)||key(KeyEvent.VK_S))dy++;
        double len=Math.hypot(dx,dy);if(len>0)game.move(dx/len*1.8,dy/len*1.8);
        game.update();cameraX=(int)game.x-W/2;cameraY=(int)game.y-H/2;repaint();
    }
    private boolean key(int k){return k<keys.length&&keys[k];}
    @Override protected void paintComponent(Graphics raw){super.paintComponent(raw);Graphics2D g=(Graphics2D)raw.create();
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION,RenderingHints.VALUE_INTERPOLATION_NEAREST_NEIGHBOR);
        g.scale(SCALE,SCALE);g.setColor(new Color(12,16,24));g.fillRect(0,0,W,H);
        int left=Math.max(0,cameraX/GameState.TILE),top=Math.max(0,cameraY/GameState.TILE);
        int right=Math.min(GameState.WORLD_W,left+W/GameState.TILE+2),bottom=Math.min(GameState.WORLD_H,top+H/GameState.TILE+2);
        for(int ty=top;ty<bottom;ty++)for(int tx=left;tx<right;tx++){
            int sx=tx*GameState.TILE-cameraX,sy=ty*GameState.TILE-cameraY;
            if(game.tiles[ty][tx]==1){g.setColor(new Color(54,58,72));g.fillRect(sx,sy,16,16);g.setColor(new Color(79,86,102));g.drawRect(sx+1,sy+1,13,13);}
            else {g.setColor(((tx+ty)&1)==0?new Color(40,82,57):new Color(36,75,52));g.fillRect(sx,sy,16,16);g.setColor(new Color(46,91,61));g.drawLine(sx+3,sy+11,sx+5,sy+9);}
        }
        for(GameState.Loot l:game.loot)if(!l.taken){int sx=(int)l.x-cameraX,sy=(int)l.y-cameraY;g.setColor(l.kind.equals("gold")?new Color(255,205,64):new Color(220,70,80));g.fillOval(sx,sy,8,8);}
        for(GameState.Enemy e:game.enemies)if(e.alive){int sx=(int)e.x-cameraX,sy=(int)e.y-cameraY;g.setColor(new Color(128,49,54));g.fillRoundRect(sx,sy,13,13,4,4);g.setColor(Color.WHITE);g.drawString(e.name,sx-7,sy-4);g.setColor(new Color(50,20,25));g.fillRect(sx,sy-3,14,2);g.setColor(new Color(230,65,72));g.fillRect(sx,sy-3,14*e.hp/e.maxHp,2);}
        int px=(int)game.x-cameraX,py=(int)game.y-cameraY;g.setColor(game.invulnerability>0&&(game.invulnerability/4)%2==0?Color.WHITE:new Color(85,174,236));g.fillRoundRect(px,py,13,14,4,4);
        if(game.attackTicks>0){g.setColor(new Color(255,232,150));g.drawOval(px+6+game.facingX*13,py+6+game.facingY*13,12,12);}
        drawHud(g);g.dispose();
    }
    private void drawHud(Graphics2D g){
        g.setColor(new Color(10,14,25,225));g.fillRoundRect(8,8,270,47,8,8);
        g.setFont(new Font(Font.MONOSPACED,Font.BOLD,10));g.setColor(Color.WHITE);g.drawString("SHADOWBANE  |  LEVEL "+game.level,16,21);
        g.setColor(new Color(70,25,35));g.fillRect(16,28,120,7);g.setColor(new Color(220,65,75));g.fillRect(16,28,120*game.hp/game.maxHp,7);
        g.setColor(new Color(30,45,75));g.fillRect(16,39,120,5);g.setColor(new Color(65,145,235));g.fillRect(16,39,120*game.mana/game.maxMana,5);
        g.setColor(Color.WHITE);g.drawString("HP "+game.hp+"/"+game.maxHp+"   MP "+game.mana+"/"+game.maxMana,145,35);
        g.drawString("GOLD "+game.gold+"   POTIONS "+game.potions,145,48);
        if(game.messageTicks>0){g.setColor(new Color(8,12,20,220));g.fillRoundRect(8,H-32,W-16,24,6,6);g.setColor(new Color(238,226,194));g.drawString(game.message,16,H-17);}
        g.setColor(new Color(220,220,230));g.drawString("WASD/ARROWS MOVE   SPACE ATTACK   H POTION   ESC QUIT",8,H-5);
    }
}
