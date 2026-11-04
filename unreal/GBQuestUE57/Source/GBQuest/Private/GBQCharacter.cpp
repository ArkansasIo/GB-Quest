#include "GBQCharacter.h"
#include "GBQStatsComponent.h"
AGBQCharacter::AGBQCharacter()
{
    PrimaryActorTick.bCanEverTick=true;
    Stats=CreateDefaultSubobject<UGBQStatsComponent>(TEXT("Stats"));
}
