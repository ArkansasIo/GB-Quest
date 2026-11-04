#pragma once
#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "GBQItemData.h"
#include "GBQInventoryComponent.generated.h"
USTRUCT(BlueprintType)
struct FGBQInventoryEntry
{
    GENERATED_BODY()
    UPROPERTY(EditAnywhere,BlueprintReadWrite) TObjectPtr<UGBQItemData> Item=nullptr;
    UPROPERTY(EditAnywhere,BlueprintReadWrite,meta=(ClampMin="1")) int32 Quantity=1;
};
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FGBQInventoryChanged);
UCLASS(ClassGroup=(GBQuest),BlueprintType,Blueprintable,meta=(BlueprintSpawnableComponent))
class GBQUEST_API UGBQInventoryComponent : public UActorComponent
{
    GENERATED_BODY()
public:
    UPROPERTY(EditAnywhere,BlueprintReadWrite,Category="Inventory") int32 Capacity=40;
    UPROPERTY(VisibleAnywhere,BlueprintReadOnly,Category="Inventory") TArray<FGBQInventoryEntry> Entries;
    UPROPERTY(BlueprintAssignable,Category="Inventory") FGBQInventoryChanged OnInventoryChanged;
    UFUNCTION(BlueprintCallable,Category="Inventory") bool AddItem(UGBQItemData* Item,int32 Quantity=1);
    UFUNCTION(BlueprintCallable,Category="Inventory") bool RemoveItem(FName ItemId,int32 Quantity=1);
};
