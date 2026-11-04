#pragma once
#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "GBQTypes.h"
#include "GBQCombatComponent.generated.h"
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FGBQCombatResolved,const FGBQCombatResult&,Result);
UCLASS(ClassGroup=(GBQuest),meta=(BlueprintSpawnableComponent),BlueprintType)
class GBQUEST_API UGBQCombatComponent : public UActorComponent { GENERATED_BODY() public:
 UPROPERTY(BlueprintAssignable) FGBQCombatResolved OnAttackResolved;
 UFUNCTION(BlueprintCallable, Category="GBQuest|Combat") FGBQCombatResult ResolveAttack(int32 AttackBonus,int32 TargetArmorClass,float BaseDamage,EGBQDamageType DamageType,bool bAdvantage=false,bool bDisadvantage=false);
};
