#pragma once

// Folder sizes from vault-raggae's folder index (MFT + USN journal on every drive, owned by the gateway since
// Thu 22 Oct 2026), over HTTP on 127.0.0.1:8750. The only source of folder sizes: Everything is retired.

#include <cstdint>
#include <string>
#include <unordered_map>

namespace raggae_client {

// The gateway answers /v1/health.
bool is_available();

// Sizes of a folder's immediate subfolders, keyed by lowercased name (the shape everything_client returns).
// Empty when the gateway is down or the folder is not indexed.
std::unordered_map<std::wstring, uint64_t> get_directory_folder_sizes(const std::wstring& dir_path);

} // namespace raggae_client
