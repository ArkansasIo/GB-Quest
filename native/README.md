# GB Quest native core

This directory adds a standalone C++23 rules library alongside the existing JavaScript game and MMORPG modules. It does not replace the legacy Game Boy renderer or change the JavaScript runtime entry points.

## Implemented

- C++23 static library with a small public API in `include/gbquest/core.hpp`.
- D&D ability modifiers, character-level proficiency progression, armor class calculation and deterministic d20 attack resolution.
- Optional x86-64 System V assembly implementation of the ability-modifier hot path.
- Portable C++23 fallback for platforms without the supported assembly ABI.
- Native unit tests and CI builds for both the assembly-enabled and portable configurations.

## Build

Requires CMake 3.20+ and a C++23 compiler.

```sh
cmake -S native -B build/native -DCMAKE_BUILD_TYPE=Release
cmake --build build/native --parallel
ctest --test-dir build/native --output-on-failure
```

Force the portable C++ implementation:

```sh
cmake -S native -B build/native-portable -DGBQ_ENABLE_X86_64_ASM=OFF
cmake --build build/native-portable --parallel
ctest --test-dir build/native-portable --output-on-failure
```

## Assembly selection

The NASM-independent GNU assembler source uses the System V AMD64 calling convention and is enabled only for x86-64 Linux-like targets with GCC or Clang. Windows, ARM64 and unsupported toolchains use the portable implementation. The assembly routine sign-extends the input before subtraction, then uses an arithmetic shift to implement floor division for negative ability modifiers without 32-bit overflow.

## Determinism and security

The native library does not generate random numbers or trust client-supplied random outcomes. Callers provide an already-rolled d20 value to `resolve_attack`; production combat rolls must be generated and validated by the authoritative server. This first native increment is a rules-core foundation, not a complete native game engine, renderer, networking stack or WebAssembly binding.

## Dice and damage

The native API also parses bounded dice expressions (`NdS`, `dS`, optional signed modifier), resolves caller-supplied die faces, doubles the dice pool for critical hits, and applies a selected damage disposition (normal, resistance, vulnerability or immunity). Random values are deliberately supplied by the caller so the core remains deterministic and can be driven by an authoritative server RNG. Critical damage doubles the dice, not the flat modifier.

## Character health transitions

The native API includes mutable health-state transitions with validation: damage consumes temporary hit points before current hit points, lethal damage marks the character defeated, and healing restores hit points up to the configured maximum and clears the defeated flag when hit points become positive. Healing does not alter temporary hit points. Invalid state and negative damage/healing are rejected before mutation.
