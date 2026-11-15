#!/usr/bin/env python3
"""Generate 6,000 unique, production-oriented cinematic art briefs from the budget."""
import argparse, csv, json, random
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
BUDGET=ROOT/"data/visuals/cinematic_asset_budget.json"
MOODS=["ashen gothic","storm-worn high medieval","ancient sunken empire","frostbound northern","volcanic obsidian","overgrown forgotten kingdom","moonlit arcane","bleak plague-era","celestial ruin","deep subterranean"]
MATERIALS=["weathered blackened steel","aged bronze","hammered silver","volcanic glass","oiled dark leather","tarnished gold","carved bone","pitted iron","veined marble","ancient hardwood","scale and horn","woven ceremonial cloth"]
LIGHTS=["overcast cinematic skylight","cold moon rim light","warm torchlight against deep shadow","volumetric dawn haze","storm lightning backlight","subsurface ember glow","mist-filtered sunrise","blue hour atmospheric light"]
CAMERAS=["three-quarter hero view","low-angle monumental view","eye-level orthographic product view","wide establishing composition","macro material detail view"]
NEGATIVE="pixel art, 8-bit, low-poly, blurry, flat lighting, text, watermark, logo, UI mockup, duplicated parts, malformed anatomy, floating objects"
TEMPLATES={
"player_characters_races":"A full-body playable fantasy race character, anatomically coherent, distinctive face and silhouette, layered travel gear, believable fabric and skin materials",
"classes_subclasses_outfits":"A class-specific hero outfit and wearable equipment set, readable role silhouette, layered construction, functional straps and fasteners",
"weapons":"An original fantasy weapon with functional grip, balanced proportions, detailed guard and pommel, forged material microdetail, unique silhouette",
"armor_sets_and_pieces":"An original fantasy armor piece/set with articulated construction, believable overlap and joints, engraved but non-legible ornament, layered metal/leather/cloth",
"shields_and_offhand":"An original off-hand shield or combat implement, reinforced edge, hand grip and straps, battle wear and heraldic motif without text",
"jewelry_accessories":"A finely crafted fantasy accessory, gemstone setting, tiny metalwork, believable clasp and attachment points",
"creatures_and_enemies":"A distinctive fantasy creature with coherent anatomy, readable locomotion, naturalistic skin/fur/scales, expressive threat posture",
"bosses_and_raid_creatures":"A colossal original boss creature, imposing readable silhouette, layered anatomy, environmental scale cues, intricate surface detail",
"open_world_biomes_and_landscapes":"A breathtaking open-world landscape vista with layered terrain, distant landmarks, atmospheric depth, natural ecological transitions",
"environment_modular_kit":"A modular environment construction asset, consistent architectural scale, clean pivots, believable stone/wood/metal construction",
"vegetation_and_foliage":"A high-detail vegetation asset with natural branching, leaf variation, translucency, root structure and biome-appropriate growth",
"towns_cities_and_buildings":"A lived-in fantasy settlement building or street scene, coherent medieval construction, practical access and believable wear",
"dungeons_ruins_and_interiors":"An explorable dungeon or ancient interior, layered architecture, readable traversal, environmental storytelling and dramatic light",
"world_maps_and_landmarks":"A distinctive world landmark or map illustration with clear geography, memorable silhouette and navigational readability",
"props_and_interactables":"A grounded world prop or gameplay interactable, clear interaction affordance, functional construction and weathered materials",
"mounts_and_pets":"A rideable or companion creature with believable anatomy, tack/gear attachment points and expressive personality",
"npcs_and_civilians":"A grounded civilian or specialist NPC, distinctive occupation clothing, natural pose, believable face and practical accessories",
"magic_vfx_and_particles":"A real-time fantasy spell effect with layered energy shapes, controlled particle density, readable silhouette and emissive core",
"items_consumables_and_crafting":"A detailed inventory item or crafting resource, tactile materials, clear silhouette, polished studio presentation",
"ui_icons_and_inventory_art":"A premium game inventory icon, isolated centered object, transparent background, strong silhouette, readable at small sizes",
"portraits_and_dialogue_art":"A cinematic character portrait, expressive face, detailed costume, controlled background separation and dramatic key light",
"cinematic_loading_and_key_art":"An original dark-fantasy key-art composition, monumental world scale, strong focal hierarchy and atmospheric storytelling"
}
def main():
 ap=argparse.ArgumentParser()
 ap.add_argument("--output",type=Path,default=ROOT/"data/visuals/cinematic_asset_prompts.csv")
 ap.add_argument("--seed",type=int,default=5700)
 a=ap.parse_args()
 spec=json.loads(BUDGET.read_text()); rng=random.Random(a.seed)
 a.output.parent.mkdir(parents=True,exist_ok=True)
 fields=["asset_id","category","sequence","asset_name","asset_type","target_engine","resolution","maps","prompt","negative_prompt","source_filename","status"]
 rows=[]
 with a.output.open("w",newline="",encoding="utf-8") as f:
  w=csv.DictWriter(f,fieldnames=fields); w.writeheader()
  n=0
  for cat in spec["categories"]:
   template=TEMPLATES[cat["id"]]
   for i in range(1,cat["count"]+1):
    n+=1; mood=rng.choice(MOODS); material=rng.choice(MATERIALS); light=rng.choice(LIGHTS); camera=rng.choice(CAMERAS)
    seed=rng.randrange(1,2**31)
    name=f'{cat["id"].replace("_"," ").title()} {i:04d}'
    prompt=(f'{template}. Art direction: {mood}. Material emphasis: {material}. Lighting: {light}. '
            f'Composition: {camera}. Original design language for GB-Quest; physically plausible construction, '
            f'exceptional craftsmanship, fine surface microdetail, cinematic AAA dark-fantasy realism, '
            f'production-ready silhouette and clean readable forms. Variation seed {seed}.')
    row={"asset_id":f"GBQ-CIN-{n:04d}","category":cat["id"],"sequence":i,"asset_name":name,
         "asset_type":"image_or_model_brief","target_engine":"Unreal Engine 5.7",
         "resolution":"4096x4096 preferred; 2048x2048 minimum",
         "maps":"BaseColor;Normal;ORM;Emissive-if-needed;Opacity-if-needed",
         "prompt":prompt,"negative_prompt":NEGATIVE,
         "source_filename":f'GBQ-CIN-{n:04d}',"status":"brief_ready_source_art_not_generated"}
    w.writerow(row); rows.append(row)
 assert len(rows)==spec["total_assets"]==6000
 print(f"Wrote {len(rows)} unique asset briefs to {a.output}")
if __name__=="__main__": main()
