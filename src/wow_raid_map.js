/* World-of-Warcraft-style raid and dungeon atlas for GB-Quest.
 * Uses authored floorplan nodes from GBQWowRaidCatalog and the existing gamepad scene API.
 */
class WowRaidMapScene extends ListScene {
  constructor() { super(7); this.category=1; this.wing=0; this.dossier=0; }
  items() { return this.category===1 ? GBQWowRaidCatalog.raids : GBQWowRaidCatalog.dungeons; }
  current() { return this.items()[this.i] || this.items()[0] || null; }
  currentWing() {
    const wings=this.current()?.map?.wings||[];
    this.wing=Math.max(0,Math.min(this.wing,wings.length-1));
    return wings[this.wing]||null;
  }
  encounters() { return this.current()?.encounters||[]; }
  update() {
    if(P('b')) { SFX.back(); removeScene(this); return; }
    if(P('select')) { this.category^=1; this.i=this.top=this.wing=this.dossier=0; SFX.page(); return; }
    this.navList();
    if(nav('left')||nav('right')) {
      const count=this.current()?.map?.wings?.length||1;
      this.wing=(this.wing+(nav('right')?1:count-1))%count;
      this.dossier=0; SFX.cursor(); return;
    }
    if(P('start')) { const n=this.encounters().length; if(n){this.dossier=(this.dossier+1)%n;SFX.cursor();} return; }
    if(P('a')) {
      const entry=this.current(); if(!entry)return;
      const kind=this.category===1?'raid':'dungeon';
      if(typeof instanceMenu==='function') instanceMenu(kind,{...entry,activityKind:kind});
      else say('INSTANCE ENTRY IS NOT AVAILABLE FROM THIS SCREEN.');
      SFX.select();
    }
  }
  draw() {
    drawMenuBackdrop(); hdr();
    drawOrnatePanel(2,12,156,130,'INSTANCE ATLAS');
    const entry=this.current(), wing=this.currentWing(), encounters=this.encounters();
    textC(this.category===1?'RAID ROUTES':'DUNGEON ROUTES',80,14,'#ffe3a0');
    fill(5,23,43,101,'rgba(5,8,20,.92)');
    fill(51,23,104,72,'rgba(5,8,20,.92)');
    fill(51,98,104,40,'rgba(5,8,20,.92)');
    const list=this.items();
    list.slice(this.top,this.top+7).forEach((item,j)=>{
      const index=this.top+j,y=27+j*13,selected=index===this.i;
      if(selected)fill(6,y-1,41,11,'rgba(157,91,33,.58)');
      text((item.name||'INSTANCE').slice(0,7),8,y,selected?'#ffe3a0':'#d8d0e4');
      textR('L'+item.lvl,47,y,selected?'#ffe3a0':'#9f9ab2');
    });
    text(this.category===1?'RAIDS':'DUNGEONS',8,118,'#c9a65a');
    if(!entry||!wing){textC('NO MAP DATA',103,54,2);return;}
    text(wing.name.slice(0,18),55,25,'#ffe3a0');
    const nodes=wing.nodes||[];
    const px=n=>56+n[1]*0.93, py=n=>31+(100-n[2])*0.54;
    // Dungeon corridors and raid wing routes.
    if(typeof ctx!=='undefined'){
      ctx.save();ctx.strokeStyle='rgba(172,147,198,.78)';ctx.lineWidth=1.4;ctx.beginPath();
      nodes.forEach((n,i)=>{if(i===0)ctx.moveTo(px(n),py(n));else ctx.lineTo(px(n),py(n));});ctx.stroke();
      // Mob packs are smaller amber diamond markers; boss skulls are larger crimson pins.
      for(const mob of wing.mobNodes||entry.mobNodes||[]){
        const x=56+mob.x*.93,y=31+(100-mob.y)*.54;
        ctx.fillStyle='#d69b42';ctx.beginPath();ctx.moveTo(x,y-2);ctx.lineTo(x+2,y);ctx.lineTo(x,y+2);ctx.lineTo(x-2,y);ctx.closePath();ctx.fill();
      }
      nodes.forEach((n,i)=>{
        const x=px(n),y=py(n),boss=encounters.some(b=>b.name===n[0]);
        ctx.fillStyle=boss?'#d65c66':'#c5b7d9';
        ctx.beginPath();ctx.arc(x,y,boss?3.1:2,0,Math.PI*2);ctx.fill();
        if(boss){ctx.strokeStyle='#ffe3a0';ctx.lineWidth=0.8;ctx.stroke();}
        if(i===0){ctx.fillStyle='#63d6ed';ctx.fillRect(x-2,y-2,4,4);}
      });
      ctx.restore();
    }
    text('P: ENTRANCE',55,88,'#63d6ed');
    text('B: BACK  SEL: TYPE',55,93,1);
    const boss=encounters[this.dossier%Math.max(1,encounters.length)];
    if(boss){
      text((boss.name||'BOSS').slice(0,23),55,101,'#ffe3a0');
      const lines=wrap(boss.mechanic||'Defeat the guardian.',28);
      text(lines.slice(0,2).join('\n'),55,111,2);
      text('LOOT: '+String((boss.loot||[])[0]||'RAID CACHE').slice(0,22),55,128,'#c9a65a');
    }else text('NO ENCOUNTERS',55,112,2);
    textC('A: ENTER INSTANCE   START: BOSS DOSSIER',80,138,1);
  }
}
