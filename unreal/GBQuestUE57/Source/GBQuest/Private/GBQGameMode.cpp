#include "GBQGameMode.h"
#include "GBQPlayerController.h"
#include "GBQCharacter.h"
AGBQGameMode::AGBQGameMode()
{
    PlayerControllerClass=AGBQPlayerController::StaticClass();
    DefaultPawnClass=AGBQCharacter::StaticClass();
}
