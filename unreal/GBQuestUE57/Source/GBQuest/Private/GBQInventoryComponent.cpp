#include "GBQInventoryComponent.h"
bool UGBQInventoryComponent::AddItem(UGBQItemData* Item,int32 Qty)
{
    if (!Item||Qty<=0) return false;
    for (auto& E:Entries) if (E.Item&&E.Item->ItemId==Item->ItemId) { E.Quantity+=Qty; OnInventoryChanged.Broadcast(); return true; }
    if (Entries.Num()>=Capacity) return false;
    FGBQInventoryEntry E; E.Item=Item; E.Quantity=Qty; Entries.Add(E); OnInventoryChanged.Broadcast(); return true;
}
bool UGBQInventoryComponent::RemoveItem(FName Id,int32 Qty)
{
    if (Qty<=0) return false;
    for (int32 i=0;i<Entries.Num();++i) if (Entries[i].Item&&Entries[i].Item->ItemId==Id&&Entries[i].Quantity>=Qty) { Entries[i].Quantity-=Qty; if (Entries[i].Quantity==0) Entries.RemoveAt(i); OnInventoryChanged.Broadcast(); return true; }
    return false;
}
