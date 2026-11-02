#include "gbquest/core.hpp"

#include <algorithm>
#include <limits>
#include <stdexcept>

namespace gbquest {
namespace {

[[nodiscard]] constexpr std::int32_t clamp_to_i32(std::int64_t value) noexcept {
  return static_cast<std::int32_t>(std::clamp(
      value,
      static_cast<std::int64_t>(std::numeric_limits<std::int32_t>::min()),
      static_cast<std::int64_t>(std::numeric_limits<std::int32_t>::max())));
}

#ifndef GBQ_HAS_X86_64_ASM
[[nodiscard]] constexpr std::int32_t portable_ability_modifier(std::int32_t score) noexcept {
  const std::int64_t delta = static_cast<std::int64_t>(score) - 10;
  // C++ signed division truncates toward zero; D&D modifiers require floor.
  const std::int64_t quotient = delta / 2;
  const std::int64_t remainder = delta % 2;
  return static_cast<std::int32_t>(quotient - (remainder < 0 ? 1 : 0));
}
#else
extern "C" std::int32_t gbq_ability_modifier_asm(std::int32_t score) noexcept;
#endif

} // namespace

std::int32_t ability_modifier(std::int32_t score) noexcept {
#ifdef GBQ_HAS_X86_64_ASM
  return gbq_ability_modifier_asm(score);
#else
  return portable_ability_modifier(score);
#endif
}

std::int32_t proficiency_bonus(std::int32_t character_level) {
  if (character_level < 1 || character_level > 20) {
    throw std::out_of_range("D&D character level must be between 1 and 20");
  }
  return 2 + ((character_level - 1) / 4);
}

std::int32_t armor_class(const ArmorClassInput& input) noexcept {
  std::int32_t dexterity = ability_modifier(input.dexterity_score);
  if (input.has_dexterity_cap) {
    dexterity = std::min(dexterity, input.dexterity_cap);
  }

  const std::int64_t total = static_cast<std::int64_t>(input.armor_base)
      + dexterity
      + input.shield_bonus
      + input.other_bonus;
  return clamp_to_i32(total);
}

AttackResult resolve_attack(const AttackInput& input) {
  if (input.natural_roll < 1 || input.natural_roll > 20) {
    throw std::out_of_range("Natural attack roll must be between 1 and 20");
  }
  if (input.proficiency < 0) {
    throw std::invalid_argument("Proficiency bonus cannot be negative");
  }

  const std::int64_t total = static_cast<std::int64_t>(input.natural_roll)
      + ability_modifier(input.ability_score)
      + input.proficiency
      + input.bonus;
  const auto bounded_total = clamp_to_i32(total);
  const bool critical = input.natural_roll == 20;
  const bool fumble = input.natural_roll == 1;
  const bool hit = critical || (!fumble && bounded_total >= input.target_armor_class);

  return AttackResult{
      .natural_roll = input.natural_roll,
      .total = bounded_total,
      .hit = hit,
      .critical = critical,
      .fumble = fumble,
  };
}

} // namespace gbquest
