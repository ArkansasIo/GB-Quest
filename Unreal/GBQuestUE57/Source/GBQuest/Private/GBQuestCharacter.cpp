#include "GBQuestCharacter.h"
#include "GBQuestAttributeComponent.h"
#include "GBQuestInventoryComponent.h"

AGBQuestCharacter::AGBQuestCharacter()
{
    bReplicates = true;
    SetReplicateMovement(true);
    Attributes = CreateDefaultSubobject<UGBQuestAttributeComponent>(TEXT("Attributes"));
    Inventory = CreateDefaultSubobject<UGBQuestInventoryComponent>(TEXT("Inventory"));
}