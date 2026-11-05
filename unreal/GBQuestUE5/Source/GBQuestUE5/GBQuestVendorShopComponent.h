#pragma once
#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "GBQuestGearInspectionTypes.h"
#include "GBQuestVendorShopComponent.generated.h"
USTRUCT(BlueprintType)
struct FGBQuestVendorStockEntry
{
 GENERATED_BODY()
 UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Vendor") FGBQuestGearItem Item;
 UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Vendor", meta=(ClampMin="0")) int32 Stock=-1;
 UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Vendor", meta=(ClampMin="0.01")) float BuyPriceMultiplier=1.25f;
 UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Vendor", meta=(ClampMin="0.01")) float SellPriceMultiplier=0.5f;
};
USTRUCT(BlueprintType)
struct FGBQuestVendorQuote
{
 GENERATED_BODY()
 UPROPERTY(BlueprintReadOnly, Category="Vendor") FGBQuestGearItem Item;
 UPROPERTY(BlueprintReadOnly, Category="Vendor") int32 Price=0;
 UPROPERTY(BlueprintReadOnly, Category="Vendor") bool bCanPurchase=false;
 UPROPERTY(BlueprintReadOnly, Category="Vendor") FText Reason;
};
UCLASS(ClassGroup=(GBQuest), BlueprintType, Blueprintable, meta=(BlueprintSpawnableComponent))
class GBQUESTUE5_API UGBQuestVendorShopComponent : public UActorComponent
{
 GENERATED_BODY()
public:
 UGBQuestVendorShopComponent();
 UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Vendor") TArray<FGBQuestVendorStockEntry> Stock;
 UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Vendor") FText VendorName;
 UFUNCTION(BlueprintPure, Category="GBQuest|Vendor") TArray<FGBQuestVendorQuote> GetPurchaseQuotes(int32 CharacterLevel,int32 AvailableGold) const;
 UFUNCTION(BlueprintPure, Category="GBQuest|Vendor") FGBQuestVendorQuote GetSellQuote(const FGBQuestGearItem& Item) const;
 UFUNCTION(BlueprintCallable, Category="GBQuest|Vendor") bool TryPurchase(FName ItemId,int32 CharacterLevel,int32& InOutGold,FGBQuestGearItem& OutPurchasedItem,FText& OutReason);
};