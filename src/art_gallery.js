'use strict';
// Master catalog sheet supplied for the GB-Quest visual refresh.
const GBQ_ART_GALLERY = [{ id: 'gbq_master_catalog', title: 'DARK FANTASY MASTER ASSET CATALOG' }];
class ArtGalleryScene {
  constructor() { this.opaque = true; this.page = 0; }
  update() { if (P('b') || P('start')) { SFX.close(); removeScene(this); return; } }
  draw() {
    fill(0, 0, W, H, 0); hdr();
    const img = IMG.gbq_master_catalog;
    text('MASTER ART CATALOG', 4, 14, 'gold');
    frame(2, 23, W - 4, 104);
    if (img) {
      const scale = Math.min((W - 10) / img.width, 96 / img.height);
      const dw = Math.max(1, Math.floor(img.width * scale)), dh = Math.max(1, Math.floor(img.height * scale));
      const old = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, Math.floor((W - dw) / 2), 27 + Math.floor((96 - dh) / 2), dw, dh);
      ctx.imageSmoothingEnabled = old;
    } else textC('MASTER ART NOT INSTALLED', W / 2, 70, 'gold');
    textC('DARK STONE / BRASS / FOREST GREEN UI', W / 2, 138, 2);
  }
}
