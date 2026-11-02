#pragma once

#include <cstdint>

namespace gbquest {

enum class Ability : std::uint8_t {
  strength,
  dexterity,
  constitution,
  intelligence,
  wisdom,
  charisma
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

// D&D character-level proficiency progression, levels 1 through 20.
[[nodiscard]] std::int32_t proficiency_bonus(std::int32_t character_level);

// Computes AC from armor, Dexterity, shield and other bonuses.
// A Dexterity cap is optional and applies to the Dexterity modifier.
[[nodiscard]] std::int32_t armor_class(const ArmorClassInput& input) noexcept;

// Resolves one already-rolled d20 attack. Random-number generation deliberately
// remains outside this deterministic rules library.
[[nodiscard]] AttackResult resolve_attack(const AttackInput& input);

} // namespace gbquest
