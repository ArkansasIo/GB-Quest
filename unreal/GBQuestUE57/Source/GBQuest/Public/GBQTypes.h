#pragma once
#include "CoreMinimal.h"
#include "GBQTypes.generated.h"

UENUM(BlueprintType)
enum class EGBQRarity : uint8 { Poor, Common, Uncommon, Rare, Epic, Legendary };
UENUM(BlueprintType)
enum class EGBQDamageType : uint8 { Physical, Fire, Cold, Lightning, Poison, Acid, Necrotic, Radiant, Psychic, Force, Thunder, Bleed, Arcane };
UENUM(BlueprintType)
enum class EGBQResourceType : uint8 { Health, Mana, Stamina, Energy, Rage, Focus };

USTRUCT(BlueprintType)
struct FGBQAbilityScores
{
    GENERATED_BODY()
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Attributes", meta=(ClampMin="1")) int32 STR=10;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Attributes", meta=(ClampMin="1")) int32 DEX=10;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Attributes", meta=(ClampMin="1")) int32 CON=10;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Attributes", meta=(ClampMin="1")) int32 INT=10;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Attributes", meta=(ClampMin="1")) int32 WIS=10;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Attributes", meta=(ClampMin="1")) int32 CHA=10;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Attributes", meta=(ClampMin="1")) int32 LCK=10;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Attributes", meta=(ClampMin="1")) int32 WIL=10;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Attributes", meta=(ClampMin="1")) int32 SPD=10;
};
USTRUCT(BlueprintType)
struct FGBQResourcePool
{
    GENERATED_BODY()
    UPROPERTY(EditAnywhere, BlueprintReadWrite) EGBQResourceType Type=EGBQResourceType::Health;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, meta=(ClampMin="0")) float Current=100.f;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, meta=(ClampMin="0")) float Maximum=100.f;
};
USTRUCT(BlueprintType)
struct FGBQCombatResult
{
    GENERATED_BODY()
    UPROPERTY(BlueprintReadOnly) bool bHit=false;
    UPROPERTY(BlueprintReadOnly) bool bCritical=false;
    UPROPERTY(BlueprintReadOnly) int32 NaturalRoll=0;
    UPROPERTY(BlueprintReadOnly) int32 TotalRoll=0;
    UPROPERTY(BlueprintReadOnly) float Damage=0.f;
    UPROPERTY(BlueprintReadOnly) EGBQDamageType DamageType=EGBQDamageType::Physical;
};
