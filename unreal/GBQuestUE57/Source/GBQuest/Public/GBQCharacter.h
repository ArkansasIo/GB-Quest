#pragma once
#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "GBQCharacter.generated.h"
class UGBQStatsComponent;
UCLASS(Blueprintable)
class GBQUEST_API AGBQCharacter : public ACharacter
{
    GENERATED_BODY()
public:
    AGBQCharacter();
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="GBQuest") TObjectPtr<UGBQStatsComponent> Stats;
};
