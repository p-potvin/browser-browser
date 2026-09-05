cmake_minimum_required(VERSION 3.20)
project(browser_browser_host C CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_C_STANDARD 11)

# Compiler options for MSVC
if(MSVC)
    add_compile_options(/W4 /utf-8 /EHsc)
    add_definitions(-D_CRT_SECURE_NO_WARNINGS -DUNICODE -D_UNICODE -DWIN32_LEAN_AND_MEAN)
endif()

include_directories(
    ${CMAKE_CURRENT_SOURCE_DIR}/include
)

set(SOURCES
    src/main.cpp
    src/protocol.cpp
    src/fs_ops.cpp
    src/everything_client.cpp
    src/http_server.cpp
    src/Everything.c
)

add_executable(browser_browser_host ${SOURCES})

# Link Win32 libraries
target_link_libraries(browser_browser_host
    ws2_32
    shell32
    ole32
    advapi32
)
