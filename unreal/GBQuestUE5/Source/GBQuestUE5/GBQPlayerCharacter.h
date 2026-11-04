#pragma once
#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "GBQPlayerCharacter.generated.h"
class UGBQStatsComponent; class UGBQCombatComponent; class UGBQInventoryComponent;
UCLASS(Blueprintable)
class GBQUESTUE5_API AGBQPlayerCharacter:public ACharacter { GENERATED_BODY() public: AGBQPlayerCharacter(); UPROPERTY(VisibleAnywhere,BlueprintReadOnly) TObjectPtr<UGBQStatsComponent> Stats; UPROPERTY(VisibleAnywhere,BlueprintReadOnly) TObjectPtr<UGBQCombatComponent> Combat; UPROPERTY(VisibleAnywhere,BlueprintReadOnly) TObjectPtr<UGBQInventoryComponent> Inventory; };
