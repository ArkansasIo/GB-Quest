using UnrealBuildTool;
public class GBQuestEditorTarget:TargetRules { public GBQuestEditorTarget(TargetInfo Target):base(Target) { Type=TargetType.Editor; DefaultBuildSettings=BuildSettingsVersion.V5; IncludeOrderVersion=EngineIncludeOrderVersion.Latest; ExtraModuleNames.AddRange(new[]{"GBQuest","GBQuestEditor"}); } }
