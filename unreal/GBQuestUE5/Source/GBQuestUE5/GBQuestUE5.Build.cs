using UnrealBuildTool;
public class GBQuestUE5 : ModuleRules
{
    public GBQuestUE5(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
        PublicDependencyModuleNames.AddRange(new string[] { "Core", "CoreUObject", "Engine", "InputCore", "UMG", "Slate", "SlateCore", "WebBrowserWidget" });
        PrivateDependencyModuleNames.AddRange(new string[] { "Projects" });
    }
}