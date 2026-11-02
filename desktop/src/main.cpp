#include "game.hpp"

#include <SDL.h>

#include <algorithm>
#include <chrono>
#include <iostream>

int main(int argc, char** argv) {
  (void)argc;
  (void)argv;

  if (SDL_Init(SDL_INIT_VIDEO | SDL_INIT_EVENTS) != 0) {
    std::cerr << "SDL initialization failed: " << SDL_GetError() << '\n';
    return 1;
  }

  SDL_Window* window = SDL_CreateWindow(
      "GB Quest - Desktop Port",
      SDL_WINDOWPOS_CENTERED, SDL_WINDOWPOS_CENTERED,
      gbquest::kLogicalWidth * 4, gbquest::kLogicalHeight * 4,
      SDL_WINDOW_RESIZABLE | SDL_WINDOW_ALLOW_HIGHDPI);
  if (!window) {
    std::cerr << "Window creation failed: " << SDL_GetError() << '\n';
    SDL_Quit();
    return 1;
  }

  SDL_Renderer* renderer = SDL_CreateRenderer(
      window, -1, SDL_RENDERER_ACCELERATED | SDL_RENDERER_PRESENTVSYNC);
  if (!renderer) {
    std::cerr << "Renderer creation failed: " << SDL_GetError() << '\n';
    SDL_DestroyWindow(window);
    SDL_Quit();
    return 1;
  }

  SDL_RenderSetLogicalSize(renderer, gbquest::kLogicalWidth, gbquest::kLogicalHeight);
  SDL_RenderSetIntegerScale(renderer, SDL_TRUE);

  gbquest::Game game;
  gbquest::InputState input;
  using clock = std::chrono::steady_clock;
  auto previous = clock::now();
  double accumulator = 0.0;
  constexpr double step = 1.0 / 60.0;
  constexpr double max_frame = 0.25;
  bool running = true;

  while (running) {
    SDL_Event event;
    while (SDL_PollEvent(&event)) {
      if (event.type == SDL_QUIT) running = false;
      if (event.type == SDL_KEYDOWN || event.type == SDL_KEYUP) {
        const auto scancode = event.key.keysym.scancode;
        if (scancode >= 0 && scancode < SDL_NUM_SCANCODES) {
          input.keys[static_cast<std::size_t>(scancode)] = event.type == SDL_KEYDOWN;
        }
        if (event.type == SDL_KEYDOWN && event.key.keysym.sym == SDLK_ESCAPE) running = false;
      }
    }

    const auto now = clock::now();
    const double elapsed = std::chrono::duration<double>(now - previous).count();
    previous = now;
    accumulator += std::min(elapsed, max_frame);

    while (accumulator >= step) {
      game.update(input, step);
      accumulator -= step;
    }
    game.render(renderer);
  }

  SDL_DestroyRenderer(renderer);
  SDL_DestroyWindow(window);
  SDL_Quit();
  return 0;
}
