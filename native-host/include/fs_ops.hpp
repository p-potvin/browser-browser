#pragma once

#include <string>
#include <vector>
#include <cstdint>
#include <nlohmann/json.hpp>

namespace fs_ops {

// UTF-8 <-> Wide string conversion helpers
std::wstring utf8_to_wide(const std::string& utf8_str);
std::string wide_to_utf8(const std::wstring& wide_str);

// Format raw bytes into human-readable representation (e.g. 1.2 GB)
std::string format_bytes(uint64_t bytes);

// Deduce visual category from file extension / directory status
std::string get_file_type_category(const std::string& filename, bool is_dir);

// Enumerate all logical Windows drives with capacity, free space, and volume labels
nlohmann::json get_drives();

// Enumerate files/folders in path, check .thumbs, query Everything folder sizes
nlohmann::json list_dir(const std::string& path_utf8, int http_port);

// Launch file with default system handler via ShellExecuteW
bool open_file(const std::string& path_utf8);

// Reveal item in Windows Explorer (explorer.exe /select,"path")
bool reveal_in_explorer(const std::string& path_utf8);

} // namespace fs_ops
