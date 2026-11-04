#pragma once
#include "CoreMinimal.h"
#include "Engine/PrimaryDataAsset.h"
#include "GBQTypes.h"
#include "GBQAbilityData.generated.h"
UCLASS(BlueprintType)
class GBQUEST_API UGBQAbilityData : public UPrimaryDataAsset { GENERATED_BODY() public:
 UPROPERTY(EditDefaultsOnly, BlueprintReadOnly) FName AbilityId;
 UPROPERTY(EditDefaultsOnly, BlueprintReadOnly) FText DisplayName;
 UPROPERTY(EditDefaultsOnly, BlueprintReadOnly) FText Description;
 UPROPERTY(EditDefaultsOnly, BlueprintReadOnly) int32 SpellLevel=0;
 UPROPERTY(EditDefaultsOnly, BlueprintReadOnly) float BasePower=0.f;
 UPROPERTY(EditDefaultsOnly, BlueprintReadOnly) float CooldownSeconds=0.f;
 UPROPERTY(EditDefaultsOnly, BlueprintReadOnly) float ResourceCost=0.f;
 UPROPERTY(EditDefaultsOnly, BlueprintReadOnly) EGBQDamageType DamageType=EGBQDamageType::Physical;
 UPROPERTY(EditDefaultsOnly, BlueprintReadOnly) TObjectPtr<UTexture2D> Icon=nullptr;
};
