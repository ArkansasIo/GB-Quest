#pragma once
#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "GBQuestRPGTypes.h"
#include "GBQuestCombatComponent.generated.h"
class UGBQuestStatsComponent;
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FGBQuestCombatEvent, AActor*, Target, const FGBQuestDamageResult&, Result);
UCLASS(ClassGroup=(GBQuest), BlueprintType, Blueprintable, meta=(BlueprintSpawnableComponent))
class GBQUESTUE5_API UGBQuestCombatComponent : public UActorComponent
{
    GENERATED_BODY()
public:
    UGBQuestCombatComponent();
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Combat", meta=(ClampMin="0")) float BaseAttackPower = 10.f;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Combat", meta=(ClampMin="0")) float ArmorMitigation = 0.f;
    UPROPERTY(BlueprintAssignable, Category="Combat") FGBQuestCombatEvent OnAttackResolved;
    UFUNCTION(BlueprintCallable, Category="Combat") bool TryApplyAttack(AActor* Target, float PowerMultiplier, FGBQuestDamageResult& OutResult);
protected:
    UFUNCTION(BlueprintPure, Category="Combat") UGBQuestStatsComponent* FindStats(AActor* Actor) const;
};