#pragma once
#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "GBQItemData.h"
#include "GBQInventoryComponent.generated.h"
USTRUCT(BlueprintType) struct FGBQInventoryEntry { GENERATED_BODY() UPROPERTY(EditAnywhere,BlueprintReadWrite) TObjectPtr<UGBQItemData> Item=nullptr; UPROPERTY(EditAnywhere,BlueprintReadWrite) int32 Quantity=1; };
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FGBQInventoryChanged);
UCLASS(ClassGroup=(GBQuest),meta=(BlueprintSpawnableComponent),BlueprintType) class GBQUESTUE5_API UGBQInventoryComponent:public UActorComponent { GENERATED_BODY() public: UPROPERTY(EditAnywhere,BlueprintReadWrite) int32 Capacity=40; UPROPERTY(VisibleAnywhere,BlueprintReadOnly) TArray<FGBQInventoryEntry> Entries; UPROPERTY(BlueprintAssignable) FGBQInventoryChanged OnInventoryChanged; UFUNCTION(BlueprintCallable) bool AddItem(UGBQItemData* Item,int32 Quantity=1); UFUNCTION(BlueprintCallable) bool RemoveItem(FName ItemId,int32 Quantity=1); };
