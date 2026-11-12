#pragma once
#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "GBQuestCharacter.generated.h"

class UGBQuestAttributeComponent;
class UGBQuestInventoryComponent;

UCLASS(Blueprintable)
class GBQUEST_API AGBQuestCharacter : public ACharacter
{
    GENERATED_BODY()
public:
    AGBQuestCharacter();
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="GBQuest|Components")
    TObjectPtr<UGBQuestAttributeComponent> Attributes;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="GBQuest|Components")
    TObjectPtr<UGBQuestInventoryComponent> Inventory;
};