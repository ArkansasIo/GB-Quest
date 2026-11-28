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
    // Use warm stone and parchment instead of the previous blue-black map well.
    fill(5,23,43,101,'#17130f');
    fill(51,23,104,72,'#211b13');
    fill(51,98,104,40,'#17130f');
    ctx.save();
    ctx.fillStyle='#302719';ctx.fillRect(53,29,100,59);
    ctx.strokeStyle='#9b7844';ctx.lineWidth=1;ctx.strokeRect(53.5,29.5,99,58);
    ctx.strokeStyle='rgba(210,177,119,.22)';ctx.lineWidth=.45;
    for(let gx=58;gx<153;gx+=10){ctx.beginPath();ctx.moveTo(gx,30);ctx.lineTo(gx,87);ctx.stroke();}
    for(let gy=35;gy<88;gy+=10){ctx.beginPath();ctx.moveTo(54,gy);ctx.lineTo(152,gy);ctx.stroke();}
    ctx.restore();
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
    // High-contrast route: bright stone corridors, distinct room nodes and non-blue markers.
    if(typeof ctx!=='undefined'){
      ctx.save();
      ctx.lineCap='round';ctx.lineJoin='round';
      ctx.shadowColor='rgba(0,0,0,.9)';ctx.shadowBlur=2;
      ctx.strokeStyle='#e2c58d';ctx.lineWidth=3.2;ctx.beginPath();
      nodes.forEach((n,i)=>{if(i===0)ctx.moveTo(px(n),py(n));else ctx.lineTo(px(n),py(n));});ctx.stroke();
      ctx.shadowBlur=0;
      // Mob packs are amber diamonds; bosses are large red seals; entrance is green.
      for(const mob of wing.mobNodes||entry.mobNodes||[]){
        const x=56+mob.x*.93,y=31+(100-mob.y)*.54;
        ctx.fillStyle='#ffb83f';ctx.strokeStyle='#24190c';ctx.lineWidth=.8;
        ctx.beginPath();ctx.moveTo(x,y-2.8);ctx.lineTo(x+2.8,y);ctx.lineTo(x,y+2.8);ctx.lineTo(x-2.8,y);ctx.closePath();ctx.fill();ctx.stroke();
      }
      nodes.forEach((n,i)=>{
        const x=px(n),y=py(n),boss=encounters.some(b=>b.name===n[0]);
        ctx.fillStyle=boss?'#ef5148':'#f2e6c9';
        ctx.strokeStyle=boss?'#fff0c4':'#59432a';ctx.lineWidth=1.2;
        ctx.beginPath();ctx.arc(x,y,boss?4.1:3.1,0,Math.PI*2);ctx.fill();ctx.stroke();
        if(boss){ctx.fillStyle='#fff0c4';ctx.font='bold 5px monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('B',x,y+.2);}
        if(i===0){ctx.fillStyle='#65d36e';ctx.fillRect(x-2.5,y-2.5,5,5);ctx.strokeStyle='#17351c';ctx.strokeRect(x-2.5,y-2.5,5,5);}
      });
      ctx.restore();
    }
    text('■ ENTRY  ● BOSS  ◆ MOBS',55,89,'#e8d3a8');
    text('B: BACK  SEL: TYPE',55,95,'#d8c49e');
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
