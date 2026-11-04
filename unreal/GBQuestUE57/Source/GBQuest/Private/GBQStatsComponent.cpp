#include "GBQStatsComponent.h"
int32 UGBQStatsComponent::GetModifier(int32 Score) const { return FMath::FloorToInt((Score-10)/2.0f); }
int32 UGBQStatsComponent::GetProficiencyBonus(int32 Level) const { return 2+FMath::FloorToInt((FMath::Clamp(Level,1,720)-1)/4.0f); }
float UGBQStatsComponent::GetResource(EGBQResourceType Type) const { for(const FGBQResourcePool& R:Resources) if(R.Type==Type) return R.Current; return 0.f; }
bool UGBQStatsComponent::ModifyResource(EGBQResourceType Type,float Delta) { for(FGBQResourcePool& R:Resources) if(R.Type==Type) { R.Current=FMath::Clamp(R.Current+Delta,0.f,R.Maximum); OnResourceChanged.Broadcast(Type,R.Current); return true; } return false; }
