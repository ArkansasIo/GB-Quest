#include "GBQuestAttributeComponent.h"
#include "Net/UnrealNetwork.h"

UGBQuestAttributeComponent::UGBQuestAttributeComponent()
{
    SetIsReplicatedByDefault(true);
}
void UGBQuestAttributeComponent::ApplyDamage(float Amount)
{
    if (GetOwner() && GetOwner()->HasAuthority())
        Health = FMath::Clamp(Health - FMath::Max(0.f, Amount), 0.f, MaxHealth);
}
void UGBQuestAttributeComponent::RestoreHealth(float Amount)
{
    if (GetOwner() && GetOwner()->HasAuthority())
        Health = FMath::Clamp(Health + FMath::Max(0.f, Amount), 0.f, MaxHealth);
}
void UGBQuestAttributeComponent::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
    Super::GetLifetimeReplicatedProps(OutLifetimeProps);
    DOREPLIFETIME(UGBQuestAttributeComponent, Primary);
    DOREPLIFETIME(UGBQuestAttributeComponent, Health);
    DOREPLIFETIME(UGBQuestAttributeComponent, MaxHealth);
}