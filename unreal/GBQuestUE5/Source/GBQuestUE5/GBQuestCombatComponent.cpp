#include "GBQuestCombatComponent.h"
#include "GBQuestStatsComponent.h"
UGBQuestCombatComponent::UGBQuestCombatComponent() { PrimaryComponentTick.bCanEverTick = false; }
UGBQuestStatsComponent* UGBQuestCombatComponent::FindStats(AActor* Actor) const
{
    return Actor ? Actor->FindComponentByClass<UGBQuestStatsComponent>() : nullptr;
}
bool UGBQuestCombatComponent::TryApplyAttack(AActor* Target, float PowerMultiplier, FGBQuestDamageResult& OutResult)
{
    OutResult = FGBQuestDamageResult();
    if (!IsValid(Target) || Target == GetOwner()) return false;
    UGBQuestStatsComponent* TargetStats = FindStats(Target);
    if (!TargetStats || TargetStats->IsDefeated()) return false;
    const float RawDamage = FMath::Max(0.f, BaseAttackPower) * FMath::Max(0.f, PowerMultiplier);
    OutResult.RequestedDamage = RawDamage;
    OutResult.AppliedDamage = TargetStats->ApplyDamage(FMath::Max(0.f, RawDamage - ArmorMitigation));
    OutResult.bTargetDefeated = TargetStats->IsDefeated();
    OnAttackResolved.Broadcast(Target, OutResult);
    return true;
}