#include "game.hpp"

#include <algorithm>

namespace gbquest {

void Game::update(const InputState& input, double /*fixed_seconds*/) noexcept {
  constexpr int kSpeed = 1;
  if (input.down(SDL_SCANCODE_LEFT) || input.down(SDL_SCANCODE_A)) cursor_x_ -= kSpeed;
  if (input.down(SDL_SCANCODE_RIGHT) || input.down(SDL_SCANCODE_D)) cursor_x_ += kSpeed;
  if (input.down(SDL_SCANCODE_UP) || input.down(SDL_SCANCODE_W)) cursor_y_ -= kSpeed;
  if (input.down(SDL_SCANCODE_DOWN) || input.down(SDL_SCANCODE_S)) cursor_y_ += kSpeed;
  cursor_x_ = std::clamp(cursor_x_, 2, kLogicalWidth - 3);
  cursor_y_ = std::clamp(cursor_y_, 2, kLogicalHeight - 3);
  ++frame_;
}

void Game::render(SDL_Renderer* renderer) const noexcept {
  SDL_SetRenderDrawColor(renderer, 15, 56, 15, 255);
  SDL_RenderClear(renderer);

  SDL_SetRenderDrawColor(renderer, 155, 188, 15, 255);
  SDL_Rect border{4, 4, kLogicalWidth - 8, kLogicalHeight - 8};
  SDL_RenderDrawRect(renderer, &border);

  SDL_SetRenderDrawColor(renderer, 48, 98, 48, 255);
  SDL_Rect marker{cursor_x_ - 2, cursor_y_ - 2, 5, 5};
  SDL_RenderFillRect(renderer, &marker);

  SDL_RenderPresent(renderer);
}

}  // namespace gbquest
