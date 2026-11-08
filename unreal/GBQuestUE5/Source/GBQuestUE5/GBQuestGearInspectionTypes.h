#pragma once
#include "CoreMinimal.h"
#include "GBQuestGearInspectionTypes.generated.h"
USTRUCT(BlueprintType)
struct FGBQuestGearStatLine
{
 GENERATED_BODY()
 UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Gear") FName StatId = NAME_None;
 UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Gear") float Value = 0.f;
 UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Gear") bool bIsPercent = false;
 UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Gear") bool bIsGreaterAffix = false;
};
USTRUCT(BlueprintType)
struct FGBQuestGearItem
{
 GENERATED_BODY()
 UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Gear") FName ItemId = NAME_None;
 UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Gear") FText DisplayName;
 UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Gear") FName Slot = NAME_None;
 UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Gear", meta=(ClampMin="0", ClampMax="7")) int32 Rarity = 1;
 UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Gear", meta=(ClampMin="1")) int32 ItemLevel = 1;
 UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Gear", meta=(ClampMin="0")) int32 RequiredLevel = 1;
 UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Gear", meta=(ClampMin="0")) int32 VendorValue = 0;
 UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Gear", meta=(ClampMin="0")) int32 MarketValue = 0;
 UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Gear") TArray<FGBQuestGearStatLine> BaseStats;
 UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Gear") TArray<FGBQuestGearStatLine> SubStats;
 UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Gear") TArray<FName> Affixes;
 UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Gear") FText SpecialEffect;
};
USTRUCT(BlueprintType)
struct FGBQuestGearStatDelta
{
 GENERATED_BODY()
 UPROPERTY(BlueprintReadOnly, Category="Gear") FName StatId = NAME_None;
 UPROPERTY(BlueprintReadOnly, Category="Gear") float CandidateValue = 0.f;
 UPROPERTY(BlueprintReadOnly, Category="Gear") float EquippedValue = 0.f;
 UPROPERTY(BlueprintReadOnly, Category="Gear") float Difference = 0.f;
};
USTRUCT(BlueprintType)
struct FGBQuestGearInspection
{
 GENERATED_BODY()
 UPROPERTY(BlueprintReadOnly, Category="Gear") FGBQuestGearItem Item;
 UPROPERTY(BlueprintReadOnly, Category="Gear") TArray<FGBQuestGearStatDelta> Comparison;
 UPROPERTY(BlueprintReadOnly, Category="Gear") float PowerScore = 0.f;
 UPROPERTY(BlueprintReadOnly, Category="Gear") bool bUpgradeByPowerScore = false;
 UPROPERTY(BlueprintReadOnly, Category="Gear") bool bCanEquip = true;
 UPROPERTY(BlueprintReadOnly, Category="Gear") FText EquipRestriction;
};