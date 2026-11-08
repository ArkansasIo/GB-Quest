#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"
#include "GBQuestBrowserWidget.generated.h"

class UWebBrowser;

UCLASS()
class GBQUESTUE5_API UGBQuestBrowserWidget : public UUserWidget
{
	GENERATED_BODY()

protected:
	virtual void NativeOnInitialized() override;
	virtual void NativeConstruct() override;

private:
	UPROPERTY(Transient)
	TObjectPtr<UWebBrowser> Browser;

	FString GetGamePageUrl() const;
};
