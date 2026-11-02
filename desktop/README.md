# Shadowbane Chronicles C++23 Desktop Port

This directory contains a starter architecture for a native desktop port of Shadowbane Chronicles.
It is deliberately independent of the browser runtime: gameplay rules can be migrated
incrementally without coupling the native executable to browser globals.

## Requirements

- CMake 3.25+
- C++23 compiler (MSVC 19.36+, GCC 13+, or Clang 16+)
- SDL2 development package

SDL2 is discovered through CMake's config package. On Windows, install SDL2 with
vcpkg and configure with `-DCMAKE_TOOLCHAIN_FILE=.../scripts/buildsystems/vcpkg.cmake`.

## Build

```sh
cmake -S desktop -B desktop/build -DCMAKE_BUILD_TYPE=Release
cmake --build desktop/build --config Release
```

The initial executable opens a 160x144 logical display scaled to the window. The game
loop uses a fixed 60 Hz update step with a bounded catch-up accumulator and a variable
render step. The placeholder scene is intentionally small; port systems one at a time.

## Architecture

- `src/main.cpp`: SDL lifecycle, fixed-step loop, nearest-neighbour presentation.
- `src/game.hpp`: portable game state and update/render boundary.
- `src/game.cpp`: initial placeholder scene and deterministic input mapping.

## Porting sequence

1. Port input, palette and bitmap-font systems.
2. Port scene stack and save-state model.
3. Port world/combat rules behind deterministic interfaces.
4. Add asset loading from the existing `assets/` directory.
5. Add regression fixtures shared with the JavaScript rules module.

Do not copy browser code mechanically. Keep simulation deterministic and isolate SDL I/O.
