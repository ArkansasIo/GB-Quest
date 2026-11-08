#pragma once
#include "CoreMinimal.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "GBQuestGearInspectionTypes.h"
#include "GBQuestGearInspectionLibrary.generated.h"
UCLASS()
class GBQUESTUE5_API UGBQuestGearInspectionLibrary : public UBlueprintFunctionLibrary
{
 GENERATED_BODY()
public:
 UFUNCTION(BlueprintPure, Category="GBQuest|Gear|Inspection")
 static FGBQuestGearInspection InspectGear(const FGBQuestGearItem& Candidate, const FGBQuestGearItem& Equipped, int32 CharacterLevel);
 UFUNCTION(BlueprintPure, Category="GBQuest|Gear|Inspection")
 static TArray<FGBQuestGearStatDelta> CompareGearStats(const FGBQuestGearItem& Candidate, const FGBQuestGearItem& Equipped);
 UFUNCTION(BlueprintPure, Category="GBQuest|Gear|Inspection")
 static float CalculateGearPowerScore(const FGBQuestGearItem& Item);
};