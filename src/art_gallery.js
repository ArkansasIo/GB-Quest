'use strict';
// GB-Quest generated 8-bit art reference gallery.
// The three large reference boards are loaded through the normal assets/ PNG index.
const GBQ_ART_GALLERY = [
  { id: 'gbq_asset_sheet_01', title: 'WORLD / CHARACTERS / ITEMS' },
  { id: 'gbq_asset_sheet_02', title: 'CLASSES / ANIMATIONS / UI' },
  { id: 'gbq_asset_sheet_03', title: 'FULL 8-BIT ASSET COLLECTION' },
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
    text('8-BIT ART GALLERY', 4, 14, 'gold');
    textR(`${this.page + 1}/${GBQ_ART_GALLERY.length}`, W - 4, 14, 2);
    frame(2, 23, W - 4, 104);
    if (img) {
      const pad = 3, maxW = W - 10, maxH = 96;
      const scale = Math.min(maxW / img.width, maxH / img.height);
      const dw = Math.max(1, Math.floor(img.width * scale)), dh = Math.max(1, Math.floor(img.height * scale));
      const old = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, Math.floor((W - dw) / 2), 27 + Math.floor((96 - dh) / 2), dw, dh);
      ctx.imageSmoothingEnabled = old;
    } else {
      textC('ART SHEET NOT INSTALLED', W / 2, 63, 'gold');
      textC(entry.id + '.png', W / 2, 76, 2);
    }
    textC(entry.title, W / 2, 132, 3);
    textC('LEFT / RIGHT: CHANGE SHEET', W / 2, 141, 2);
  }
}
