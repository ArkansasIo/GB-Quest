#include "gbquest/core.hpp"

#include <algorithm>
#include <charconv>
#include <string>
#include <system_error>
#include <utility>
#include <numeric>
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



namespace {

void validate_item_definition(const ItemDefinition& definition) {
  if (definition.id.empty() || definition.weight_grams < 0 || definition.max_stack < 1) {
    throw std::invalid_argument("Invalid item definition");
  }
}

void validate_inventory(const InventoryState& inventory) {
  if (inventory.slot_capacity < 0 || inventory.weight_capacity_grams < 0
      || inventory.current_weight_grams < 0
      || inventory.current_weight_grams > inventory.weight_capacity_grams
      || inventory.items.size() > static_cast<std::size_t>(inventory.slot_capacity)) {
    throw std::invalid_argument("Invalid inventory state");
  }
  for (const auto& stack : inventory.items) {
    if (stack.item_id.empty() || stack.quantity < 1) {
      throw std::invalid_argument("Invalid inventory stack");
    }
  }
}

[[nodiscard]] InventoryResult inventory_failure(
    const InventoryState& inventory, std::string reason) {
  return InventoryResult{
      .success = false,
      .quantity_changed = 0,
      .total_weight_grams = inventory.current_weight_grams,
      .reason = std::move(reason),
  };
}

} // namespace

InventoryResult add_item(
    InventoryState& inventory,
    const ItemDefinition& definition,
    std::int32_t quantity) {
  validate_inventory(inventory);
  validate_item_definition(definition);
  if (quantity < 1) {
    throw std::invalid_argument("Item quantity must be positive");
  }

  const std::int64_t added_weight =
      static_cast<std::int64_t>(definition.weight_grams) * quantity;
  if (added_weight > inventory.weight_capacity_grams - inventory.current_weight_grams) {
    return inventory_failure(inventory, "weight_capacity_exceeded");
  }

  auto staged = inventory.items;
  std::int32_t remaining = quantity;
  for (auto& stack : staged) {
    if (stack.item_id != definition.id || stack.quantity >= definition.max_stack) {
      continue;
    }
    const std::int32_t space = definition.max_stack - stack.quantity;
    const std::int32_t moved = std::min(space, remaining);
    stack.quantity += moved;
    remaining -= moved;
    if (remaining == 0) {
      break;
    }
  }

  const std::int32_t new_stacks =
      remaining == 0 ? 0 : static_cast<std::int32_t>((static_cast<std::int64_t>(remaining) + definition.max_stack - 1) / definition.max_stack);
  const std::size_t resulting_slots = staged.size() + static_cast<std::size_t>(new_stacks);
  if (resulting_slots > static_cast<std::size_t>(inventory.slot_capacity)) {
    return inventory_failure(inventory, "slot_capacity_exceeded");
  }

  while (remaining > 0) {
    const std::int32_t moved = std::min(remaining, definition.max_stack);
    staged.push_back(ItemStack{.item_id = definition.id, .quantity = moved});
    remaining -= moved;
  }

  inventory.items = std::move(staged);
  inventory.current_weight_grams += added_weight;
  return InventoryResult{
      .success = true,
      .quantity_changed = quantity,
      .total_weight_grams = inventory.current_weight_grams,
      .reason = {},
  };
}

InventoryResult remove_item(
    InventoryState& inventory,
    std::string_view item_id,
    std::int32_t quantity,
    const ItemDefinition& definition) {
  validate_inventory(inventory);
  validate_item_definition(definition);
  if (item_id.empty() || item_id != definition.id || quantity < 1) {
    throw std::invalid_argument("Removal item ID, definition and quantity must be valid");
  }

  std::int64_t available = 0;
  for (const auto& stack : inventory.items) {
    if (stack.item_id == item_id) {
      available += stack.quantity;
    }
  }
  if (available < quantity) {
    return inventory_failure(inventory, "insufficient_quantity");
  }

  const std::int64_t removed_weight =
      static_cast<std::int64_t>(definition.weight_grams) * quantity;
  if (removed_weight > inventory.current_weight_grams) {
    throw std::invalid_argument("Inventory weight does not match its item stacks");
  }

  auto staged = inventory.items;
  std::int32_t remaining = quantity;
  for (auto& stack : staged) {
    if (stack.item_id != item_id || remaining == 0) {
      continue;
    }
    const std::int32_t moved = std::min(stack.quantity, remaining);
    stack.quantity -= moved;
    remaining -= moved;
  }
  std::erase_if(staged, [](const ItemStack& stack) { return stack.quantity == 0; });

  inventory.items = std::move(staged);
  inventory.current_weight_grams -= removed_weight;
  return InventoryResult{
      .success = true,
      .quantity_changed = quantity,
      .total_weight_grams = inventory.current_weight_grams,
      .reason = {},
  };
}

std::int64_t inventory_weight(
    const InventoryState& inventory,
    std::span<const ItemDefinition> definitions) {
  validate_inventory(inventory);
  std::int64_t total = 0;
  for (const auto& stack : inventory.items) {
    const auto found = std::find_if(definitions.begin(), definitions.end(),
        [&stack](const ItemDefinition& item) { return item.id == stack.item_id; });
    if (found == definitions.end()) {
      throw std::invalid_argument("Missing item definition for inventory stack");
    }
    validate_item_definition(*found);
    const std::int64_t stack_weight =
        static_cast<std::int64_t>(found->weight_grams) * stack.quantity;
    if (stack_weight > std::numeric_limits<std::int64_t>::max() - total) {
      throw std::overflow_error("Inventory weight calculation overflow");
    }
    total += stack_weight;
  }
  return total;
}

std::int32_t ability_score(const AbilityScores& scores, Ability ability) {
  const auto index = static_cast<std::size_t>(ability);
  if (index >= scores.values.size()) {
    throw std::invalid_argument("Unknown ability identifier");
  }
  return scores.values[index];
}

void validate_ability_scores(const AbilityScores& scores) {
  for (const std::int32_t score : scores.values) {
    if (score < 1 || score > 30) {
      throw std::out_of_range("Ability scores must be between 1 and 30");
    }
  }
}

std::int32_t passive_score(const PassiveScoreInput& input) {
  if (input.ability_score < 1 || input.ability_score > 30) {
    throw std::out_of_range("Ability score must be between 1 and 30");
  }
  const std::int32_t proficiency = input.proficient
      ? proficiency_bonus(input.character_level) : 0;
  const std::int64_t total = 10LL + ability_modifier(input.ability_score)
      + proficiency + input.bonus;
  return clamp_to_i32(total);
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

namespace {

void validate_health_state(const HealthState& target) {
  if (target.maximum_hit_points < 0
      || target.hit_points < 0
      || target.hit_points > target.maximum_hit_points
      || target.temporary_hit_points < 0) {
    throw std::invalid_argument("Invalid character health state");
  }
}

} // namespace

HealthChangeResult apply_damage(HealthState& target, std::int32_t amount) {
  validate_health_state(target);
  if (amount < 0) {
    throw std::invalid_argument("Damage amount cannot be negative");
  }

  const std::int32_t absorbed = std::min(amount, target.temporary_hit_points);
  target.temporary_hit_points -= absorbed;
  const std::int32_t remaining = amount - absorbed;
  const std::int32_t dealt = std::min(remaining, target.hit_points);
  target.hit_points -= dealt;
  target.defeated = target.hit_points == 0;

  return HealthChangeResult{
      .requested = amount,
      .applied = absorbed + dealt,
      .hit_points_remaining = target.hit_points,
      .temporary_hit_points_remaining = target.temporary_hit_points,
      .defeated = target.defeated,
  };
}

HealthChangeResult apply_healing(HealthState& target, std::int32_t amount) {
  validate_health_state(target);
  if (amount < 0) {
    throw std::invalid_argument("Healing amount cannot be negative");
  }

  const std::int32_t restored = std::min(
      amount, target.maximum_hit_points - target.hit_points);
  target.hit_points += restored;
  target.defeated = target.hit_points == 0;

  return HealthChangeResult{
      .requested = amount,
      .applied = restored,
      .hit_points_remaining = target.hit_points,
      .temporary_hit_points_remaining = target.temporary_hit_points,
      .defeated = target.defeated,
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
