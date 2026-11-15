#include "GBQuestInventoryComponent.h"
#include "Net/UnrealNetwork.h"

UGBQuestInventoryComponent::UGBQuestInventoryComponent()
{
    SetIsReplicatedByDefault(true);
}
bool UGBQuestInventoryComponent::AddItem(FName ItemId, int32 Quantity)
{
    if (!GetOwner() || !GetOwner()->HasAuthority() || ItemId.IsNone() || Quantity <= 0) return false;
    if (FGBQuestInventoryEntry* Found = Entries.FindByPredicate(
        [&ItemId](const FGBQuestInventoryEntry& E) { return E.ItemId == ItemId; }))
        Found->Quantity += Quantity;
    else {
        FGBQuestInventoryEntry& NewEntry = Entries.AddDefaulted_GetRef();
        NewEntry.ItemId = ItemId;
        NewEntry.Quantity = Quantity;
    }
    return true;
}
bool UGBQuestInventoryComponent::RemoveItem(FName ItemId, int32 Quantity)
{
    if (!GetOwner() || !GetOwner()->HasAuthority() || ItemId.IsNone() || Quantity <= 0) return false;
    const int32 Index = Entries.IndexOfByPredicate(
        [&ItemId](const FGBQuestInventoryEntry& E) { return E.ItemId == ItemId; });
    if (Index == INDEX_NONE || Entries[Index].Quantity < Quantity) return false;
    Entries[Index].Quantity -= Quantity;
    if (Entries[Index].Quantity == 0) Entries.RemoveAt(Index);
    return true;
}
void UGBQuestInventoryComponent::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
    Super::GetLifetimeReplicatedProps(OutLifetimeProps);
    DOREPLIFETIME(UGBQuestInventoryComponent, Entries);
}