import json, os, unreal
HERE=os.path.dirname(os.path.abspath(__file__))
PROJECT=os.path.abspath(os.path.join(HERE,"..",".."))
REPO=os.path.abspath(os.path.join(PROJECT,"..",".."))
ASSETS=os.path.join(REPO,"assets")
MANIFEST=os.path.join(ASSETS,"index.json")
DEST="/Game/GBQuest/Art"
PREFIX={"ap_characters":"Characters","ap_portraits":"Portraits","ap_monsters":"Monsters","ap_enemies":"Enemies","ap_items":"Items","ap_weapons":"Weapons","ap_armor":"Armor","ap_buildings":"Buildings","ap_dungeon":"Dungeons","ap_environment":"Environment","ap_terrain":"Terrain","ap_mounts":"Mounts","ap_npcs":"NPCs","ap_particles":"Particles","ap_ui_icons":"Icons","ap_scene":"Scenes","au_":"UI","ac_":"Achievements","ad_":"Admin"}
def category(key):
    for prefix,folder in PREFIX.items():
        if key.startswith(prefix): return folder
    return "Misc"
def main():
    if not os.path.isfile(MANIFEST): raise RuntimeError("Missing asset manifest: "+MANIFEST)
    with open(MANIFEST,encoding="utf-8") as f: ids=json.load(f)
    if not isinstance(ids,list): raise RuntimeError("Expected a JSON array in assets/index.json")
    tools=unreal.AssetToolsHelpers.get_asset_tools(); imported=0; missing=[]; failed=[]
    for key in ids:
        src=os.path.join(ASSETS,str(key)+".png")
        if not os.path.isfile(src): missing.append(key); continue
        folder=DEST+"/"+category(str(key))
        if not unreal.EditorAssetLibrary.does_directory_exist(folder): unreal.EditorAssetLibrary.make_directory(folder)
        task=unreal.AssetImportTask()
        for name,value in (("filename",src),("destination_path",folder),("destination_name",str(key)),("automated",True),("replace_existing",True),("save",True)):
            task.set_editor_property(name,value)
        try:
            tools.import_asset_tasks([task]); paths=task.get_editor_property("imported_object_paths")
            if paths: imported+=len(paths)
            else: failed.append(key)
        except Exception as exc: failed.append({"id":key,"error":str(exc)})
    unreal.EditorAssetLibrary.save_directory(DEST,False,True)
    report={"manifest_entries":len(ids),"imported":imported,"missing_pngs":missing,"failed":failed,"destination":DEST}
    output=os.path.join(PROJECT,"Saved","GBQuestAssetImportReport.json"); os.makedirs(os.path.dirname(output),exist_ok=True)
    with open(output,"w",encoding="utf-8") as f: json.dump(report,f,indent=2)
    unreal.log("GB-Quest asset import: {} imported, {} missing, {} failed".format(imported,len(missing),len(failed)))
    return report
if __name__=="__main__": main()
