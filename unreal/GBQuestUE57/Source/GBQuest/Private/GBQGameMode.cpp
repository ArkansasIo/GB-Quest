#include "GBQGameMode.h"
#include "GBQCharacter.h"
#include "GBQPlayerController.h"
AGBQGameMode::AGBQGameMode() { DefaultPawnClass=AGBQCharacter::StaticClass(); PlayerControllerClass=AGBQPlayerController::StaticClass(); }
