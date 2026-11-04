import unreal
TOOLS=unreal.AssetToolsHelpers.get_asset_tools()
ROOT="/Game/GBQuest/Blueprints"
def ensure_folder(path):
    if not unreal.EditorAssetLibrary.does_directory_exist(path): unreal.EditorAssetLibrary.make_directory(path)
def create_blueprint(name, parent_class, folder):
    ensure_folder(folder)
    asset_path=folder+"/"+name
    if unreal.EditorAssetLibrary.does_asset_exist(asset_path): return unreal.load_asset(asset_path)
    factory=unreal.BlueprintFactory(); factory.set_editor_property("parent_class",parent_class)
    asset=TOOLS.create_asset(name,folder,unreal.Blueprint,factory)
    if asset: unreal.EditorAssetLibrary.save_asset(asset_path)
    else: unreal.log_error("Could not create "+asset_path)
    return asset
classes=[
    ("BP_GBQCharacter","/Script/GBQuest.GBQCharacter","/Characters"),
    ("BP_GBQPlayerController","/Script/GBQuest.GBQPlayerController","/Core"),
    ("BP_GBQGameMode","/Script/GBQuest.GBQGameMode","/Core"),
]
for name,path,sub in classes:
    cls=unreal.load_class(None,path)
    if cls: create_blueprint(name,cls,ROOT+sub)
    else: unreal.log_error("Native class unavailable: "+path+" (compile C++ first)")
unreal.log("GB-Quest Blueprint base generation pass complete")
