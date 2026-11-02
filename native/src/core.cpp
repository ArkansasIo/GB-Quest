#include "gbquest/core.hpp"

#include <algorithm>
#include <charconv>
#include <string>
#include <system_error>
#include <utility>
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


DiceExpression parse_dice_expression(std::string_view expression) {
  if (expression.empty()) {
    throw std::invalid_argument("Dice expression cannot be empty");
  }

  const auto d_position = expression.find_first_of("dD");
  if (d_position == std::string_view::npos
      || expression.find_first_of("dD", d_position + 1) != std::string_view::npos) {
    throw std::invalid_argument("Dice expression must contain exactly one d");
  }

  const auto parse_integer = [](std::string_view text, const char* field) -> std::int32_t {
    if (text.empty()) {
      throw std::invalid_argument(std::string("Missing ") + field + " in dice expression");
    }
    std::int32_t value{};
    const auto [end, error] = std::from_chars(text.data(), text.data() + text.size(), value);
    if (error != std::errc{} || end != text.data() + text.size()) {
      throw std::invalid_argument(std::string("Invalid ") + field + " in dice expression");
    }
    return value;
  };

  const auto count_text = expression.substr(0, d_position);
  const std::int32_t count = count_text.empty() ? 1 : parse_integer(count_text, "count");
  const auto remainder = expression.substr(d_position + 1);
  const auto modifier_position = remainder.find_first_of("+-");
  const auto sides_text = modifier_position == std::string_view::npos
      ? remainder : remainder.substr(0, modifier_position);
  const std::int32_t sides = parse_integer(sides_text, "sides");

  std::int32_t modifier = 0;
  if (modifier_position != std::string_view::npos) {
    const auto modifier_text = remainder.substr(modifier_position);
    if (modifier_text.size() < 2) {
      throw std::invalid_argument("Dice modifier requires digits");
    }
    modifier = modifier_text.front() == '+'
        ? parse_integer(modifier_text.substr(1), "modifier")
        : parse_integer(modifier_text, "modifier");
  }

  if (count < 1 || count > 100 || sides < 2 || sides > 1000) {
    throw std::out_of_range("Dice expression is outside supported limits");
  }
  return DiceExpression{.count = count, .sides = sides, .modifier = modifier};
}

DiceResult resolve_dice(
    const DiceExpression& expression,
    std::span<const std::int32_t> faces,
    bool critical) {
  if (expression.count < 1 || expression.count > 100
      || expression.sides < 2 || expression.sides > 1000) {
    throw std::out_of_range("Dice expression is outside supported limits");
  }

  const std::size_t expected_faces = static_cast<std::size_t>(expression.count)
      * (critical ? 2U : 1U);
  if (faces.size() != expected_faces) {
    throw std::invalid_argument("Incorrect number of pre-rolled dice faces");
  }

  std::int64_t total = expression.modifier;
  for (const std::int32_t face : faces) {
    if (face < 1 || face > expression.sides) {
      throw std::out_of_range("Die face is outside the expression's range");
    }
    total += face;
  }

  std::vector<std::int32_t> rolls(faces.begin(), faces.end());
  return DiceResult{
      .rolls = std::move(rolls),
      .modifier = expression.modifier,
      .total = clamp_to_i32(total),
  };
}

DamageResult resolve_damage(const DiceResult& dice, const DamageInput& input) {
  if (input.damage_type.empty()) {
    throw std::invalid_argument("Damage type cannot be empty");
  }

  std::int64_t amount = static_cast<std::int64_t>(dice.total) + input.flat_modifier;
  switch (input.disposition) {
    case DamageDisposition::normal:
      break;
    case DamageDisposition::resistance:
      amount /= 2;
      break;
    case DamageDisposition::vulnerability:
      amount *= 2;
      break;
    case DamageDisposition::immunity:
      amount = 0;
      break;
    default:
      throw std::invalid_argument("Unknown damage disposition");
  }

  amount = std::max<std::int64_t>(0, amount);
  return DamageResult{
      .amount = clamp_to_i32(amount),
      .damage_type = std::string(input.damage_type),
      .critical = input.critical,
      .disposition = input.disposition,
  };
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
