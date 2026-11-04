#pragma once
#include "CoreMinimal.h"
#include "Engine/PrimaryDataAsset.h"
#include "GBQTypes.h"
#include "GBQCharacterData.generated.h"

UCLASS(BlueprintType)
class GBQUEST_API UGBQCharacterData : public UPrimaryDataAsset
{
    GENERATED_BODY()
public:
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Identity") FName SpeciesId;
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Identity") FText DisplayName;
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Identity") FName ClassId;
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Identity") FName SubclassId;
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Identity", meta=(ClampMin="1",ClampMax="720")) int32 MaxLevel=720;
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Stats") FGBQAbilityScores BaseAttributes;
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Visuals") TObjectPtr<UTexture2D> Portrait=nullptr;
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Visuals") TObjectPtr<UTexture2D> CharacterSprite=nullptr;
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Progression") TArray<FName> StartingAbilities;
};
