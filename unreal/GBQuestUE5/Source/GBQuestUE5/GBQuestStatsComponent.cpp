#include "GBQuestStatsComponent.h"
UGBQuestStatsComponent::UGBQuestStatsComponent() { PrimaryComponentTick.bCanEverTick = false; }
void UGBQuestStatsComponent::BeginPlay() { Super::BeginPlay(); ResetHealth(); }
float UGBQuestStatsComponent::GetMaxHealth() const
{
    return FMath::Max(1.f, static_cast<float>(FMath::Max(1, Attributes.Vitality)) * 15.f
        + static_cast<float>(FMath::Max(1, Attributes.Constitution)) * 10.f + FMath::Max(0.f, BonusMaxHealth));
}
float UGBQuestStatsComponent::ApplyDamage(float Amount)
{
    const float Before = CurrentHealth;
    CurrentHealth = FMath::Clamp(CurrentHealth - FMath::Max(0.f, Amount), 0.f, GetMaxHealth());
    const float Applied = Before - CurrentHealth;
    if (!FMath::IsNearlyZero(Applied)) OnHealthChanged.Broadcast(CurrentHealth, GetMaxHealth());
    return Applied;
}
float UGBQuestStatsComponent::RestoreHealth(float Amount)
{
    const float Before = CurrentHealth;
    CurrentHealth = FMath::Clamp(CurrentHealth + FMath::Max(0.f, Amount), 0.f, GetMaxHealth());
    const float Restored = CurrentHealth - Before;
    if (!FMath::IsNearlyZero(Restored)) OnHealthChanged.Broadcast(CurrentHealth, GetMaxHealth());
    return Restored;
}
void UGBQuestStatsComponent::ResetHealth()
{
    CurrentHealth = GetMaxHealth();
    OnHealthChanged.Broadcast(CurrentHealth, GetMaxHealth());
}