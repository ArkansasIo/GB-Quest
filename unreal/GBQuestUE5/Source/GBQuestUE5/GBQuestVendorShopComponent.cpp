#include "GBQuestVendorShopComponent.h"
UGBQuestVendorShopComponent::UGBQuestVendorShopComponent()
{
 PrimaryComponentTick.bCanEverTick=false; VendorName=NSLOCTEXT("GBQuestVendor","DefaultVendor","Merchant");
}
TArray<FGBQuestVendorQuote> UGBQuestVendorShopComponent::GetPurchaseQuotes(int32 CharacterLevel,int32 AvailableGold) const
{
 TArray<FGBQuestVendorQuote> Quotes;
 for(const FGBQuestVendorStockEntry& Entry:Stock)
 {
  FGBQuestVendorQuote Q; Q.Item=Entry.Item; Q.Price=FMath::Max(1,FMath::RoundToInt(Entry.Item.VendorValue*FMath::Max(0.01f,Entry.BuyPriceMultiplier)));
  Q.bCanPurchase=Entry.Stock!=0&&Entry.Item.RequiredLevel<=CharacterLevel&&AvailableGold>=Q.Price;
  if(Entry.Stock==0) Q.Reason=NSLOCTEXT("GBQuestVendor","OutOfStock","Out of stock");
  else if(Entry.Item.RequiredLevel>CharacterLevel) Q.Reason=NSLOCTEXT("GBQuestVendor","LevelTooLow","Character level too low");
  else if(AvailableGold<Q.Price) Q.Reason=NSLOCTEXT("GBQuestVendor","NotEnoughGold","Not enough gold");
  Quotes.Add(Q);
 }
 return Quotes;
}
FGBQuestVendorQuote UGBQuestVendorShopComponent::GetSellQuote(const FGBQuestGearItem& Item) const
{
 FGBQuestVendorQuote Q; Q.Item=Item; Q.Price=FMath::Max(0,FMath::RoundToInt(Item.VendorValue*0.5f)); Q.bCanPurchase=Item.VendorValue>0;
 if(!Q.bCanPurchase) Q.Reason=NSLOCTEXT("GBQuestVendor","CannotSell","This item has no vendor resale value");
 return Q;
}
bool UGBQuestVendorShopComponent::TryPurchase(FName ItemId,int32 CharacterLevel,int32& InOutGold,FGBQuestGearItem& OutPurchasedItem,FText& OutReason)
{
 FGBQuestVendorStockEntry* Entry=Stock.FindByPredicate([ItemId](const FGBQuestVendorStockEntry& E){return E.Item.ItemId==ItemId;});
 if(!Entry){OutReason=NSLOCTEXT("GBQuestVendor","MissingItem","Item is not sold by this vendor");return false;}
 const int32 Price=FMath::Max(1,FMath::RoundToInt(Entry->Item.VendorValue*FMath::Max(0.01f,Entry->BuyPriceMultiplier)));
 if(Entry->Stock==0){OutReason=NSLOCTEXT("GBQuestVendor","SoldOut","Out of stock");return false;}
 if(Entry->Item.RequiredLevel>CharacterLevel){OutReason=NSLOCTEXT("GBQuestVendor","LevelGate","Character level too low");return false;}
 if(InOutGold<Price){OutReason=NSLOCTEXT("GBQuestVendor","Funds","Not enough gold");return false;}
 InOutGold-=Price; if(Entry->Stock>0)--Entry->Stock; OutPurchasedItem=Entry->Item; OutReason=FText::GetEmpty(); return true;
}