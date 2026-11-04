'use strict';
// CLASS + RACE UI IDENTITY LAYER. Additive presentation only; no gameplay or input changes.
const GBQ_CLASS_ACCENTS = Object.freeze({
  warden:[92,154,218],berserker:[205,67,54],vanguard:[205,164,72],strider:[67,174,154],shade:[139,104,190],ascetic:[106,177,132],arcanist:[105,132,222],wildblood:[115,165,77],pactbound:[160,91,184],cantor:[82,176,196],chaplain:[218,190,112],verdant:[93,159,93],guard:[145,157,172],merchant:[185,127,75],elder:[178,158,128],sage:[119,142,190],ronin:[190,70,62],shinobi:[113,91,157],bladedancer:[202,113,164],wyrmlancer:[184,115,69],corsair:[67,143,176],beastcaller:[119,151,82],puppeteer:[165,146,116],dreadknight:[137,55,65],voidhunter:[116,100,177],scalesage:[72,163,145],stormcaller:[82,137,202]
});
const GBQ_RACE_ACCENTS = Object.freeze({
  hearthkin:[194,164,105],thornelf:[105,165,112],stonekin:[142,132,119],wispling:[206,178,105],emberborn:[204,91,55],burrowkin:[153,137,103],twinblood:[161,117,173],tuskborn:[166,104,79],drakkin:[186,91,63],hornfolk:[165,126,87],felinar:[190,157,100],pipkin:[128,161,205],lunari:[133,139,205],wolfkin:[142,151,164],starkin:[218,204,151]
});
const GBQ_ROLE_ACCENTS = Object.freeze({tank:[91,139,183],dps:[190,91,69],healer:[105,165,126]});
const GBQ_UI_RGB = rgb => typeof css === 'function' ? css(rgb) : '#9b7a45';
const GBQ_UI_IDENTITY = () => {
  let c = typeof G !== 'undefined' && G ? G : null;
  if (!c && typeof scenes !== 'undefined' && scenes.length) for (let i=scenes.length-1;i>=0;i--) { if (scenes[i] && scenes[i].pick) { c=scenes[i].pick; break; } }
  const cls = c && c.cls && typeof CLASSES !== 'undefined' ? CLASSES[c.cls] : null;
  const race = c && c.species && typeof SPECIES !== 'undefined' ? SPECIES[c.species] : null;
  return {cls:c&&c.cls||'',species:c&&c.species||'',className:cls&&cls.name||(c&&c.cls||'ADVENTURER').toUpperCase(),raceName:race&&race.name||(c&&c.species||'UNKNOWN').toUpperCase(),primary:c&&GBQ_CLASS_ACCENTS[c.cls]||cls&&GBQ_ROLE_ACCENTS[cls.role]||[125,145,174],secondary:c&&GBQ_RACE_ACCENTS[c.species]||[174,153,111]};
};
const GBQ_UI_API = Object.freeze({classes:GBQ_CLASS_ACCENTS,races:GBQ_RACE_ACCENTS,identity:GBQ_UI_IDENTITY,accent:()=>GBQ_UI_IDENTITY().primary,heritage:()=>GBQ_UI_IDENTITY().secondary});
if (typeof globalThis !== 'undefined') globalThis.GBQClassRaceUI = GBQ_UI_API;
if (typeof window !== 'undefined' && typeof frame === 'function') {
  const baseFrame = frame;
  frame = function(x,y,w,h,bg=0) {
    baseFrame(x,y,w,h,bg);
    if(w<10||h<6||(typeof MONO==='function'&&MONO(S.palette))) return;
    const id=GBQ_UI_IDENTITY();
    fill(x+2,y+1,Math.max(1,w-4),1,GBQ_UI_RGB(id.primary));
    if(h>8) fill(x+2,y+h-2,Math.max(1,w-4),1,GBQ_UI_RGB(id.secondary));
    fill(x+1,y+1,1,1,GBQ_UI_RGB(id.secondary)); fill(x+w-2,y+1,1,1,GBQ_UI_RGB(id.secondary));
  };
  if(typeof hdr==='function') {
    const baseHeader=hdr;
    hdr=function(){
      baseHeader.apply(this,arguments);
      if(typeof G==='undefined'||!G||(typeof MONO==='function'&&MONO(S.palette))) return;
      const id=GBQ_UI_IDENTITY();
      fill(88,2,2,7,GBQ_UI_RGB(id.primary)); fill(91,2,2,7,GBQ_UI_RGB(id.secondary));
      text((id.cls.slice(0,3)+'/'+id.species.slice(0,3)).toUpperCase(),95,2,3);
    };
  }
  if(typeof CharCreate!=='undefined') {
    const baseCreateDraw=CharCreate.prototype.draw;
    CharCreate.prototype.draw=function(){
      baseCreateDraw.apply(this,arguments);
      if(typeof MONO==='function'&&MONO(S.palette)) return;
      const id=GBQ_UI_IDENTITY();
      fill(4,22,152,1,GBQ_UI_RGB(id.primary)); fill(4,23,152,1,GBQ_UI_RGB(id.secondary));
      text((id.className+' / '+id.raceName).slice(0,25),5,127,3);
    };
  }
  if(typeof MainMenu!=='undefined') {
    const baseMenuDraw=MainMenu.prototype.draw;
    MainMenu.prototype.draw=function(){
      baseMenuDraw.apply(this,arguments);
      if(typeof G==='undefined'||!G||(typeof MONO==='function'&&MONO(S.palette))) return;
      const id=GBQ_UI_IDENTITY();
      fill(4,13,50,2,GBQ_UI_RGB(id.primary)); fill(4,15,50,1,GBQ_UI_RGB(id.secondary));
    };
  }
}
