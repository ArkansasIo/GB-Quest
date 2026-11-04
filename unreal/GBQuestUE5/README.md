# GB-Quest in Unreal Engine 5.8

This is a separate Unreal wrapper around the existing browser game. It opens the current fullscreen build in Unreal's Web Browser widget; the original HTML/JavaScript game remains in the repository root.

## Open

Open `GBQuestUE5.uproject` with Unreal Engine 5.8. Press **Play** to run the browser game inside the editor viewport. Keyboard controls go to the embedded game; mouse input is also enabled.

The wrapper ships `WebGame/gbquest-fullscreen.html`, a self-contained browser build. Rebuild the web game at the repository root, then copy `dist/gbquest-fullscreen.html` over that file to refresh the embedded version.

## Claude Code / Unreal MCP

The project enables UE 5.8's experimental `ModelContextProtocol` and `AllToolsets` plugins, starts the local MCP server automatically, and includes `.mcp.json` for Claude Code. Keep the editor and Claude Code on the same computer. The server is local-only and unauthenticated.

Claude Code's Epic Unreal skills plugin is installed at user scope. Start Claude Code from this folder after opening the project in Unreal. On Windows, use Git Bash if you want the plugin's Bash session hook to run.

## Scope

This wrapper targets Unreal Editor and desktop Windows. It is not a native Unreal rewrite and does not currently package the browser files for standalone shipping.

## GB-Quest source import and Blueprint scaffolds

`create_blueprints.py` is an Unreal Editor Python script. It clones source/reference files into `SourceReference/GBQuest`, imports the repository's existing images and finalized `SourceArt` images into `/Game/GBQuest/Art`, creates the initial Blueprint class and widget assets under `/Game/GBQuest/Blueprints`, and writes `BlueprintPortManifest.json` with a suggested Blueprint destination for each source file.

After reopening the project so the Python and Editor Scripting plugins load, run the script from Unreal Editor's **Tools > Execute Python Script** menu. The image import scans thousands of files and can take several minutes. The import is non-destructive: it does not replace existing Unreal assets or change the project's default GameMode.

The source mirror and Blueprint scaffolds are migration aids. They do not convert JavaScript gameplay into Blueprint event graphs; that logic still needs to be ported and compiled system by system.
