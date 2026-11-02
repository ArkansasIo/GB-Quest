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

} // namespace

int main() {
  test_ability_modifiers();
  test_proficiency();
  test_armor_class();
  test_attack_resolution();
  test_dice_and_damage();
  test_health_transitions();
  test_ability_score_state();

  if (failures != 0) {
    std::cerr << failures << " native test(s) failed\n";
    return 1;
  }
  std::cout << "All GB Quest native C++23 tests passed\n";
  return 0;
}
