cmake_minimum_required(VERSION 3.20)
project(gbquest_native VERSION 0.1.0 LANGUAGES CXX)

option(GBQ_ENABLE_X86_64_ASM "Use the optional x86-64 System V assembly fast path" ON)
option(GBQ_BUILD_TESTS "Build native core tests" ON)

add_library(gbquest_core STATIC
  src/core.cpp
)
target_include_directories(gbquest_core PUBLIC include)
target_compile_features(gbquest_core PUBLIC cxx_std_23)
set_target_properties(gbquest_core PROPERTIES
  CXX_EXTENSIONS OFF
  POSITION_INDEPENDENT_CODE ON
)

add_executable(gbquest_native_cli src/cli.cpp)
target_link_libraries(gbquest_native_cli PRIVATE gbquest_core)
target_compile_features(gbquest_native_cli PRIVATE cxx_std_23)
set_target_properties(gbquest_native_cli PROPERTIES CXX_EXTENSIONS OFF)

if(GBQ_ENABLE_X86_64_ASM
   AND CMAKE_SYSTEM_PROCESSOR MATCHES "^(x86_64|AMD64|amd64)$"
   AND NOT WIN32
   AND CMAKE_CXX_COMPILER_ID MATCHES "GNU|Clang")
  enable_language(ASM)
  target_sources(gbquest_core PRIVATE src/ability_modifier_x86_64.S)
  target_compile_definitions(gbquest_core PRIVATE GBQ_HAS_X86_64_ASM=1)
  message(STATUS "Lost Kingdom of Shadowbane Chronicles: enabling x86-64 System V assembly fast path")
else()
  message(STATUS "Lost Kingdom of Shadowbane Chronicles: using portable C++23 implementation")
endif()

if(MSVC)
  target_compile_options(gbquest_core PRIVATE /W4 /permissive-)
else()
  target_compile_options(gbquest_core PRIVATE -Wall -Wextra -Wpedantic -Wconversion)
endif()

if(GBQ_BUILD_TESTS)
  enable_testing()
  add_executable(gbquest_core_tests tests/core_tests.cpp)
  target_link_libraries(gbquest_core_tests PRIVATE gbquest_core)
  target_compile_features(gbquest_core_tests PRIVATE cxx_std_23)
  add_test(NAME gbquest_core_tests COMMAND gbquest_core_tests)
endif()
