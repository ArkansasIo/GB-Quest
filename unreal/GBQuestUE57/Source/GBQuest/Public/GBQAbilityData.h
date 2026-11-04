#pragma once
#include "CoreMinimal.h"
#include "Engine/PrimaryDataAsset.h"
#include "GBQTypes.h"
#include "GBQAbilityData.generated.h"

UCLASS(BlueprintType)
class GBQUEST_API UGBQAbilityData : public UPrimaryDataAsset
{
    GENERATED_BODY()
public:
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Ability") FName AbilityId;
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Ability") FText DisplayName;
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Ability", meta=(MultiLine=true)) FText Description;
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Ability") int32 SpellLevel=0;
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Ability") float BasePower=0.f;
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Ability") float CooldownSeconds=0.f;
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Ability") float ResourceCost=0.f;
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Ability") EGBQDamageType DamageType=EGBQDamageType::Physical;
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Visuals") TObjectPtr<UTexture2D> Icon=nullptr;
};
