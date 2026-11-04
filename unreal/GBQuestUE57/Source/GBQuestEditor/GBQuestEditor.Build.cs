using UnrealBuildTool;
public class GBQuestEditor:ModuleRules { public GBQuestEditor(ReadOnlyTargetRules Target):base(Target) { PCHUsage=PCHUsageMode.UseExplicitOrSharedPCHs; PublicDependencyModuleNames.AddRange(new[]{"Core","CoreUObject","Engine","UnrealEd","GBQuest","AssetTools","Slate","SlateCore"}); } }
