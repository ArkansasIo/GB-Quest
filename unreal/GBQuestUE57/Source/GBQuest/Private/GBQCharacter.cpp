#include "GBQCharacter.h"
#include "GBQStatsComponent.h"
#include "GBQCombatComponent.h"
AGBQCharacter::AGBQCharacter() { PrimaryActorTick.bCanEverTick=false; Stats=CreateDefaultSubobject<UGBQStatsComponent>(TEXT("Stats")); Combat=CreateDefaultSubobject<UGBQCombatComponent>(TEXT("Combat")); }
