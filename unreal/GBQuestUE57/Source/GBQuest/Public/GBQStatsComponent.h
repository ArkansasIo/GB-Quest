#pragma once
#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "GBQTypes.h"
#include "GBQStatsComponent.generated.h"
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FGBQResourceChanged,EGBQResourceType,Type,float,NewValue);
UCLASS(ClassGroup=(GBQuest),meta=(BlueprintSpawnableComponent),BlueprintType)
class GBQUEST_API UGBQStatsComponent : public UActorComponent { GENERATED_BODY() public:
 UPROPERTY(EditAnywhere,BlueprintReadWrite,Category="Attributes") FGBQAbilityScores Attributes;
 UPROPERTY(EditAnywhere,BlueprintReadWrite,Category="Resources") TArray<FGBQResourcePool> Resources;
 UPROPERTY(BlueprintAssignable) FGBQResourceChanged OnResourceChanged;
 UFUNCTION(BlueprintPure,Category="Attributes") int32 GetModifier(int32 Score) const;
 UFUNCTION(BlueprintPure,Category="Progression") int32 GetProficiencyBonus(int32 Level) const;
 UFUNCTION(BlueprintPure,Category="Resources") float GetResource(EGBQResourceType Type) const;
 UFUNCTION(BlueprintCallable,Category="Resources") bool ModifyResource(EGBQResourceType Type,float Delta);
};
