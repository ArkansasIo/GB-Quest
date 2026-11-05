#include "GBQuestInventoryComponent.h"
UGBQuestInventoryComponent::UGBQuestInventoryComponent() { PrimaryComponentTick.bCanEverTick = false; }
int32 UGBQuestInventoryComponent::GetItemCount(FName ItemId) const
{
    int32 Total = 0;
    for (const FGBQuestItemStack& Stack : Items) if (Stack.ItemId == ItemId) Total += FMath::Max(0, Stack.Quantity);
    return Total;
}
bool UGBQuestInventoryComponent::HasItem(FName ItemId, int32 Quantity) const
{
    return !ItemId.IsNone() && Quantity > 0 && GetItemCount(ItemId) >= Quantity;
}
bool UGBQuestInventoryComponent::AddItem(FName ItemId, int32 Quantity, int32 MaxStack)
{
    if (ItemId.IsNone() || Quantity <= 0 || MaxStack <= 0) return false;
    int32 RemainingCapacity = Quantity;
    for (const FGBQuestItemStack& Stack : Items)
        if (Stack.ItemId == ItemId) RemainingCapacity -= FMath::Max(0, Stack.MaxStack - Stack.Quantity);
    const int32 NeededSlots = RemainingCapacity > 0 ? FMath::DivideAndRoundUp(RemainingCapacity, MaxStack) : 0;
    if (Items.Num() + NeededSlots > FMath::Max(1, SlotCapacity)) return false;
    int32 Remaining = Quantity;
    for (FGBQuestItemStack& Stack : Items)
    {
        if (Stack.ItemId != ItemId || Stack.Quantity >= Stack.MaxStack) continue;
        const int32 Added = FMath::Min(Remaining, Stack.MaxStack - Stack.Quantity);
        Stack.Quantity += Added; Remaining -= Added;
        if (Remaining == 0) break;
    }
    while (Remaining > 0)
    {
        FGBQuestItemStack NewStack;
        NewStack.ItemId = ItemId; NewStack.MaxStack = MaxStack;
        NewStack.Quantity = FMath::Min(Remaining, MaxStack);
        Remaining -= NewStack.Quantity; Items.Add(NewStack);
    }
    OnInventoryChanged.Broadcast(ItemId, GetItemCount(ItemId));
    return true;
}
bool UGBQuestInventoryComponent::RemoveItem(FName ItemId, int32 Quantity)
{
    if (!HasItem(ItemId, Quantity)) return false;
    int32 Remaining = Quantity;
    for (int32 Index = Items.Num() - 1; Index >= 0 && Remaining > 0; --Index)
    {
        FGBQuestItemStack& Stack = Items[Index];
        if (Stack.ItemId != ItemId) continue;
        const int32 Removed = FMath::Min(Remaining, Stack.Quantity);
        Stack.Quantity -= Removed; Remaining -= Removed;
        if (Stack.Quantity <= 0) Items.RemoveAt(Index);
    }
    OnInventoryChanged.Broadcast(ItemId, GetItemCount(ItemId));
    return Remaining == 0;
}