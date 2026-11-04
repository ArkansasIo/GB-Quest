#pragma once
#include "CoreMinimal.h"
#include "Engine/PrimaryDataAsset.h"
#include "GBQTypes.h"
#include "GBQItemData.generated.h"

UCLASS(BlueprintType)
class GBQUEST_API UGBQItemData : public UPrimaryDataAsset
{
    GENERATED_BODY()
public:
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Item") FName ItemId;
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Item") FText DisplayName;
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Item", meta=(MultiLine=true)) FText Description;
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Item") EGBQRarity Rarity=EGBQRarity::Common;
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Item") FName Slot;
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Stats") int32 ItemLevel=1;
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Stats") int32 RequiredLevel=1;
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Stats") TMap<FName,float> StatBonuses;
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Visuals") TObjectPtr<UTexture2D> Icon=nullptr;
};
