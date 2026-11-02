#include "gbquest/core.hpp"

#include <charconv>
#include <cstdint>
#include <iostream>
#include <stdexcept>
#include <string_view>
#include <system_error>

namespace {

[[nodiscard]] std::int32_t parse_integer(std::string_view value) {
  std::int32_t result{};
  const auto [end, error] = std::from_chars(value.data(), value.data() + value.size(), result);
  if (error != std::errc{} || end != value.data() + value.size()) {
    throw std::invalid_argument("Expected an integer argument");
  }
  return result;
}

void resolve_attack(int argc, char** argv) {
  if (argc != 7) {
    throw std::invalid_argument("resolve-attack expects five integer arguments");
  }
  const auto result = gbquest::resolve_attack({
      .natural_roll = parse_integer(argv[2]),
      .ability_score = parse_integer(argv[3]),
      .proficiency = parse_integer(argv[4]),
      .bonus = parse_integer(argv[5]),
      .target_armor_class = parse_integer(argv[6]),
  });
  const auto modifier = gbquest::ability_modifier(parse_integer(argv[3]));
  std::cout << "{\"naturalRoll\":" << result.natural_roll
            << ",\"abilityModifier\":" << modifier
            << ",\"total\":" << result.total
            << ",\"hit\":" << (result.hit ? "true" : "false")
            << ",\"critical\":" << (result.critical ? "true" : "false")
            << ",\"fumble\":" << (result.fumble ? "true" : "false")
            << "}\n";
}

} // namespace

int main(int argc, char** argv) {
  try {
    if (argc < 2 || std::string_view(argv[1]) != "resolve-attack") {
      throw std::invalid_argument("Expected command: resolve-attack");
    }
    resolve_attack(argc, argv);
    return 0;
  } catch (const std::exception& error) {
    std::cerr << error.what() << '\n';
    return 2;
  }
}
