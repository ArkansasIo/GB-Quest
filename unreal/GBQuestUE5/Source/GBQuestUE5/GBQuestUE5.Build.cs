using UnrealBuildTool;
public class GBQuestUE5 : ModuleRules { public GBQuestUE5(ReadOnlyTargetRules Target) : base(Target) { PCHUsage=PCHUsageMode.UseExplicitOrSharedPCHs; PublicDependencyModuleNames.AddRange(new string[] { "Core","CoreUObject","Engine","InputCore","EnhancedInput","UMG","Slate","SlateCore","WebBrowserWidget","GameplayTags","Niagara","AIModule" }); } }
