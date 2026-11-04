#pragma once
#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "GBQTypes.h"
#include "GBQCombatComponent.generated.h"
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FGBQCombatResolved, const FGBQCombatResult&, Result);
UCLASS(ClassGroup=(GBQuest), BlueprintType, Blueprintable, meta=(BlueprintSpawnableComponent))
class GBQUEST_API UGBQCombatComponent : public UActorComponent
{
    GENERATED_BODY()
public:
    UPROPERTY(BlueprintAssignable, Category="Combat") FGBQCombatResolved OnAttackResolved;
    UFUNCTION(BlueprintCallable, Category="Combat") FGBQCombatResult ResolveAttack(int32 AttackBonus,int32 TargetArmorClass,float BaseDamage,EGBQDamageType DamageType,bool bAdvantage=false,bool bDisadvantage=false);
};
