#include "everything_client.hpp"
#include "fs_ops.hpp"

#define EVERYTHINGUSERAPI
#include "Everything.h"

#include <mutex>
#include <iostream>

namespace everything_client {

static std::mutex g_everything_mutex;

bool is_available() {
    std::lock_guard<std::mutex> lock(g_everything_mutex);
    HWND hwnd = FindWindowW(L"EVERYTHING_TASKBAR_NOTIFICATION", NULL);
    if (!hwnd) {
        return false;
    }
    return Everything_IsDBLoaded() != FALSE;
}

std::optional<uint64_t> get_folder_size(const std::wstring& folder_path) {
    std::lock_guard<std::mutex> lock(g_everything_mutex);

    // Fast check if IPC window exists before querying
    HWND hwnd = FindWindowW(L"EVERYTHING_TASKBAR_NOTIFICATION", NULL);
    if (!hwnd) {
        return std::nullopt;
    }

    // Strip trailing slash if present for Everything exact match
    std::wstring clean_path = folder_path;
    if (clean_path.size() > 3 && clean_path.back() == L'\\') {
        clean_path.pop_back();
    }

    std::wstring query = L"exact:\"" + clean_path + L"\"";

    Everything_SetSearchW(query.c_str());
    Everything_SetRequestFlags(EVERYTHING_REQUEST_SIZE | EVERYTHING_REQUEST_ATTRIBUTES);
    Everything_SetMax(1);
    Everything_SetOffset(0);

    if (!Everything_QueryW(TRUE)) {
        Everything_Reset();
        return std::nullopt;
    }

    DWORD num_results = Everything_GetNumResults();
    if (num_results == 0) {
        Everything_Reset();
        return std::nullopt;
    }

    LARGE_INTEGER size_val;
    if (Everything_GetResultSize(0, &size_val)) {
        Everything_Reset();
        if (size_val.QuadPart >= 0) {
            return static_cast<uint64_t>(size_val.QuadPart);
        }
    }

    Everything_Reset();
    return std::nullopt;
}

std::unordered_map<std::wstring, uint64_t> get_directory_folder_sizes(const std::wstring& dir_path) {
    std::unordered_map<std::wstring, uint64_t> folder_sizes;
    std::lock_guard<std::mutex> lock(g_everything_mutex);

    HWND hwnd = FindWindowW(L"EVERYTHING_TASKBAR_NOTIFICATION", NULL);
    if (!hwnd) {
        return folder_sizes;
    }

    std::wstring clean_path = dir_path;
    if (clean_path.size() > 3 && clean_path.back() == L'\\') {
        clean_path.pop_back();
    }

    std::wstring query = L"parent:\"" + clean_path + L"\" folder:";

    Everything_SetSearchW(query.c_str());
    Everything_SetRequestFlags(EVERYTHING_REQUEST_FILE_NAME | EVERYTHING_REQUEST_SIZE);
    Everything_SetMax(2000);
    Everything_SetOffset(0);

    if (!Everything_QueryW(TRUE)) {
        Everything_Reset();
        return folder_sizes;
    }

    DWORD num_results = Everything_GetNumResults();
    for (DWORD i = 0; i < num_results; ++i) {
        LPCWSTR name = Everything_GetResultFileNameW(i);
        if (!name) continue;

        LARGE_INTEGER sz;
        if (Everything_GetResultSize(i, &sz) && sz.QuadPart >= 0) {
            std::wstring lower_name = name;
            std::transform(lower_name.begin(), lower_name.end(), lower_name.begin(), ::towlower);
            folder_sizes[lower_name] = static_cast<uint64_t>(sz.QuadPart);
        }
    }

    Everything_Reset();
    return folder_sizes;
}

nlohmann::json search(const std::wstring& query, uint32_t max_results) {
    std::lock_guard<std::mutex> lock(g_everything_mutex);
    nlohmann::json results = nlohmann::json::array();

    HWND hwnd = FindWindowW(L"EVERYTHING_TASKBAR_NOTIFICATION", NULL);
    if (!hwnd) {
        return results;
    }

    Everything_SetSearchW(query.c_str());
    Everything_SetRequestFlags(
        EVERYTHING_REQUEST_FILE_NAME |
        EVERYTHING_REQUEST_PATH |
        EVERYTHING_REQUEST_SIZE |
        EVERYTHING_REQUEST_DATE_MODIFIED |
        EVERYTHING_REQUEST_ATTRIBUTES
    );
    Everything_SetMax(max_results);
    Everything_SetOffset(0);

    if (!Everything_QueryW(TRUE)) {
        Everything_Reset();
        return results;
    }

    DWORD count = Everything_GetNumResults();
    for (DWORD i = 0; i < count; ++i) {
        LPCWSTR filename_w = Everything_GetResultFileNameW(i);
        LPCWSTR path_w = Everything_GetResultPathW(i);
        BOOL is_folder = Everything_IsFolderResult(i);

        LARGE_INTEGER sz;
        uint64_t size_bytes = 0;
        if (Everything_GetResultSize(i, &sz) && sz.QuadPart > 0) {
            size_bytes = static_cast<uint64_t>(sz.QuadPart);
        }

        std::wstring full_wpath = std::wstring(path_w ? path_w : L"") + L"\\" + (filename_w ? filename_w : L"");
        std::string filename_utf8 = filename_w ? fs_ops::wide_to_utf8(filename_w) : "";

        nlohmann::json item = {
            {"name", filename_utf8},
            {"path", fs_ops::wide_to_utf8(full_wpath)},
            {"isDirectory", is_folder != FALSE},
            {"size", size_bytes},
            {"sizeFormatted", fs_ops::format_bytes(size_bytes)}
        };
        results.push_back(item);
    }

    Everything_Reset();
    return results;
}

} // namespace everything_client
