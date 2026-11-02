#pragma once

#include <array>
#include <cstdint>
#include <span>
#include <string>
#include <string_view>
#include <vector>

namespace gbquest {

enum class Ability : std::uint8_t {
  strength,
  dexterity,
  constitution,
  intelligence,
  wisdom,
  charisma
};



struct ItemDefinition {
  std::string id;
  std::int32_t weight_grams{0};
  std::int32_t max_stack{1};
};

struct ItemStack {
  std::string item_id;
  std::int32_t quantity{0};
};

struct InventoryState {
  std::vector<ItemStack> items;
  std::int32_t slot_capacity{20};
  std::int64_t weight_capacity_grams{30000};
};

struct InventoryResult {
  bool success{};
  std::int32_t quantity_changed{};
  std::int64_t total_weight_grams{};
  std::string reason;
};

// Inventory changes are transactional: failure leaves the original inventory unchanged.
[[nodiscard]] InventoryResult add_item(
    InventoryState& inventory,
    const ItemDefinition& definition,
    std::int32_t quantity);

[[nodiscard]] InventoryResult remove_item(
    InventoryState& inventory,
    std::string_view item_id,
    std::int32_t quantity,
    const ItemDefinition& definition);

[[nodiscard]] std::int64_t inventory_weight(
    const InventoryState& inventory,
    std::span<const ItemDefinition> definitions);

struct AbilityScores {
  std::array<std::int32_t, 6> values{10, 10, 10, 10, 10, 10};
};

struct PassiveScoreInput {
  std::int32_t ability_score{10};
  std::int32_t character_level{1};
  bool proficient{false};
  std::int32_t bonus{0};
};

struct ArmorClassInput {
  std::int32_t armor_base{10};
  std::int32_t dexterity_score{10};
  std::int32_t shield_bonus{0};
  std::int32_t other_bonus{0};
  std::int32_t dexterity_cap{0};
  bool has_dexterity_cap{false};
};

struct AttackInput {
  std::int32_t natural_roll{1};
  std::int32_t ability_score{10};
  std::int32_t proficiency{0};
  std::int32_t bonus{0};
  std::int32_t target_armor_class{10};
};

struct AttackResult {
  std::int32_t natural_roll{};
  std::int32_t total{};
  bool hit{};
  bool critical{};
  bool fumble{};
};

// Uses the x86-64 assembly implementation when the build target supports it;
// otherwise uses the equivalent portable C++23 implementation.
[[nodiscard]] std::int32_t ability_modifier(std::int32_t score) noexcept;


[[nodiscard]] std::int32_t ability_score(
    const AbilityScores& scores, Ability ability);

// Validates all six scores against the supported 1..30 range.
void validate_ability_scores(const AbilityScores& scores);

// Passive score: 10 + ability modifier + proficiency when proficient + bonus.
[[nodiscard]] std::int32_t passive_score(const PassiveScoreInput& input);

// D&D character-level proficiency progression, levels 1 through 20.
[[nodiscard]] std::int32_t proficiency_bonus(std::int32_t character_level);

// Computes AC from armor, Dexterity, shield and other bonuses.
// A Dexterity cap is optional and applies to the Dexterity modifier.
[[nodiscard]] std::int32_t armor_class(const ArmorClassInput& input) noexcept;

// Resolves one already-rolled d20 attack. Random-number generation deliberately
// remains outside this deterministic rules library.
[[nodiscard]] AttackResult resolve_attack(const AttackInput& input);


struct DiceExpression {
  std::int32_t count{};
  std::int32_t sides{};
  std::int32_t modifier{};
};

struct DiceResult {
  std::vector<std::int32_t> rolls;
  std::int32_t modifier{};
  std::int32_t total{};
};

enum class DamageDisposition : std::uint8_t {
  normal,
  resistance,
  vulnerability,
  immunity
};

struct DamageInput {
  std::string_view damage_type;
  DamageDisposition disposition{DamageDisposition::normal};
  std::int32_t flat_modifier{0};
  bool critical{false};
};

struct HealthState {
  std::int32_t hit_points{};
  std::int32_t maximum_hit_points{};
  std::int32_t temporary_hit_points{};
  bool defeated{false};
};

struct HealthChangeResult {
  std::int32_t requested{};
  std::int32_t applied{};
  std::int32_t hit_points_remaining{};
  std::int32_t temporary_hit_points_remaining{};
  bool defeated{};
};

struct DamageResult {
  std::int32_t amount{};
  std::string damage_type;
  bool critical{};
  DamageDisposition disposition{DamageDisposition::normal};
};

// Applies damage to temporary HP first, then current HP. Amount must be non-negative.
[[nodiscard]] HealthChangeResult apply_damage(HealthState& target, std::int32_t amount);

// Restores HP up to maximum HP. Temporary HP is not affected.
[[nodiscard]] HealthChangeResult apply_healing(HealthState& target, std::int32_t amount);

// Supported notation: NdS, dS, NdS+M and NdS-M.
// Count is limited to 1..100 and sides to 2..1000.
[[nodiscard]] DiceExpression parse_dice_expression(std::string_view expression);

// Faces are supplied by the caller (normally authoritative server RNG).
// The number of supplied faces must equal count, or 2*count for a critical.
[[nodiscard]] DiceResult resolve_dice(
    const DiceExpression& expression,
    std::span<const std::int32_t> faces,
    bool critical = false);

// Applies one already-resolved resistance/vulnerability/immunity disposition.
// Critical damage doubles dice only; the flat modifier is applied once.
[[nodiscard]] DamageResult resolve_damage(
    const DiceResult& dice,
    const DamageInput& input);

} // namespace gbquest
