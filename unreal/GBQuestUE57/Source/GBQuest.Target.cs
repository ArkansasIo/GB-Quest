using UnrealBuildTool;
public class GBQuestTarget:TargetRules { public GBQuestTarget(TargetInfo Target):base(Target) { Type=TargetType.Game; DefaultBuildSettings=BuildSettingsVersion.V5; IncludeOrderVersion=EngineIncludeOrderVersion.Latest; ExtraModuleNames.Add("GBQuest"); } }
