#include "GBQCombatComponent.h"
FGBQCombatResult UGBQCombatComponent::ResolveAttack(int32 Bonus,int32 AC,float BaseDamage,EGBQDamageType Type,bool bAdvantage,bool bDisadvantage) {
 FGBQCombatResult Out; Out.DamageType=Type; const int32 A=FMath::RandRange(1,20), B=FMath::RandRange(1,20);
 Out.NaturalRoll=(bAdvantage&&!bDisadvantage)?FMath::Max(A,B):((bDisadvantage&&!bAdvantage)?FMath::Min(A,B):A);
 Out.TotalRoll=Out.NaturalRoll+Bonus; Out.bCritical=(Out.NaturalRoll==20); Out.bHit=Out.bCritical||(Out.NaturalRoll!=1&&Out.TotalRoll>=AC);
 Out.Damage=Out.bHit?BaseDamage*(Out.bCritical?2.f:1.f):0.f; OnAttackResolved.Broadcast(Out); return Out;
}
