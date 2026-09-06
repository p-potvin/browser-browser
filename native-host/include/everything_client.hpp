#pragma once

#include <string>
#include <optional>
#include <cstdint>
#include <nlohmann/json.hpp>

namespace everything_client {

// Check if Everything Search IPC is running and available
bool is_available();

// Query Everything Search for indexed folder size in bytes
std::optional<uint64_t> get_folder_size(const std::wstring& folder_path);

// Batch query all immediate child folder sizes in a directory using a single parent query
std::unordered_map<std::wstring, uint64_t> get_directory_folder_sizes(const std::wstring& dir_path);

// Execute general Everything Search query across indexed files and folders
nlohmann::json search(const std::wstring& query, uint32_t max_results = 100);

} // namespace everything_client
