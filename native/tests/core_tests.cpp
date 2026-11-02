#include "gbquest/core.hpp"

#include <array>
#include <cstdint>
#include <exception>
#include <iostream>
#include <limits>
#include <stdexcept>
#include <string_view>

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

} // namespace

int main() {
  test_ability_modifiers();
  test_proficiency();
  test_armor_class();
  test_attack_resolution();

  if (failures != 0) {
    std::cerr << failures << " native test(s) failed\n";
    return 1;
  }
  std::cout << "All GB Quest native C++23 tests passed\n";
  return 0;
}
