#pragma once
#include "CoreMinimal.h"
#include "GBQuestRPGTypes.generated.h"
USTRUCT(BlueprintType)
struct FGBQuestPrimaryAttributes
{
    GENERATED_BODY()
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Attributes", meta=(ClampMin="1")) int32 Strength = 10;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Attributes", meta=(ClampMin="1")) int32 Dexterity = 10;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Attributes", meta=(ClampMin="1")) int32 Constitution = 10;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Attributes", meta=(ClampMin="1")) int32 Intelligence = 10;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Attributes", meta=(ClampMin="1")) int32 Wisdom = 10;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Attributes", meta=(ClampMin="1")) int32 Vitality = 10;
};
USTRUCT(BlueprintType)
struct FGBQuestItemStack
{
    GENERATED_BODY()
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Inventory") FName ItemId = NAME_None;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Inventory", meta=(ClampMin="1")) int32 Quantity = 1;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Inventory", meta=(ClampMin="1")) int32 MaxStack = 99;
};
USTRUCT(BlueprintType)
struct FGBQuestDamageResult
{
    GENERATED_BODY()
    UPROPERTY(BlueprintReadOnly, Category="Combat") float RequestedDamage = 0.f;
    UPROPERTY(BlueprintReadOnly, Category="Combat") float AppliedDamage = 0.f;
    UPROPERTY(BlueprintReadOnly, Category="Combat") bool bTargetDefeated = false;
};