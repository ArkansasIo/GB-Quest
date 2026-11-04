#include "GBQuestGameMode.h"
#include "GBQuestBrowserWidget.h"
#include "GameFramework/PlayerController.h"
#include "Blueprint/UserWidget.h"

AGBQuestGameMode::AGBQuestGameMode()
{
	DefaultPawnClass = nullptr;
}

void AGBQuestGameMode::BeginPlay()
{
	Super::BeginPlay();
	APlayerController* PlayerController = GetWorld() ? GetWorld()->GetFirstPlayerController() : nullptr;
	if (!PlayerController) return;

	UGBQuestBrowserWidget* GameWidget = CreateWidget<UGBQuestBrowserWidget>(PlayerController, UGBQuestBrowserWidget::StaticClass());
	if (!GameWidget) return;
	GameWidget->AddToViewport(0);
	FInputModeUIOnly InputMode;
	InputMode.SetWidgetToFocus(GameWidget->TakeWidget());
	PlayerController->SetInputMode(InputMode);
	PlayerController->bShowMouseCursor = true;
}
