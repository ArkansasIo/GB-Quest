#include "GBQuestVendorShopComponent.h"
#include <cmath>

namespace
{
int32 CalculatePurchasePrice(const FGBQuestVendorStockEntry& Entry)
{
 if(Entry.Item.VendorValue<=0||!FMath::IsFinite(Entry.BuyPriceMultiplier)||Entry.BuyPriceMultiplier<=0.f) return 0;
 const double RawPrice=std::ceil(static_cast<double>(Entry.Item.VendorValue)*static_cast<double>(Entry.BuyPriceMultiplier));
 if(RawPrice>static_cast<double>(MAX_int32)) return 0;
 return FMath::Max(1,static_cast<int32>(RawPrice));
}
}

UGBQuestVendorShopComponent::UGBQuestVendorShopComponent()
{
 PrimaryComponentTick.bCanEverTick=false;
 VendorName=NSLOCTEXT("GBQuestVendor","DefaultVendor","Merchant");
}

TArray<FGBQuestVendorQuote> UGBQuestVendorShopComponent::GetPurchaseQuotes(int32 CharacterLevel,int32 AvailableGold) const
{
 TArray<FGBQuestVendorQuote> Quotes;
 for(const FGBQuestVendorStockEntry& Entry:Stock)
 {
  FGBQuestVendorQuote Q;
  Q.Item=Entry.Item;
  Q.Price=CalculatePurchasePrice(Entry);
  Q.bCanPurchase=Q.Price>0&&Entry.Stock!=0&&Entry.Stock>=-1&&Entry.Item.RequiredLevel<=CharacterLevel&&AvailableGold>=Q.Price;
  if(Entry.Stock==0) Q.Reason=NSLOCTEXT("GBQuestVendor","OutOfStock","Out of stock");
  else if(Entry.Stock < -1) Q.Reason=NSLOCTEXT("GBQuestVendor","InvalidStock","Vendor stock configuration is invalid");
  else if(Q.Price==0) Q.Reason=NSLOCTEXT("GBQuestVendor","InvalidPrice","This item has no valid vendor price");
  else if(Entry.Item.RequiredLevel>CharacterLevel) Q.Reason=NSLOCTEXT("GBQuestVendor","LevelTooLow","Character level too low");
  else if(AvailableGold<Q.Price) Q.Reason=NSLOCTEXT("GBQuestVendor","NotEnoughGold","Not enough gold");
  Quotes.Add(Q);
 }
 return Quotes;
}

FGBQuestVendorQuote UGBQuestVendorShopComponent::GetSellQuote(const FGBQuestGearItem& Item) const
{
 FGBQuestVendorQuote Q;
 Q.Item=Item;
 float SellMultiplier=0.5f;
 if(const FGBQuestVendorStockEntry* Entry=Stock.FindByPredicate([&Item](const FGBQuestVendorStockEntry& E){return E.Item.ItemId==Item.ItemId;}))
 {
  SellMultiplier=Entry->SellPriceMultiplier;
 }
 const bool bValidMultiplier=FMath::IsFinite(SellMultiplier)&&SellMultiplier>0.f;
 const double RawPrice=Item.VendorValue>0&&bValidMultiplier?std::floor(static_cast<double>(Item.VendorValue)*static_cast<double>(SellMultiplier)):0.0;
 Q.Price=RawPrice<=static_cast<double>(MAX_int32)?FMath::Max(0,static_cast<int32>(RawPrice)):0;
 Q.bCanSell=Item.VendorValue>0&&bValidMultiplier&&Q.Price>0;
 if(!Q.bCanSell) Q.Reason=NSLOCTEXT("GBQuestVendor","CannotSell","This item has no vendor resale value");
 return Q;
}

bool UGBQuestVendorShopComponent::TryPurchase(FName ItemId,int32 CharacterLevel,int32& InOutGold,FGBQuestGearItem& OutPurchasedItem,FText& OutReason)
{
 FGBQuestVendorStockEntry* Entry=Stock.FindByPredicate([ItemId](const FGBQuestVendorStockEntry& E){return E.Item.ItemId==ItemId;});
 if(!Entry){OutReason=NSLOCTEXT("GBQuestVendor","MissingItem","Item is not sold by this vendor");return false;}
 const int32 Price=CalculatePurchasePrice(*Entry);
 if(Entry->Stock==0){OutReason=NSLOCTEXT("GBQuestVendor","SoldOut","Out of stock");return false;}
 if(Entry->Stock < -1){OutReason=NSLOCTEXT("GBQuestVendor","InvalidStock","Vendor stock configuration is invalid");return false;}
 if(Price<=0){OutReason=NSLOCTEXT("GBQuestVendor","InvalidPrice","This item has no valid vendor price");return false;}
 if(Entry->Item.RequiredLevel>CharacterLevel){OutReason=NSLOCTEXT("GBQuestVendor","LevelGate","Character level too low");return false;}
 if(InOutGold<Price){OutReason=NSLOCTEXT("GBQuestVendor","Funds","Not enough gold");return false;}
 InOutGold-=Price;
 if(Entry->Stock>0)--Entry->Stock;
 OutPurchasedItem=Entry->Item;
 OutReason=FText::GetEmpty();
 return true;
}
