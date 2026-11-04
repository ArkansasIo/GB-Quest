#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "GBQuestAttributeComponent.generated.h"

USTRUCT(BlueprintType)
struct FGBQuestPrimaryAttributes
{
    GENERATED_BODY()
    UPROPERTY(EditAnywhere, BlueprintReadWrite) float Strength = 10.f;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) float Dexterity = 10.f;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) float Constitution = 10.f;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) float Intelligence = 10.f;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) float Wisdom = 10.f;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) float Vitality = 10.f;
};

UCLASS(ClassGroup=(GBQuest), meta=(BlueprintSpawnableComponent))
class GBQUEST_API UGBQuestAttributeComponent : public UActorComponent
{
    GENERATED_BODY()
public:
    UGBQuestAttributeComponent();
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Replicated, Category="Stats")
    FGBQuestPrimaryAttributes Primary;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Replicated, Category="Stats")
    float Health = 100.f;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Replicated, Category="Stats")
    float MaxHealth = 100.f;
    UFUNCTION(BlueprintCallable, BlueprintAuthorityOnly, Category="Stats")
    void ApplyDamage(float Amount);
    UFUNCTION(BlueprintCallable, BlueprintAuthorityOnly, Category="Stats")
    void RestoreHealth(float Amount);
    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
};