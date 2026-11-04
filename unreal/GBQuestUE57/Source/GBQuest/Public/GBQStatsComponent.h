#pragma once
#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "GBQTypes.h"
#include "GBQStatsComponent.generated.h"
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FGBQResourceChanged, EGBQResourceType, Type, float, NewValue);
UCLASS(ClassGroup=(GBQuest), BlueprintType, Blueprintable, meta=(BlueprintSpawnableComponent))
class GBQUEST_API UGBQStatsComponent : public UActorComponent
{
    GENERATED_BODY()
public:
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Stats") FGBQAbilityScores Attributes;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Stats") TArray<FGBQResourcePool> Resources;
    UPROPERTY(BlueprintAssignable, Category="Events") FGBQResourceChanged OnResourceChanged;
    UFUNCTION(BlueprintPure, Category="Stats") int32 GetModifier(int32 Score) const;
    UFUNCTION(BlueprintPure, Category="Stats") int32 GetProficiencyBonus(int32 CharacterLevel) const;
    UFUNCTION(BlueprintCallable, Category="Resources") bool ModifyResource(EGBQResourceType Type, float Delta);
    UFUNCTION(BlueprintPure, Category="Resources") float GetResource(EGBQResourceType Type) const;
};
