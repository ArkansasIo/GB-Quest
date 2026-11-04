#include "GBQPlayerCharacter.h"
#include "GBQStatsComponent.h"
#include "GBQCombatComponent.h"
#include "GBQInventoryComponent.h"
AGBQPlayerCharacter::AGBQPlayerCharacter() { PrimaryActorTick.bCanEverTick=false; Stats=CreateDefaultSubobject<UGBQStatsComponent>(TEXT("Stats")); Combat=CreateDefaultSubobject<UGBQCombatComponent>(TEXT("Combat")); Inventory=CreateDefaultSubobject<UGBQInventoryComponent>(TEXT("Inventory")); }
