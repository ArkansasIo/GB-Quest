#pragma once
#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "GBQuestRPGTypes.h"
#include "GBQuestInventoryComponent.generated.h"
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FGBQuestInventoryChanged, FName, ItemId, int32, TotalQuantity);
UCLASS(ClassGroup=(GBQuest), BlueprintType, Blueprintable, meta=(BlueprintSpawnableComponent))
class GBQUESTUE5_API UGBQuestInventoryComponent : public UActorComponent
{
    GENERATED_BODY()
public:
    UGBQuestInventoryComponent();
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Inventory", meta=(ClampMin="1")) int32 SlotCapacity = 40;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="Inventory") TArray<FGBQuestItemStack> Items;
    UPROPERTY(BlueprintAssignable, Category="Inventory") FGBQuestInventoryChanged OnInventoryChanged;
    UFUNCTION(BlueprintCallable, Category="Inventory") bool AddItem(FName ItemId, int32 Quantity, int32 MaxStack = 99);
    UFUNCTION(BlueprintCallable, Category="Inventory") bool RemoveItem(FName ItemId, int32 Quantity);
    UFUNCTION(BlueprintPure, Category="Inventory") int32 GetItemCount(FName ItemId) const;
    UFUNCTION(BlueprintPure, Category="Inventory") bool HasItem(FName ItemId, int32 Quantity = 1) const;
};