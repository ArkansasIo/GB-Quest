# Shadowbane Chronicles Game Boy ROM

This is a separate, deliberately constrained RGBDS implementation for the original
Game Boy and Game Boy Color. It is not the C++23 desktop executable: those devices
use the LR35902 processor and have only 8 KiB of video RAM and 8 KiB of work RAM.

The current ROM slice has a title screen, a short story prologue, d-pad movement,
and a small Elderwood scene. Both builds share the same assembly and 2bpp font;
the cartridge header marks the first ROM as CGB-compatible (`0x80`) and the second
as CGB-enhanced (`0xC0`).

## Requirements and build

- RGBDS (`rgbasm`, `rgblink`, `rgbfix`)
- Node.js 20+
- CMake 3.20+

```powershell
cmake -S rom -B build\rom -DGBQ_REQUIRE_RGBDS=ON
cmake --build build\rom --config Release
```

Outputs are `build/rom/shadowbane-gb.gb` and `build/rom/shadowbane-gbc.gbc`.
The generated font is created in the build directory and is not hand-edited.

## Controls

- D-pad: move in Elderwood
- A: advance the prologue or return to it from the world
- START: advance from the title, or skip the prologue

The ROM is a playable opening slice, not a port of the browser MMO's raids,
networking, 90-zone world, or expansion content. Those systems need ROM-sized
data and hardware-specific designs before they can be added.
