cmake_minimum_required(VERSION 3.20)
project(shadowbane_chronicles_rom LANGUAGES NONE)

find_program(RGBASM_EXECUTABLE NAMES rgbasm)
find_program(RGBLINK_EXECUTABLE NAMES rgblink)
find_program(RGBFIX_EXECUTABLE NAMES rgbfix)
find_program(NODE_EXECUTABLE NAMES node)

option(GBQ_REQUIRE_RGBDS "Fail configuration when RGBDS is unavailable" OFF)

if(RGBASM_EXECUTABLE AND RGBLINK_EXECUTABLE AND RGBFIX_EXECUTABLE AND NODE_EXECUTABLE)
  set(ROM_BUILD_DIR "${CMAKE_CURRENT_BINARY_DIR}/generated")
  file(MAKE_DIRECTORY "${ROM_BUILD_DIR}")
  set(FONT_FILE "${ROM_BUILD_DIR}/font.2bpp")
  add_custom_command(
    OUTPUT "${FONT_FILE}"
    COMMAND "${NODE_EXECUTABLE}" "${CMAKE_CURRENT_SOURCE_DIR}/tools/generate_font.mjs" "${FONT_FILE}"
    DEPENDS "${CMAKE_CURRENT_SOURCE_DIR}/tools/generate_font.mjs"
    VERBATIM
  )

  function(add_gameboy_rom target cgb_flag extension)
    set(object_file "${ROM_BUILD_DIR}/${target}.o")
    set(raw_rom "${ROM_BUILD_DIR}/${target}-raw.${extension}")
    set(rom_file "${CMAKE_CURRENT_BINARY_DIR}/${target}.${extension}")
    add_custom_command(
      OUTPUT "${rom_file}"
      COMMAND "${RGBASM_EXECUTABLE}" -Wall -Wextra -I "${CMAKE_CURRENT_SOURCE_DIR}/src/"
              -I "${ROM_BUILD_DIR}/"
              -D "CGB_FLAG=${cgb_flag}" -o "${object_file}" "${CMAKE_CURRENT_SOURCE_DIR}/src/main.asm"
      COMMAND "${RGBLINK_EXECUTABLE}" -p 0xFF -o "${raw_rom}" "${object_file}"
      COMMAND "${RGBFIX_EXECUTABLE}" -v -p 0xFF -t SHADOWBANE "${raw_rom}"
      COMMAND "${CMAKE_COMMAND}" -E copy_if_different "${raw_rom}" "${rom_file}"
      DEPENDS "${FONT_FILE}"
              "${CMAKE_CURRENT_SOURCE_DIR}/src/main.asm"
              "${CMAKE_CURRENT_SOURCE_DIR}/src/constants.inc"
              "${CMAKE_CURRENT_SOURCE_DIR}/src/header.asm"
              "${CMAKE_CURRENT_SOURCE_DIR}/src/scenes.asm"
              "${CMAKE_CURRENT_SOURCE_DIR}/src/render.asm"
              "${CMAKE_CURRENT_SOURCE_DIR}/src/input.asm"
              "${CMAKE_CURRENT_SOURCE_DIR}/src/data.asm"
      VERBATIM
    )
    add_custom_target("${target}" ALL DEPENDS "${rom_file}")
  endfunction()

  add_gameboy_rom(shadowbane-gb 0x80 gb)
  add_gameboy_rom(shadowbane-gbc 0xC0 gbc)
  message(STATUS "RGBDS targets enabled: Game Boy-compatible and Game Boy Color ROMs")
elseif(GBQ_REQUIRE_RGBDS)
  message(FATAL_ERROR "RGBDS (rgbasm, rgblink, rgbfix) and Node.js are required to build ROMs")
else()
  message(STATUS "ROM targets not generated: install RGBDS and Node.js, then configure with -DGBQ_REQUIRE_RGBDS=ON")
  add_custom_target(rom-toolchain-status
    COMMAND "${CMAKE_COMMAND}" -E echo "Install RGBDS and Node.js to assemble the Game Boy and Game Boy Color ROMs."
  )
endif()
