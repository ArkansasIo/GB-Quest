#pragma once

#include <SDL.h>

#include <array>
#include <cstdint>

namespace gbquest {

inline constexpr int kLogicalWidth = 160;
inline constexpr int kLogicalHeight = 144;
inline constexpr std::uint32_t kFixedStepMs = 1000U / 60U;

struct InputState {
  std::array<bool, SDL_NUM_SCANCODES> keys{};
  [[nodiscard]] bool down(SDL_Scancode key) const noexcept {
    return keys[static_cast<std::size_t>(key)];
  }
};

class Game {
 public:
  void update(const InputState& input, double fixed_seconds) noexcept;
  void render(SDL_Renderer* renderer) const noexcept;

 private:
  std::uint32_t frame_{0};
  int cursor_x_{kLogicalWidth / 2};
  int cursor_y_{kLogicalHeight / 2};
};

}  // namespace gbquest
