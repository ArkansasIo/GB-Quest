#pragma once
#include "CoreMinimal.h"
#include "GameFramework/PlayerController.h"
#include "GBQPlayerController.generated.h"
UCLASS(Blueprintable)
class GBQUEST_API AGBQPlayerController : public APlayerController
{
    GENERATED_BODY()
protected:
    virtual void BeginPlay() override;
};
