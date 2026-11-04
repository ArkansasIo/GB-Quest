#pragma once
#include "CoreMinimal.h"
#include "Engine/PrimaryDataAsset.h"
#include "GBQTypes.h"
#include "GBQCharacterData.generated.h"
UCLASS(BlueprintType) class GBQUESTUE5_API UGBQCharacterData:public UPrimaryDataAsset { GENERATED_BODY() public: UPROPERTY(EditDefaultsOnly,BlueprintReadOnly) FName SpeciesId; UPROPERTY(EditDefaultsOnly,BlueprintReadOnly) FName ClassId; UPROPERTY(EditDefaultsOnly,BlueprintReadOnly) FName SubclassId; UPROPERTY(EditDefaultsOnly,BlueprintReadOnly) FText DisplayName; UPROPERTY(EditDefaultsOnly,BlueprintReadOnly) int32 LevelCap=720; UPROPERTY(EditDefaultsOnly,BlueprintReadOnly) FGBQAbilityScores BaseAttributes; UPROPERTY(EditDefaultsOnly,BlueprintReadOnly) TObjectPtr<UTexture2D> Portrait=nullptr; };
