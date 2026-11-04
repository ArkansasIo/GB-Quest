#pragma once
#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "GBQTypes.h"
#include "GBQStatsComponent.generated.h"
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FGBQResourceChanged,EGBQResourceType,Type,float,NewValue);
UCLASS(ClassGroup=(GBQuest),meta=(BlueprintSpawnableComponent),BlueprintType)
class GBQUESTUE5_API UGBQStatsComponent:public UActorComponent { GENERATED_BODY() public:
 UPROPERTY(EditAnywhere,BlueprintReadWrite) FGBQAbilityScores Attributes;
 UPROPERTY(EditAnywhere,BlueprintReadWrite) TArray<FGBQResourcePool> Resources;
 UPROPERTY(BlueprintAssignable) FGBQResourceChanged OnResourceChanged;
 UFUNCTION(BlueprintPure) int32 GetModifier(int32 Score) const;
 UFUNCTION(BlueprintPure) int32 GetProficiencyBonus(int32 Level) const;
 UFUNCTION(BlueprintPure) float GetResource(EGBQResourceType Type) const;
 UFUNCTION(BlueprintCallable) bool ModifyResource(EGBQResourceType Type,float Delta);
};
