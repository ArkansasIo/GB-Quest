'use strict';
// ================================================================ RETRO 8-BIT / AELMOOR HD item icons
// Loaded after the asset-pack and pack-art wrappers so it is the outermost itemIcon: in the retro modes every
// weapon, armour and accessory uses the generated icon for its category and rarity (src/art.js retroItemIcon).
// Named uniques keep their own art; other modes fall straight through to the existing chain.
if (typeof window !== 'undefined' && typeof itemIcon === 'function' && typeof retroItemIcon === 'function') {
  const retroItemIconBase = itemIcon;
  itemIcon = function (it) {
    if (it && !(it.named && IMG['nn_' + it.named])) { const r = retroItemIcon(it); if (r) return r; }
    return retroItemIconBase.apply(this, arguments);
  };
}
