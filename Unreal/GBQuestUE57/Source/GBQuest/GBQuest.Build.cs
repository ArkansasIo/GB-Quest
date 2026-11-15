using UnrealBuildTool;

public class GBQuest : ModuleRules
{
    public GBQuest(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
        PublicDependencyModuleNames.AddRange(new[] {
            "Core", "CoreUObject", "Engine", "InputCore", "EnhancedInput",
            "GameplayTags", "GameplayTasks", "AIModule", "UMG", "Slate",
            "SlateCore", "NetCore", "DeveloperSettings"
        });
    }
}