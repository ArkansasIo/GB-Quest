#pragma once
#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "GBQuestRPGTypes.h"
#include "GBQuestStatsComponent.generated.h"
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FGBQuestHealthChanged, float, CurrentHealth, float, MaxHealth);
UCLASS(ClassGroup=(GBQuest), BlueprintType, Blueprintable, meta=(BlueprintSpawnableComponent))
class GBQUESTUE5_API UGBQuestStatsComponent : public UActorComponent
{
    GENERATED_BODY()
public:
    UGBQuestStatsComponent();
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Stats") FGBQuestPrimaryAttributes Attributes;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Stats", meta=(ClampMin="0")) float BonusMaxHealth = 0.f;
    UPROPERTY(BlueprintReadOnly, Category="Stats") float CurrentHealth = 0.f;
    UPROPERTY(BlueprintAssignable, Category="Stats") FGBQuestHealthChanged OnHealthChanged;
    UFUNCTION(BlueprintPure, Category="Stats") float GetMaxHealth() const;
    UFUNCTION(BlueprintPure, Category="Stats") bool IsDefeated() const { return CurrentHealth <= 0.f; }
    UFUNCTION(BlueprintCallable, Category="Stats") float ApplyDamage(float Amount);
    UFUNCTION(BlueprintCallable, Category="Stats") float RestoreHealth(float Amount);
    UFUNCTION(BlueprintCallable, Category="Stats") void ResetHealth();
protected:
    virtual void BeginPlay() override;
};