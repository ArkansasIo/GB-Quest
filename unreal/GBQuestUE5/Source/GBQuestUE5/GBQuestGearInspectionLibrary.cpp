#include "GBQuestGearInspectionLibrary.h"
namespace GBQuestGearInspection
{
 static TMap<FName, float> ToStatMap(const FGBQuestGearItem& Item)
 {
  TMap<FName, float> Result;
  for (const FGBQuestGearStatLine& Stat : Item.BaseStats) if (!Stat.StatId.IsNone()) Result.FindOrAdd(Stat.StatId) += Stat.Value;
  for (const FGBQuestGearStatLine& Stat : Item.SubStats) if (!Stat.StatId.IsNone()) Result.FindOrAdd(Stat.StatId) += Stat.Value;
  return Result;
 }
 static float WeightFor(FName Id)
 {
  static const TMap<FName,float> Weights = {
   {FName("Strength"),1.f},{FName("Dexterity"),1.f},{FName("Constitution"),1.f},{FName("Intelligence"),1.f},{FName("Wisdom"),1.f},{FName("Vitality"),1.f},
   {FName("AttackPower"),1.f},{FName("SpellPower"),1.f},{FName("Armor"),0.7f},{FName("MaxHealth"),0.35f},{FName("MaxMana"),0.2f},
   {FName("CriticalChance"),8.f},{FName("CriticalDamage"),0.08f},{FName("AttackSpeed"),5.f},{FName("Haste"),5.f},{FName("Dodge"),4.f},
   {FName("Block"),2.f},{FName("LifeSteal"),4.f},{FName("FireResistance"),0.5f},{FName("ColdResistance"),0.5f},{FName("LightningResistance"),0.5f},{FName("PoisonResistance"),0.5f}
  };
  if (const float* Weight = Weights.Find(Id)) return *Weight;
  return 0.5f;
 }
}
TArray<FGBQuestGearStatDelta> UGBQuestGearInspectionLibrary::CompareGearStats(const FGBQuestGearItem& Candidate, const FGBQuestGearItem& Equipped)
{
 const TMap<FName,float> NewStats = GBQuestGearInspection::ToStatMap(Candidate);
 const TMap<FName,float> OldStats = GBQuestGearInspection::ToStatMap(Equipped);
 TSet<FName> Keys;
 for (const TPair<FName,float>& Pair : NewStats) Keys.Add(Pair.Key);
 for (const TPair<FName,float>& Pair : OldStats) Keys.Add(Pair.Key);
 TArray<FName> SortedKeys = Keys.Array();
 SortedKeys.Sort([](const FName& A,const FName& B){return A.LexicalLess(B);});
 TArray<FGBQuestGearStatDelta> Result;
 for (const FName& Key : SortedKeys)
 {
  FGBQuestGearStatDelta D; D.StatId=Key; D.CandidateValue=NewStats.FindRef(Key); D.EquippedValue=OldStats.FindRef(Key); D.Difference=D.CandidateValue-D.EquippedValue; Result.Add(D);
 }
 return Result;
}
float UGBQuestGearInspectionLibrary::CalculateGearPowerScore(const FGBQuestGearItem& Item)
{
 const TMap<FName,float> Stats=GBQuestGearInspection::ToStatMap(Item); float Score=0.f;
 for(const TPair<FName,float>& Pair:Stats) Score+=Pair.Value*GBQuestGearInspection::WeightFor(Pair.Key);
 return Score+FMath::Max(0,Item.Rarity)*0.25f+FMath::Max(1,Item.ItemLevel)*0.05f;
}
FGBQuestGearInspection UGBQuestGearInspectionLibrary::InspectGear(const FGBQuestGearItem& Candidate,const FGBQuestGearItem& Equipped,int32 CharacterLevel)
{
 FGBQuestGearInspection Result; Result.Item=Candidate; Result.Comparison=CompareGearStats(Candidate,Equipped);
 Result.PowerScore=CalculateGearPowerScore(Candidate); Result.bUpgradeByPowerScore=Result.PowerScore>CalculateGearPowerScore(Equipped);
 Result.bCanEquip=Candidate.RequiredLevel<=FMath::Max(1,CharacterLevel);
 if(!Result.bCanEquip) Result.EquipRestriction=FText::Format(NSLOCTEXT("GBQuestGear","LevelRequirement","Requires character level {0}"),FText::AsNumber(Candidate.RequiredLevel));
 return Result;
}