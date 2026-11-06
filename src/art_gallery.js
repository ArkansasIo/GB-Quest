'use strict';
const GBQ_ART_GALLERY = [
  { id: 'gbq_master_catalog', title: 'DARK FANTASY MASTER ASSET CATALOG' },
  { id: 'gbq_ui_mockup_catalog', title: 'NEW UI / SPRITESHEET MOCKUP COLLECTION' }
];
class ArtGalleryScene {
  constructor() { this.opaque = true; this.page = 0; }
  update() {
    if (P('b') || P('start')) { SFX.close(); removeScene(this); return; }
    if (P('left') || P('up')) { this.page = (this.page + GBQ_ART_GALLERY.length - 1) % GBQ_ART_GALLERY.length; SFX.cursor(); }
    if (P('right') || P('down') || P('a')) { this.page = (this.page + 1) % GBQ_ART_GALLERY.length; SFX.cursor(); }
  }
  draw() {
    fill(0, 0, W, H, 0); hdr();
    const entry = GBQ_ART_GALLERY[this.page], img = IMG[entry.id];
    text('MASTER ART CATALOG', 4, 14, 'gold');
    textR((this.page + 1) + '/' + GBQ_ART_GALLERY.length, W - 4, 14, 2);
    frame(2, 23, W - 4, 104);
    if (img) {
      const scale = Math.min((W - 10) / img.width, 96 / img.height);
      const dw = Math.max(1, Math.floor(img.width * scale)), dh = Math.max(1, Math.floor(img.height * scale));
      const old = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, Math.floor((W - dw) / 2), 27 + Math.floor((96 - dh) / 2), dw, dh);
      ctx.imageSmoothingEnabled = old;
    } else textC('MASTER ART NOT INSTALLED', W / 2, 70, 'gold');
    textC(entry.title, W / 2, 138, 2);
    textC('LEFT / RIGHT: CHANGE SHEET', W / 2, 143, 1);
  }
}
