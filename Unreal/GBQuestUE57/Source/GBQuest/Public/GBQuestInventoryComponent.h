#pragma once
#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "GBQuestInventoryComponent.generated.h"

USTRUCT(BlueprintType)
struct FGBQuestInventoryEntry
{
    GENERATED_BODY()
    UPROPERTY(EditAnywhere, BlueprintReadWrite) FName ItemId = NAME_None;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) int32 Quantity = 0;
};

UCLASS(ClassGroup=(GBQuest), meta=(BlueprintSpawnableComponent))
class GBQUEST_API UGBQuestInventoryComponent : public UActorComponent
{
    GENERATED_BODY()
public:
    UGBQuestInventoryComponent();
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Replicated, Category="Inventory")
    TArray<FGBQuestInventoryEntry> Entries;
    UFUNCTION(BlueprintCallable, BlueprintAuthorityOnly, Category="Inventory")
    bool AddItem(FName ItemId, int32 Quantity);
    UFUNCTION(BlueprintCallable, BlueprintAuthorityOnly, Category="Inventory")
    bool RemoveItem(FName ItemId, int32 Quantity);
    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
};