#pragma once
#include "CoreMinimal.h"
#include "Engine/PrimaryDataAsset.h"
#include "GBQTypes.h"
#include "GBQItemData.generated.h"
UCLASS(BlueprintType) class GBQUESTUE5_API UGBQItemData:public UPrimaryDataAsset { GENERATED_BODY() public: UPROPERTY(EditDefaultsOnly,BlueprintReadOnly) FName ItemId; UPROPERTY(EditDefaultsOnly,BlueprintReadOnly) FText DisplayName; UPROPERTY(EditDefaultsOnly,BlueprintReadOnly) FText Description; UPROPERTY(EditDefaultsOnly,BlueprintReadOnly) EGBQRarity Rarity=EGBQRarity::Common; UPROPERTY(EditDefaultsOnly,BlueprintReadOnly) FName EquipmentSlot; UPROPERTY(EditDefaultsOnly,BlueprintReadOnly) int32 RequiredLevel=1; UPROPERTY(EditDefaultsOnly,BlueprintReadOnly) TMap<FName,float> StatBonuses; UPROPERTY(EditDefaultsOnly,BlueprintReadOnly) TObjectPtr<UTexture2D> Icon=nullptr; };
