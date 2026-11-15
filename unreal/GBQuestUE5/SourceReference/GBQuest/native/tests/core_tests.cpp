#include "gbquest/core.hpp"

#include <array>
#include <cstdint>
#include <exception>
#include <iostream>
#include <limits>
#include <stdexcept>
#include <string_view>
#include <vector>

namespace {

int failures = 0;

void check(bool condition, std::string_view message) {
  if (!condition) {
    ++failures;
    std::cerr << "FAIL: " << message << '\n';
  }
}

template <typename Function>
void check_throws(Function&& function, std::string_view message) {
  try {
    function();
    check(false, message);
  } catch (const std::exception&) {
    check(true, message);
  }
}

void test_ability_modifiers() {
  constexpr std::array<std::int32_t, 9> scores{1, 3, 8, 9, 10, 11, 12, 18, 20};
  constexpr std::array<std::int32_t, 9> expected{-5, -4, -1, -1, 0, 0, 1, 4, 5};
  for (std::size_t i = 0; i < scores.size(); ++i) {
    check(gbquest::ability_modifier(scores[i]) == expected[i], "ability modifier table");
  }
  check(gbquest::ability_modifier(std::numeric_limits<std::int32_t>::min())
            == -1073741829,
        "ability modifier handles INT32_MIN without overflow");
  check(gbquest::ability_modifier(std::numeric_limits<std::int32_t>::max())
            == 1073741818,
        "ability modifier handles INT32_MAX without overflow");
}

void test_proficiency() {
  constexpr std::array<std::int32_t, 20> expected{
      2, 2, 2, 2, 3, 3, 3, 3, 4, 4,
      4, 4, 5, 5, 5, 5, 6, 6, 6, 6};
  for (std::int32_t level = 1; level <= 20; ++level) {
    check(gbquest::proficiency_bonus(level) == expected[static_cast<std::size_t>(level - 1)],
          "proficiency bonus by level");
  }
  check_throws([] { (void)gbquest::proficiency_bonus(0); }, "reject level zero");
  check_throws([] { (void)gbquest::proficiency_bonus(21); }, "reject level above twenty");
}

void test_armor_class() {
  check(gbquest::armor_class({.armor_base = 10, .dexterity_score = 18}) == 14,
        "unarmored AC includes Dexterity modifier");
  check(gbquest::armor_class({
            .armor_base = 16,
            .dexterity_score = 20,
            .shield_bonus = 2,
            .other_bonus = 1,
            .dexterity_cap = 2,
            .has_dexterity_cap = true}) == 21,
        "armor class applies Dexterity cap and bonuses");
}

void test_attack_resolution() {
  const auto hit = gbquest::resolve_attack({
      .natural_roll = 12,
      .ability_score = 18,
      .proficiency = 3,
      .bonus = 1,
      .target_armor_class = 18});
  check(hit.total == 20 && hit.hit && !hit.critical && !hit.fumble,
        "normal attack hit");

  const auto critical = gbquest::resolve_attack({
      .natural_roll = 20, .target_armor_class = 99});
  check(critical.hit && critical.critical, "natural twenty always hits and crits");

  const auto fumble = gbquest::resolve_attack({
      .natural_roll = 1, .ability_score = 30, .proficiency = 6,
      .target_armor_class = 1});
  check(!fumble.hit && fumble.fumble, "natural one always misses");

  check_throws([] {
    (void)gbquest::resolve_attack({.natural_roll = 0});
  }, "reject invalid natural roll");
  check_throws([] {
    (void)gbquest::resolve_attack({.natural_roll = 10, .proficiency = -1});
  }, "reject negative proficiency");
}


void test_dice_and_damage() {
  const auto expression = gbquest::parse_dice_expression("2d6+3");
  check(expression.count == 2 && expression.sides == 6 && expression.modifier == 3,
        "parse dice expression with positive modifier");

  const auto single_die = gbquest::parse_dice_expression("d8-2");
  check(single_die.count == 1 && single_die.sides == 8 && single_die.modifier == -2,
        "parse implicit one die and negative modifier");

  const std::array<std::int32_t, 2> faces{4, 5};
  const auto dice = gbquest::resolve_dice(expression, faces);
  check(dice.total == 12 && dice.rolls.size() == 2, "resolve supplied dice faces");

  const std::array<std::int32_t, 4> critical_faces{4, 5, 2, 6};
  const auto critical_dice = gbquest::resolve_dice(expression, critical_faces, true);
  check(critical_dice.total == 20 && critical_dice.rolls.size() == 4,
        "critical hit doubles dice while retaining flat modifier once");

  const auto resistance = gbquest::resolve_damage(
      dice, {.damage_type = "fire", .disposition = gbquest::DamageDisposition::resistance});
  check(resistance.amount == 6 && resistance.damage_type == "fire",
        "resistance halves damage");

  const auto vulnerability = gbquest::resolve_damage(
      dice, {.damage_type = "cold", .disposition = gbquest::DamageDisposition::vulnerability});
  check(vulnerability.amount == 24, "vulnerability doubles damage");

  const auto immunity = gbquest::resolve_damage(
      dice, {.damage_type = "poison", .disposition = gbquest::DamageDisposition::immunity});
  check(immunity.amount == 0, "immunity negates damage");

  check_throws([] { (void)gbquest::parse_dice_expression("0d6"); },
               "reject zero dice");
  check_throws([] { (void)gbquest::parse_dice_expression("2d1"); },
               "reject one-sided die");
  check_throws([] { (void)gbquest::parse_dice_expression("2d6+"); },
               "reject missing modifier digits");
  check_throws([&] {
    const std::array<std::int32_t, 1> wrong_count{3};
    (void)gbquest::resolve_dice(expression, wrong_count);
  }, "reject incorrect face count");
  check_throws([&] {
    const std::array<std::int32_t, 2> invalid_faces{3, 7};
    (void)gbquest::resolve_dice(expression, invalid_faces);
  }, "reject die face above sides");
  check_throws([&] {
    (void)gbquest::resolve_damage(dice, {.damage_type = ""});
  }, "reject empty damage type");
}


void test_health_transitions() {
  gbquest::HealthState character{
      .hit_points = 20, .maximum_hit_points = 30, .temporary_hit_points = 5};
  const auto damage = gbquest::apply_damage(character, 12);
  check(damage.applied == 12 && character.temporary_hit_points == 0
            && character.hit_points == 13 && !character.defeated,
        "damage consumes temporary HP before hit points");

  const auto healing = gbquest::apply_healing(character, 50);
  check(healing.applied == 17 && character.hit_points == 30,
        "healing is capped at maximum hit points");

  const auto lethal = gbquest::apply_damage(character, 99);
  check(lethal.applied == 30 && character.hit_points == 0 && character.defeated,
        "lethal damage sets defeated state");

  const auto revive = gbquest::apply_healing(character, 7);
  check(revive.applied == 7 && character.hit_points == 7 && !character.defeated,
        "healing restores a defeated character");

  check_throws([&] {
    (void)gbquest::apply_damage(character, -1);
  }, "reject negative damage");
  check_throws([&] {
    (void)gbquest::apply_healing(character, -1);
  }, "reject negative healing");

  gbquest::HealthState invalid{.hit_points = 40, .maximum_hit_points = 30};
  check_throws([&] {
    (void)gbquest::apply_damage(invalid, 1);
  }, "reject invalid health state without mutation");
}



void test_inventory_transactions() {
  const gbquest::ItemDefinition potion{
      .id = "potion", .weight_grams = 100, .max_stack = 5};
  gbquest::InventoryState inventory{
      .items = {}, .slot_capacity = 4, .weight_capacity_grams = 2000};

  const auto added = gbquest::add_item(inventory, potion, 7);
  check(added.success && added.quantity_changed == 7
            && inventory.items.size() == 2
            && inventory.current_weight_grams == 700,
        "add item splits quantity into bounded stacks");

  const auto more = gbquest::add_item(inventory, potion, 2);
  check(more.success && inventory.items[0].quantity == 5
            && inventory.items[1].quantity == 4,
        "add item fills existing partial stacks first");

  const auto removed = gbquest::remove_item(inventory, "potion", 6, potion);
  check(removed.success && removed.quantity_changed == 6
            && inventory.items.size() == 1
            && inventory.items[0].quantity == 3
            && inventory.current_weight_grams == 300,
        "remove item quantity across stacks");

  const auto insufficient = gbquest::remove_item(inventory, "potion", 4, potion);
  check(!insufficient.success && insufficient.reason == "insufficient_quantity"
            && inventory.items[0].quantity == 3,
        "failed removal leaves inventory unchanged");

  const auto weight = gbquest::inventory_weight(
      inventory, std::span<const gbquest::ItemDefinition>(&potion, 1));
  check(weight == 300, "calculate inventory weight from definitions");

  gbquest::InventoryState no_slots{
      .items = {}, .slot_capacity = 1, .weight_capacity_grams = 10000};
  const auto rejected_slots = gbquest::add_item(no_slots, potion, 6);
  check(!rejected_slots.success && rejected_slots.reason == "slot_capacity_exceeded"
            && no_slots.items.empty() && no_slots.current_weight_grams == 0,
        "slot-capacity rejection is transactional");

  gbquest::InventoryState no_weight{
      .items = {}, .slot_capacity = 10, .weight_capacity_grams = 100};
  const auto rejected_weight = gbquest::add_item(no_weight, potion, 2);
  check(!rejected_weight.success && rejected_weight.reason == "weight_capacity_exceeded"
            && no_weight.items.empty(),
        "weight-capacity rejection is transactional");

  check_throws([&] {
    (void)gbquest::add_item(inventory, potion, 0);
  }, "reject non-positive add quantity");
  check_throws([&] {
    (void)gbquest::inventory_weight(inventory, {});
  }, "reject missing item definitions for weight calculation");
}

void test_ability_score_state() {
  const gbquest::AbilityScores scores{{15, 14, 13, 12, 10, 8}};
  check(gbquest::ability_score(scores, gbquest::Ability::strength) == 15,
        "read strength from ordered ability scores");
  check(gbquest::ability_score(scores, gbquest::Ability::charisma) == 8,
        "read charisma from ordered ability scores");
  check(gbquest::ability_modifier(gbquest::ability_score(
            scores, gbquest::Ability::dexterity)) == 2,
        "derive modifier from stored ability score");

  check_throws([&] {
    (void)gbquest::ability_score(scores, static_cast<gbquest::Ability>(99));
  }, "reject invalid ability enum");
  check_throws([&] {
    gbquest::validate_ability_scores(gbquest::AbilityScores{{10, 10, 0, 10, 10, 10}});
  }, "reject ability score below one");
  check_throws([&] {
    (void)gbquest::passive_score({.ability_score = 31});
  }, "reject passive score ability outside supported range");

  const auto passive = gbquest::passive_score({
      .ability_score = 16, .character_level = 5, .proficient = true});
  check(passive == 16, "passive score includes ability modifier and proficiency");
  check(gbquest::passive_score({
            .ability_score = 8, .character_level = 1, .proficient = false,
            .bonus = 2}) == 11,
        "passive score supports non-proficient bonuses");
}

} // namespace

int main() {
  test_ability_modifiers();
  test_proficiency();
  test_armor_class();
  test_attack_resolution();
  test_dice_and_damage();
  test_health_transitions();
  test_ability_score_state();
  test_inventory_transactions();

  if (failures != 0) {
    std::cerr << failures << " native test(s) failed\n";
    return 1;
  }
  std::cout << "All Lost Kingdom of Shadowbane Chronicles native C++23 tests passed\n";
  return 0;
}
