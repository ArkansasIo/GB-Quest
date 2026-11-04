# Weapon skill, mastery and the circle board

A Throne-and-Liberty-style weapon progression for all 15 weapon families (including the new totems). Open it in game from **MAIN MENU > MASTERY**. The code is in `src/weapon_mastery.js`, and the tests are in `tests/weapon_mastery.test.js`.

## The two tracks

| Track | Range | How it rises | What it does |
|---|---|---|---|
| **Weapon skill** | 1–720 | XP from every won battle with that family equipped (20 + 2 × foe level per foe; elites ×3, bosses ×6) | Unlocks the family's six weapon arts at 1 / 120 / 240 / 360 / 480 / 600, and sets the mastery cap (skill ÷ 3.6) |
| **Mastery** | 1–200 | Its own XP from the same wins (6 + foe level per foe; elites ×5, bosses ×20) | One circle-board point per level; opens a branch and its trait at 1 / 40 / 80 / 120 / 160 / 200 |

Mastery cannot pass the cap that weapon skill allows, so skill 720 is needed for mastery 200. XP earned while capped is banked, up to one level's worth, and pays out when the cap rises. Your class weapon family earns **+25%** of both kinds of XP.

The old 1–30 mastery from `tnl_systems.js` is retired in game. On first use, each old level converts to starting weapon skill (level 30 becomes skill 233). Mastery starts again at 1.

## Circle board

Each family has its own radial board. A free hub sits in the centre, with six branches around it, one for each trait. Each branch has four rings:

| Ring | Nodes | Ranks | Cost per rank | Branch points needed | Strength |
|---|---|---|---|---|---|
| Inner | 4 stat nodes | 5 | 1 | 0 | ×1 |
| Middle | 3 stat nodes | 5 | 1 | 6 | ×1.6 |
| Deep | 2 stat nodes | 3 | 2 | 14 | ×2.4 |
| Capstone | 1 | 1 | 5 | 24 | Upgrades one of the weapon's arts (more hits, a rider, shorter cooldown, area, more dice…) |

A branch costs 52 points and the full board 312, so 200 points fill about 3.8 branches and every build has to choose. Respecs are free while 10 or fewer points are spent. After that, they cost the points spent × max(5, ½ hero level) in gold.

Board controls: **LEFT/RIGHT** changes branch, **UP/DOWN** moves along it, **A** spends a point, **SELECT** shows the branch's trait and capstone, and **B** goes back.

Board stats, traits and capstones only apply while a weapon of that family is in hand. Weapon arts are equipped in **MENU > COMBAT ARTS** with the other arts, in the same four slots. Switching to another weapon family unequips them.

## Traits

Each branch carries one mastery trait, so each weapon has six. A trait switches on when its branch opens, and it grows with mastery level until it reaches full value at mastery 200.

## Class weapons

| Class | Weapon family | Signature weapon | Signature art (weapon skill 300) |
|---|---|---|---|
| WARDEN | SWORD | OATHBRAND | **OATHBOUND STRIKE**: A sworn blow that FORTIFIES you. |
| BERSERKER | AXE | BLOODREAVER | **RAMPAGE**: Two wild swings at every foe. |
| VANGUARD | HAMMER | BULWARK MAUL | **AEGIS SLAM**: Every foe PRONE; you gain a BARRIER. |
| STRIDER | BOW | WINDSTRING | **HUNTER'S VOLLEY**: Two arrows into every foe: SLOWED. |
| SHADE | DAGGER | NIGHTFANG | **UMBRAL ASSASSINATE**: WEAKENED; doubled below half health. |
| ASCETIC | FIST | STILLWATER WRAPS | **HUNDRED PALMS**: Six palms that can STUN. |
| ARCANIST | STAFF | STARWEAVE STAFF | **ARCANE CATACLYSM**: DEX save, half: every foe VULNERABLE. |
| WILDBLOOD | THROWN | CINDERSHARDS | **WILDFIRE BARRAGE**: DEX save, half: every foe BURNING. |
| PACTBOUND | WAND | PACTWAND | **ELDRITCH COLLAPSE**: Spell attack: DOOMED, heal 30%. |
| CANTOR | CROSSBOW | SONGBOLT | **CRESCENDO BOLT**: WIS save: BANED; the party heals. |
| CHAPLAIN | MACE | SANCTUS | **BENEDICTION**: CON save, half: holy light; the party heals. |
| VERDANT | STAFF | ELDERBRANCH | **GROVE'S EMBRACE**: CON save, half: thorns SLOW foes, the party heals. |
| NECROMANCER | SCYTHE | GRAVEHARVEST | **REAP SOULS**: CON save, half: drain 40% from every foe. |
| SUMMONER | GRIMOIRE | CODEX OF CALLING | **LEGION INVOCATION**: Spell attack on every foe: VULNERABLE; the party heals. |
| SUNWARDEN | POLEARM | DAWNSPEAR | **SOLAR PIKE**: BURNING foe; you are BLESSED. |
| RUNEBLADE | SWORD | RUNEBRAND | **RUNIC SEVER**: A rune-cut that DOOMS the foe. |
| RONIN | SWORD | MOONLIT KATANA | **IAIJUTSU**: One perfect draw-cut; doubled below half health. |
| SHINOBI | THROWN | SHADOW SHURIKEN | **SHURIKEN STORM**: Three stars into every foe: BLEEDING. |
| BLADEDANCER | FIST | RIBBON WRAPS | **BLADE WALTZ**: DEX save, half: foes SLOWED; the party heals. |
| WYRMLANCER | POLEARM | WYVERNFANG LANCE | **SKYFALL DIVE**: Dive from the sky: every foe PRONE. |
| CORSAIR | CROSSBOW | PHANTOM FLINTLOCK | **BROADSIDE**: DEX save, half: every foe BURNING. |
| BEASTCALLER | AXE | WILDHEART HATCHET | **PACK HUNT**: Three strikes with the pack: BLEEDING. |
| PUPPETEER | HAMMER | GEARWORK MAUL | **PISTON SLAM**: Can STUN; you gain a BARRIER. |
| DREADKNIGHT | SCYTHE | DREADREAPER | **GRAVE GRIP**: Spell attack: SLOWED, heal 50%. |
| VOIDHUNTER | DAGGER | VOID WARGLAIVES | **EYE OF THE VOID**: DEX save, half: every foe VULNERABLE. |
| SCALESAGE | GRIMOIRE | DRAGONSCALE CODEX | **DRAGON BREATH**: DEX save, half: BURNING foes; the party heals. |
| STORMCALLER | TOTEM | THUNDERHEAD TOTEM | **STORM TOTEM**: DEX save, half: foes SHOCKED; the party heals. |

## Weapon families

Each family lists its six weapon arts (weapon skill needed), then its six branches in board order (mastery needed), with the branch trait at mastery 200 and the capstone.

### SWORD

Balanced steel: accuracy, crits and a guard.

**Arts:** SWORD STRIKE (1), LACERATE (120), GUARD BREAK (240), BLADE FLURRY (360), VALIANT ARC (480), SOVEREIGN CUT (600).

| # | Branch (mastery) | Trait at 200 | Capstone |
|---|---|---|---|
| 1 | EDGE (1) | BLADE DISCIPLINE: Accuracy +4, Crit chance +5 | RIPOSTE MASTER: SWORD STRIKE hits twice. |
| 2 | PARRY (40) | GUARDED STANCE: Block +6, Armour +2 | PERFECT GUARD: GUARD BREAK also FORTIFIES you. |
| 3 | WOUND (80) | OPEN WOUNDS: Crit damage +35, Lifesteal +2 | HEMORRHAGE: LACERATE: +1 die and 1 round less cooldown. |
| 4 | MOMENTUM (120) | BLADE FLOW: Haste +10, Dodge +3 | BLADE DANCE: BLADE FLURRY strikes four times. |
| 5 | VALOR (160) | KNIGHTLY VALOR: Max hp +450, Resist all +5 | RALLYING STEEL: VALIANT ARC BLESSES you. |
| 6 | SOVEREIGN (200) | SOVEREIGN BLADE: Damage +30, Crit damage +20 | KINGSLAYER: SOVEREIGN CUT: +2 dice and can STUN. |

### AXE

Brutal chops: crit damage, bleeding and fury.

**Arts:** HEW (1), GASH (120), SPLITTING BLOW (240), DOUBLE CHOP (360), CLEAVING STORM (480), EXECUTIONER (600).

| # | Branch (mastery) | Trait at 200 | Capstone |
|---|---|---|---|
| 1 | GORE (1) | BUTCHER'S EYE: Crit damage +35, Lifesteal +2 | ARTERIAL CHOP: HEW leaves the foe BLEEDING. |
| 2 | HEADSMAN (40) | HEADSMAN'S WEIGHT: Damage +30, Crit damage +20 | BEHEAD: EXECUTIONER: +2 dice. |
| 3 | FRENZY (80) | BLOOD RUSH: Haste +10, Dodge +3 | WHIRLING AXES: DOUBLE CHOP hits every foe. |
| 4 | HIDE (120) | THICK HIDE: Max hp +450, Resist all +5 | UNBOWED: SPLITTING BLOW FORTIFIES you. |
| 5 | REAVER (160) | REAVER'S THIRST: Lifesteal +4, Shadow dmg +30 | BLOODLETTING: GASH: +1 die, 1 round less cooldown. |
| 6 | WOODSMAN (200) | WOODSMAN'S AIM: Accuracy +4, Crit chance +5 | TIMBER: CLEAVING STORM knocks foes PRONE. |

### MACE

Holy crushing weight: damage, armour and radiance.

**Arts:** SMASH (1), BLESSED BLOW (120), ARMOUR CRACKER (240), PUMMEL (360), HALLOWED RING (480), JUDGEMENT HAMMER (600).

| # | Branch (mastery) | Trait at 200 | Capstone |
|---|---|---|---|
| 1 | CRUSH (1) | CRUSHING WEIGHT: Damage +30, Crit damage +20 | BONEBREAKER: SMASH can STUN. |
| 2 | SANCTUM (40) | HOLY ORDER: Holy dmg +40, Crit chance +2 | CONSECRATE: HALLOWED RING also heals the party. |
| 3 | BULWARK (80) | IRON FAITH: Block +6, Armour +2 | SHIELD OF FAITH: ARMOUR CRACKER raises a BARRIER. |
| 4 | MERCY (120) | MERCIFUL HAND: Healing +35, Max hp +200 | LAYING ON: BLESSED BLOW also heals the party. |
| 5 | PENANCE (160) | PENITENT SPIKES: Thorns +300, Armour +2 | HAIR SHIRT: PUMMEL strikes three times. |
| 6 | PILGRIM (200) | PILGRIM'S ROAD: Max hp +450, Resist all +5 | UNBREAKABLE: JUDGEMENT HAMMER: +2 dice. |

### HAMMER

Huge swings: damage, crit damage and knockdowns.

**Arts:** HAMMER BLOW (1), THUNDERCLAP (120), BULWARK SLAM (240), TREMOR (360), GROUND POUND (480), COLOSSUS (600).

| # | Branch (mastery) | Trait at 200 | Capstone |
|---|---|---|---|
| 1 | MIGHT (1) | TITAN'S GRIP: Damage +30, Crit damage +20 | EARTHQUAKE: GROUND POUND: +2 dice. |
| 2 | ANVIL (40) | ANVIL STANCE: Block +6, Armour +2 | IRON WALL: BULWARK SLAM raises a BARRIER. |
| 3 | FORGE (80) | FORGE SPARKS: Thorns +300, Armour +2 | MOLTEN CORE: HAMMER BLOW sets the foe BURNING. |
| 4 | THUNDER (120) | THUNDERHEAD: Shock dmg +40, Crit chance +2 | STORM HAMMER: THUNDERCLAP hits every foe and SHOCKS. |
| 5 | STONE (160) | STONE BODY: Max hp +450, Resist all +5 | MOUNTAIN: TREMOR FORTIFIES you. |
| 6 | CRATER (200) | CRATER MAKER: Accuracy +4, Crit chance +5 | WORLDBREAKER: COLOSSUS can STUN. |

### DAGGER

Quick and deadly: crits, poison and evasion.

**Arts:** STAB (1), TWIN CUT (120), POISON DART (240), SMOKE STRIKE (360), FAN OF KNIVES (480), ASSASSINATE (600).

| # | Branch (mastery) | Trait at 200 | Capstone |
|---|---|---|---|
| 1 | VITALS (1) | KILLER'S EYE: Accuracy +4, Crit chance +5 | HEARTSEEKER: STAB: +2 dice. |
| 2 | SERRATE (40) | SERRATED EDGE: Crit damage +35, Lifesteal +2 | SLASHED TENDONS: TWIN CUT strikes three times and SLOWS. |
| 3 | SHADOWSTEP (80) | SHADOW STEP: Dodge +6, Crit chance +3 | VANISH: SMOKE STRIKE cloaks you in MIRROR images. |
| 4 | VENOM (120) | VENOM GLANDS: Lifesteal +4, Shadow dmg +30 | VIPER KISS: POISON DART: VENOM, 1 round less cooldown. |
| 5 | QUICKSILVER (160) | QUICKSILVER: Haste +10, Dodge +3 | BLINK STRIKES: FAN OF KNIVES: +2 hits. |
| 6 | CUTPURSE (200) | CUTPURSE: Magic find +40, Gold find +40 | MARKED FOR DEATH: ASSASSINATE leaves the foe DOOMED. |

### POLEARM

Reach and control: damage, block and sweeps.

**Arts:** THRUST (1), SWEEP (120), BRACE AND STRIKE (240), LEAPING LANCE (360), PIERCING LINE (480), DRAGON'S TOOTH (600).

| # | Branch (mastery) | Trait at 200 | Capstone |
|---|---|---|---|
| 1 | REACH (1) | LONG REACH: Accuracy +4, Crit chance +5 | IMPALER: THRUST strikes twice. |
| 2 | PHALANX (40) | PHALANX: Block +6, Armour +2 | SPEAR WALL: BRACE AND STRIKE FORTIFIES you. |
| 3 | HALBERD (80) | HALBERDIER: Damage +30, Crit damage +20 | HOOK AND PULL: SWEEP knocks foes PRONE. |
| 4 | DRAGOON (120) | DRAGOON LEAP: Haste +10, Dodge +3 | SKYFALL: LEAPING LANCE hits every foe. |
| 5 | SUNLANCE (160) | SUNLIT TIP: Holy dmg +40, Crit chance +2 | DAWNPIERCE: PIERCING LINE sets foes BURNING. |
| 6 | SENTINEL (200) | SENTINEL'S WATCH: Max hp +450, Resist all +5 | HOLD THE LINE: DRAGON'S TOOTH: +2 dice and can STUN. |

### STAFF

Arcane focus: elemental power and healing.

**Arts:** STAFF STRIKE (1), FIREBALL CAST (120), FROST NOVA (240), LIGHTNING ARC (360), SANCTUARY (480), METEOR (600).

| # | Branch (mastery) | Trait at 200 | Capstone |
|---|---|---|---|
| 1 | PYRE (1) | PYROMANCY: Fire dmg +40, Crit chance +2 | INFERNO: FIREBALL CAST hits every foe. |
| 2 | RIME (40) | CRYOMANCY: Cold dmg +40, Crit chance +2 | ABSOLUTE ZERO: FROST NOVA: 5d8 and SLOWS. |
| 3 | STORM (80) | STORMCALLING: Shock dmg +40, Crit chance +2 | CHAIN STORM: LIGHTNING ARC: 1 round less cooldown. |
| 4 | GROVE (120) | MENDING: Healing +35, Max hp +200 | RENEWAL: SANCTUARY heals more (4d8). |
| 5 | FLUX (160) | ARCANE FLUX: Haste +10, Dodge +3 | TIME WARP: STAFF STRIKE strikes twice, 1 round less cooldown. |
| 6 | ARCHMAGE (200) | ARCHMAGE: Damage +30, Crit damage +20 | SPELL SURGE: METEOR leaves foes VULNERABLE. |

### WAND

Channelled curses and holy light.

**Arts:** WAND BOLT (1), CURSE BOLT (120), HOLY RAY (240), LIFE SIPHON (360), MENDING WAVE (480), DOOM CHANNEL (600).

| # | Branch (mastery) | Trait at 200 | Capstone |
|---|---|---|---|
| 1 | HEX (1) | HEXCRAFT: Shadow dmg +40, Crit chance +2 | WITHERING HEX: CURSE BOLT DOOMS the foe. |
| 2 | LIGHT (40) | LIGHTBEARER: Holy dmg +40, Crit chance +2 | RADIANCE: HOLY RAY hits every foe. |
| 3 | SIPHON (80) | SIPHONING: Lifesteal +4, Shadow dmg +30 | SOUL TAP: LIFE SIPHON drains more (60%). |
| 4 | MEND (120) | MENDER: Healing +35, Max hp +200 | GREATER RENEW: MENDING WAVE heals more (4d8). |
| 5 | FOCUS (160) | FOCUSED CHANNEL: Accuracy +4, Crit chance +5 | OVERCHANNEL: WAND BOLT deals 4d10. |
| 6 | MIRAGE (200) | MIRAGE: Dodge +6, Crit chance +3 | SPREADING BLIGHT: DOOM CHANNEL leaves foes VULNERABLE. |

### BOW

Range and precision: accuracy, crits and volleys.

**Arts:** AIMED SHOT (1), QUICK SHOT (120), PINNING SHOT (240), FLAME ARROW (360), RAIN OF ARROWS (480), SNIPER'S MARK (600).

| # | Branch (mastery) | Trait at 200 | Capstone |
|---|---|---|---|
| 1 | MARKSMAN (1) | DEADEYE: Accuracy +4, Crit chance +5 | BULLSEYE: AIMED SHOT: +2 dice. |
| 2 | SKIRMISH (40) | SKIRMISHER: Haste +10, Dodge +3 | FREE ARROW: QUICK SHOT fires three arrows. |
| 3 | KITE (80) | KITING: Dodge +6, Crit chance +3 | WIND WALK: PINNING SHOT HASTES you. |
| 4 | BROADHEAD (120) | BROADHEADS: Crit damage +35, Lifesteal +2 | BARBED VOLLEY: RAIN OF ARROWS leaves foes BLEEDING. |
| 5 | FLAMEARROW (160) | FIRE ARROWS: Fire dmg +40, Crit chance +2 | BLAZING QUIVER: FLAME ARROW hits every foe. |
| 6 | LONGSHOT (200) | LONGSHOT: Damage +30, Crit damage +20 | HEART ARROW: SNIPER'S MARK can STUN. |

### CROSSBOW

Heavy bolts: big crit damage and armour piercing.

**Arts:** BOLT (1), TWIN BOLTS (120), PIERCING BOLT (240), SHOCK BOLT (360), BOLT STORM (480), BALLISTA SHOT (600).

| # | Branch (mastery) | Trait at 200 | Capstone |
|---|---|---|---|
| 1 | HEAVY BOLT (1) | HEAVY DRAW: Damage +30, Crit damage +20 | SIEGE BOLT: BOLT: +2 dice. |
| 2 | SIGHTS (40) | IRON SIGHTS: Accuracy +4, Crit chance +5 | TRUE SIGHT: PIERCING BOLT leaves the foe VULNERABLE. |
| 3 | SERRATED (80) | SERRATED BOLTS: Crit damage +35, Lifesteal +2 | RIPPER: TWIN BOLTS leave the foe BLEEDING. |
| 4 | ARC (120) | ARC BOLTS: Shock dmg +40, Crit chance +2 | TESLA COIL: SHOCK BOLT hits every foe. |
| 5 | BOUNTY (160) | BOUNTY HUNTER: Magic find +40, Gold find +40 | WANTED: BOLT STORM DOOMS foes. |
| 6 | PAVISE (200) | PAVISE: Block +6, Armour +2 | FORTIFIED NEST: BALLISTA SHOT FORTIFIES you. |

### THROWN

Knives, axes and stars: speed and luck.

**Arts:** TOSS (1), KNIFE VOLLEY (120), FIRE FLASK (240), HAMSTRING TOSS (360), BLADE CYCLONE (480), STARFALL (600).

| # | Branch (mastery) | Trait at 200 | Capstone |
|---|---|---|---|
| 1 | FLICK (1) | QUICK HANDS: Haste +10, Dodge +3 | ENDLESS SUPPLY: KNIFE VOLLEY: +2 throws. |
| 2 | RICOCHET (40) | TRICK SHOT: Accuracy +4, Crit chance +5 | RICOCHET: TOSS bounces to every foe. |
| 3 | GAMBLER (80) | GAMBLER'S LUCK: Magic find +40, Gold find +40 | JACKPOT: STARFALL: +2 dice. |
| 4 | FIREBRAND (120) | FIREBRANDS: Fire dmg +40, Crit chance +2 | CINDER STORM: FIRE FLASK hits every foe. |
| 5 | ACROBAT (160) | ACROBAT: Dodge +6, Crit chance +3 | BACKFLIP: HAMSTRING TOSS HASTES you. |
| 6 | SHURIKEN (200) | STAR BLADES: Crit damage +35, Lifesteal +2 | THOUSAND STARS: BLADE CYCLONE leaves foes BLEEDING. |

### SCYTHE

Reaping: crit damage, shadow and lifesteal.

**Arts:** REAPING CUT (1), HARVEST (120), DEATH'S EDGE (240), SPECTRAL SWEEP (360), SOUL HARVEST (480), GRIM HARVEST (600).

| # | Branch (mastery) | Trait at 200 | Capstone |
|---|---|---|---|
| 1 | REAP (1) | REAPER: Lifesteal +4, Shadow dmg +30 | SOUL REAP: HARVEST hits every foe. |
| 2 | GRAVE (40) | GRAVE TOUCH: Shadow dmg +40, Crit chance +2 | TOMB CHILL: DEATH'S EDGE leaves FROSTBITE. |
| 3 | CRESCENT (80) | CRESCENT MOON: Crit damage +35, Lifesteal +2 | BLOOD MOON: REAPING CUT strikes twice and BLEEDS. |
| 4 | DOOM (120) | DOOMBRINGER: Damage +30, Crit damage +20 | FINAL HOUR: GRIM HARVEST: +2 dice. |
| 5 | WRAITH (160) | WRAITHFORM: Dodge +6, Crit chance +3 | PHANTOM: SPECTRAL SWEEP brings MIRROR images. |
| 6 | UNDYING (200) | UNDYING: Max hp +450, Resist all +5 | DEATHLESS: SOUL HARVEST drains more (50%). |

### GRIMOIRE

Spellbook: every school of magic.

**Arts:** PAGE BOLT (1), ICE GLYPH (120), RUNE BLAST (240), WORD OF POWER (360), BINDING CIRCLE (480), APOCRYPHA (600).

| # | Branch (mastery) | Trait at 200 | Capstone |
|---|---|---|---|
| 1 | EMBER PAGE (1) | EMBER SCRIPT: Fire dmg +40, Crit chance +2 | BURNING TEXT: PAGE BOLT sets the foe BURNING. |
| 2 | FROST PAGE (40) | FROST SCRIPT: Cold dmg +40, Crit chance +2 | WINTER CHAPTER: ICE GLYPH hits every foe. |
| 3 | STORM PAGE (80) | STORM SCRIPT: Shock dmg +40, Crit chance +2 | THUNDER VERSE: RUNE BLAST: SHOCKS, 1 round less cooldown. |
| 4 | HOLY PAGE (120) | HOLY SCRIPT: Holy dmg +40, Crit chance +2 | ILLUMINATED: WORD OF POWER also heals the party. |
| 5 | SHADOW PAGE (160) | SHADOW SCRIPT: Shadow dmg +40, Crit chance +2 | FORBIDDEN TEXT: BINDING CIRCLE drains 40%. |
| 6 | TOME (200) | TOMEKEEPER: Damage +30, Crit damage +20 | LAST CHAPTER: APOCRYPHA deals 10d10. |

### FIST

Martial arts: speed, dodge and combos.

**Arts:** PALM STRIKE (1), RAPID FISTS (120), DEFLECT AND COUNTER (240), SPINNING KICK (360), SHOCKWAVE (480), DRAGON STRIKE (600).

| # | Branch (mastery) | Trait at 200 | Capstone |
|---|---|---|---|
| 1 | COMBO (1) | FLOWING COMBO: Haste +10, Dodge +3 | ENDLESS COMBO: RAPID FISTS: +2 hits. |
| 2 | WIND (40) | WIND STEP: Dodge +6, Crit chance +3 | EMPTY BODY: DEFLECT AND COUNTER brings MIRROR images. |
| 3 | IRON FIST (80) | IRON FIST: Damage +30, Crit damage +20 | QUIVERING PALM: DRAGON STRIKE doubles below half health. |
| 4 | BREATH (120) | INNER BREATH: Max hp +450, Resist all +5 | DIAMOND SOUL: SPINNING KICK starts REGEN. |
| 5 | PRESSURE (160) | PRESSURE POINTS: Accuracy +4, Crit chance +5 | NERVE STRIKE: PALM STRIKE can STUN. |
| 6 | SPARK (200) | SPARK FISTS: Shock dmg +40, Crit chance +2 | STORM FISTS: SHOCKWAVE SHOCKS foes. |

### TOTEM

Elemental totems: the five elements, wards and healing.

**Arts:** TOTEM BOLT (1), EMBER PULSE (120), FROST BIND (240), STONE SLAM (360), SPIRIT LINK (480), ELEMENTAL FURY (600).

| # | Branch (mastery) | Trait at 200 | Capstone |
|---|---|---|---|
| 1 | FLAME (1) | FLAME SPIRIT: Fire dmg +40, Crit chance +2 | WILDFIRE: EMBER PULSE hits every foe. |
| 2 | FROST (40) | FROST SPIRIT: Cold dmg +40, Crit chance +2 | PERMAFROST: FROST BIND hits every foe and SLOWS. |
| 3 | STORM (80) | STORM SPIRIT: Shock dmg +40, Crit chance +2 | THUNDERHEAD: TOTEM BOLT SHOCKS, 1 round less cooldown. |
| 4 | EARTH (120) | EARTH SPIRIT: Block +6, Armour +2 | BEDROCK: STONE SLAM: +2 dice and FORTIFIES you. |
| 5 | SPIRIT (160) | ANCESTOR SPIRIT: Healing +35, Max hp +200 | SPIRIT WALK: SPIRIT LINK heals more (5d8). |
| 6 | ELDER (200) | ELDER TOTEM: Max hp +450, Resist all +5 | PRIMAL AVATAR: ELEMENTAL FURY leaves foes VULNERABLE. |
