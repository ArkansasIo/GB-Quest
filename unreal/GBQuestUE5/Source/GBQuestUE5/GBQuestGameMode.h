#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "GBQuestGameMode.generated.h"

UCLASS()
class GBQUESTUE5_API AGBQuestGameMode : public AGameModeBase
{
	GENERATED_BODY()

public:
	AGBQuestGameMode();
	virtual void BeginPlay() override;
};
