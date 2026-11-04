#include "GBQuestBrowserWidget.h"
#include "Blueprint/WidgetTree.h"
#include "WebBrowser.h"
#include "Misc/Paths.h"

void UGBQuestBrowserWidget::NativeOnInitialized()
{
	Super::NativeOnInitialized();
	if (!WidgetTree) return;
	Browser = WidgetTree->ConstructWidget<UWebBrowser>(UWebBrowser::StaticClass(), TEXT("GBQuestBrowser"));
	WidgetTree->RootWidget = Browser;
}

void UGBQuestBrowserWidget::NativeConstruct()
{
	Super::NativeConstruct();
	if (!Browser) return;
	Browser->LoadURL(GetGamePageUrl());
	Browser->SetFocus();
}

FString UGBQuestBrowserWidget::GetGamePageUrl() const
{
	FString FilePath = FPaths::ConvertRelativePathToFull(FPaths::Combine(FPaths::ProjectDir(), TEXT("WebGame/gbquest-fullscreen.html")));
	FPaths::NormalizeFilename(FilePath);
	FilePath.ReplaceInline(TEXT(" "), TEXT("%20"));
	return FString::Printf(TEXT("file:///%s"), *FilePath);
}
