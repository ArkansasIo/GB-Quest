using UnrealBuildTool;
using System.Collections.Generic;

public class GBQuestUE5Target : TargetRules
{
	public GBQuestUE5Target(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Game;
		DefaultBuildSettings = BuildSettingsVersion.V7;
		IncludeOrderVersion = EngineIncludeOrderVersion.Unreal5_8;
		ExtraModuleNames.Add("GBQuestUE5");
	}
}
