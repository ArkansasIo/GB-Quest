cmake_minimum_required(VERSION 3.25)
project(GBQuestDesktop VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 23)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

find_package(SDL2 CONFIG REQUIRED)

add_executable(gbquest-desktop
  src/main.cpp
  src/game.cpp
)
target_include_directories(gbquest-desktop PRIVATE src)
target_link_libraries(gbquest-desktop PRIVATE SDL2::SDL2)

if(MSVC)
  target_compile_options(gbquest-desktop PRIVATE /W4 /permissive-)
else()
  target_compile_options(gbquest-desktop PRIVATE -Wall -Wextra -Wpedantic)
endif()
