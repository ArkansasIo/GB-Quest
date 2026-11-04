# Unreal Engine 5.7 editor workflow

1. Install Unreal Engine 5.7 and open GBQuestUE57.uproject.
2. Allow Unreal Build Tool to compile the GBQuest module.
3. Enable Python Editor Script Plugin and Editor Scripting Utilities.
4. Run import_gbquest_assets.py using the editor Python console.
5. Run create_blueprints.py after the C++ module compiles.
6. Create Widget Blueprints using Content/UI/README.md as the screen inventory.

The importer expects assets/index.json and PNG files in the assets folder. Unreal Editor creates genuine .uasset packages; text files cannot substitute for serialized Unreal assets.
