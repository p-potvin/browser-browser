#include "fs_ops.hpp"
#include "everything_client.hpp"

#include <windows.h>
#include <shellapi.h>
#include <filesystem>
#include <fstream>
#include <sstream>
#include <iomanip>
#include <algorithm>
#include <chrono>
#include <unordered_map>
#include <unordered_set>

namespace fs = std::filesystem;

namespace fs_ops {

std::wstring utf8_to_wide(const std::string& utf8_str) {
    if (utf8_str.empty()) return L"";
    int size_needed = MultiByteToWideChar(CP_UTF8, 0, utf8_str.data(), (int)utf8_str.size(), NULL, 0);
    std::wstring result(size_needed, 0);
    MultiByteToWideChar(CP_UTF8, 0, utf8_str.data(), (int)utf8_str.size(), &result[0], size_needed);
    return result;
}

std::string wide_to_utf8(const std::wstring& wide_str) {
    if (wide_str.empty()) return "";
    int size_needed = WideCharToMultiByte(CP_UTF8, 0, wide_str.data(), (int)wide_str.size(), NULL, 0, NULL, NULL);
    std::string result(size_needed, 0);
    WideCharToMultiByte(CP_UTF8, 0, wide_str.data(), (int)wide_str.size(), &result[0], size_needed, NULL, NULL);
    return result;
}

std::string format_bytes(uint64_t bytes) {
    if (bytes == 0) return "0 B";
    const char* units[] = {"B", "KB", "MB", "GB", "TB", "PB"};
    int unit_idx = 0;
    double d_bytes = static_cast<double>(bytes);
    while (d_bytes >= 1024.0 && unit_idx < 5) {
        d_bytes /= 1024.0;
        unit_idx++;
    }
    std::ostringstream ss;
    ss << std::fixed << std::setprecision(unit_idx == 0 ? 0 : 1) << d_bytes << " " << units[unit_idx];
    return ss.str();
}

std::string get_file_type_category(const std::string& filename, bool is_dir) {
    if (is_dir) return "directory";
    size_t dot_pos = filename.find_last_of('.');
    if (dot_pos == std::string::npos) return "file";

    std::string ext = filename.substr(dot_pos + 1);
    std::transform(ext.begin(), ext.end(), ext.begin(), ::tolower);

    // Categories
    if (ext == "jpg" || ext == "jpeg" || ext == "png" || ext == "gif" || ext == "webp" ||
        ext == "bmp" || ext == "svg" || ext == "ico" || ext == "avif") return "image";
    if (ext == "mp4" || ext == "webm" || ext == "mkv" || ext == "avi" || ext == "mov" ||
        ext == "wmv" || ext == "flv") return "video";
    if (ext == "mp3" || ext == "wav" || ext == "flac" || ext == "ogg" || ext == "m4a" ||
        ext == "aac" || ext == "opus") return "audio";
    if (ext == "zip" || ext == "rar" || ext == "7z" || ext == "tar" || ext == "gz" ||
        ext == "bz2" || ext == "xz") return "archive";
    if (ext == "md" || ext == "markdown") return "markdown";
    if (ext == "json" || ext == "yaml" || ext == "yml" || ext == "toml" || ext == "xml") return "json";
    if (ext == "js" || ext == "ts" || ext == "jsx" || ext == "tsx" || ext == "html" ||
        ext == "css" || ext == "py" || ext == "rs" || ext == "cpp" || ext == "c" ||
        ext == "h" || ext == "hpp" || ext == "cs" || ext == "go" || ext == "java" ||
        ext == "sh" || ext == "ps1" || ext == "bat") return "code";
    if (ext == "pdf") return "pdf";

    return "file";
}

// URL-encode a string for HTTP query param
static std::string url_encode(const std::string& value) {
    std::ostringstream escaped;
    escaped.fill('0');
    escaped << std::hex;

    for (char c : value) {
        if (isalnum((unsigned char)c) || c == '-' || c == '_' || c == '.' || c == '~') {
            escaped << c;
        } else {
            escaped << std::uppercase;
            escaped << '%' << std::setw(2) << int((unsigned char)c);
            escaped << std::nouppercase;
        }
    }
    return escaped.str();
}

nlohmann::json get_drives() {
    nlohmann::json drives = nlohmann::json::array();
    wchar_t buffer[1024];
    DWORD len = GetLogicalDriveStringsW(1024, buffer);
    if (len == 0) return drives;

    const wchar_t* p = buffer;
    while (*p) {
        std::wstring drive_root = p; // e.g. L"C:\\"
        std::string drive_letter = wide_to_utf8(drive_root.substr(0, 2)); // "C:"

        // Drive type
        UINT drive_type = GetDriveTypeW(drive_root.c_str());
        std::string type_str = "Local Disk";
        if (drive_type == DRIVE_REMOVABLE) type_str = "Removable";
        else if (drive_type == DRIVE_FIXED) type_str = "Local Disk";
        else if (drive_type == DRIVE_REMOTE) type_str = "Network Drive";
        else if (drive_type == DRIVE_CDROM) type_str = "CD/DVD Drive";
        else if (drive_type == DRIVE_RAMDISK) type_str = "RAM Disk";

        // Space info
        ULARGE_INTEGER free_bytes_available, total_number_of_bytes, total_number_of_free_bytes;
        uint64_t total_bytes = 0;
        uint64_t free_bytes = 0;
        if (GetDiskFreeSpaceExW(drive_root.c_str(), &free_bytes_available, &total_number_of_bytes, &total_number_of_free_bytes)) {
            total_bytes = total_number_of_bytes.QuadPart;
            free_bytes = free_bytes_available.QuadPart;
        }

        // Volume name
        wchar_t volume_name[MAX_PATH + 1] = {0};
        wchar_t file_system_name[MAX_PATH + 1] = {0};
        GetVolumeInformationW(drive_root.c_str(), volume_name, MAX_PATH + 1, NULL, NULL, NULL, file_system_name, MAX_PATH + 1);

        std::string label = wide_to_utf8(volume_name);
        if (label.empty()) {
            label = "Drive (" + drive_letter + ")";
        }

        nlohmann::json drive_obj = {
            {"letter", drive_letter},
            {"path", wide_to_utf8(drive_root)},
            {"name", label},
            {"type", type_str},
            {"file_system", wide_to_utf8(file_system_name)},
            {"total_bytes", total_bytes},
            {"free_bytes", free_bytes},
            {"total_formatted", format_bytes(total_bytes)},
            {"free_formatted", format_bytes(free_bytes)}
        };

        drives.push_back(drive_obj);
        p += wcslen(p) + 1;
    }

    return drives;
}

// Clean and normalize input path (convert file:/// to Windows path, normalize slashes)
static std::wstring normalize_input_path(const std::string& raw_path_utf8) {
    std::string s = raw_path_utf8;
    // Strip file:/// or file://
    if (s.rfind("file:///", 0) == 0) {
        s = s.substr(8);
    } else if (s.rfind("file://", 0) == 0) {
        s = s.substr(7);
    }

    // URL decode if needed (e.g. %20 -> space)
    std::string decoded;
    decoded.reserve(s.size());
    for (size_t i = 0; i < s.size(); ++i) {
        if (s[i] == '%' && i + 2 < s.size()) {
            int val = 0;
            std::istringstream is(s.substr(i + 1, 2));
            if (is >> std::hex >> val) {
                decoded += static_cast<char>(val);
                i += 2;
                continue;
            }
        }
        decoded += s[i];
    }

    // Convert forward slashes to backslashes
    for (char& c : decoded) {
        if (c == '/') c = '\\';
    }

    // Ensure drive paths like "C:" have trailing backslash "C:\"
    if (decoded.size() == 2 && decoded[1] == ':') {
        decoded += "\\";
    }

    return utf8_to_wide(decoded);
}

// Convert Windows FILETIME to formatted date string
static std::string format_filetime(const FILETIME& ft) {
    SYSTEMTIME st;
    FILETIME local_ft;
    FileTimeToLocalFileTime(&ft, &local_ft);
    FileTimeToSystemTime(&local_ft, &st);

    char buf[64];
    snprintf(buf, sizeof(buf), "%04d-%02d-%02d %02d:%02d:%02d",
             st.wYear, st.wMonth, st.wDay, st.wHour, st.wMinute, st.wSecond);
    return std::string(buf);
}

nlohmann::json list_dir(const std::string& path_utf8, int http_port) {
    std::wstring wpath = normalize_input_path(path_utf8);
    std::string clean_path_utf8 = wide_to_utf8(wpath);

    nlohmann::json result = {
        {"success", true},
        {"path", clean_path_utf8},
        {"items", nlohmann::json::array()},
        {"parent_path", nullptr},
        {"has_thumbs", false}
    };

    std::error_code ec;
    fs::path dir_path(wpath);
    if (!fs::exists(dir_path, ec) || !fs::is_directory(dir_path, ec)) {
        result["success"] = false;
        result["error"] = "Path does not exist or is not a directory: " + clean_path_utf8;
        return result;
    }

    // Compute parent directory
    if (dir_path.has_parent_path() && dir_path != dir_path.root_path()) {
        result["parent_path"] = wide_to_utf8(dir_path.parent_path().wstring());
    }

    // 1. Single Everything Batch Query for folder sizes (instant, depth=1)
    std::unordered_map<std::wstring, uint64_t> batch_folder_sizes =
        everything_client::get_directory_folder_sizes(wpath);

    // 2. Check for .thumbs folder and pre-index thumb files in-memory
    fs::path thumbs_dir = dir_path / L".thumbs";
    bool thumbs_exist = fs::exists(thumbs_dir, ec) && fs::is_directory(thumbs_dir, ec);
    result["has_thumbs"] = thumbs_exist;

    std::unordered_set<std::wstring> thumbs_set;
    if (thumbs_exist) {
        fs::directory_iterator thumbs_iter(thumbs_dir, fs::directory_options::skip_permission_denied, ec);
        fs::directory_iterator thumbs_end;
        while (thumbs_iter != thumbs_end && !ec) {
            std::wstring tname = thumbs_iter->path().filename().wstring();
            std::transform(tname.begin(), tname.end(), tname.begin(), ::towlower);
            thumbs_set.insert(tname);
            thumbs_iter.increment(ec);
        }
    }

    // 3. First pass: Collect all direct children to find sidecar files
    struct RawEntry {
        fs::path path;
        std::wstring filename_w;
        std::wstring stem_w;
        std::string filename_utf8;
        std::string ext;
        bool is_dir;
    };

    std::vector<RawEntry> raw_entries;
    std::unordered_map<std::wstring, std::vector<std::pair<std::string, std::string>>> sidecars_by_stem; // stem_lower -> [(name, path)]
    std::unordered_set<std::wstring> media_stems;

    fs::directory_iterator iter(dir_path, fs::directory_options::skip_permission_denied, ec);
    fs::directory_iterator end_iter;

    while (iter != end_iter && !ec) {
        std::wstring fn_w = iter->path().filename().wstring();
        if (fn_w == L".thumbs") {
            iter.increment(ec);
            continue;
        }

        bool is_dir = iter->is_directory(ec);
        std::string fn_utf8 = wide_to_utf8(fn_w);
        std::wstring stem_w = iter->path().stem().wstring();
        std::wstring ext_w = iter->path().extension().wstring();
        std::string ext = "";
        if (!ext_w.empty() && ext_w[0] == L'.') {
            ext = wide_to_utf8(ext_w.substr(1));
            std::transform(ext.begin(), ext.end(), ext.begin(), ::tolower);
        }

        std::string cat = get_file_type_category(fn_utf8, is_dir);
        std::wstring lower_stem = stem_w;
        std::transform(lower_stem.begin(), lower_stem.end(), lower_stem.begin(), ::towlower);

        if (!is_dir && (cat == "video" || cat == "audio" || cat == "image")) {
            media_stems.insert(lower_stem);
        }

        raw_entries.push_back({ iter->path(), fn_w, stem_w, fn_utf8, ext, is_dir });

        // Record sidecar candidates (.nfo, .json, .srt, .vsmeta, .sub, .idx)
        if (!is_dir && (ext == "nfo" || ext == "json" || ext == "srt" || ext == "vsmeta" || ext == "sub" || ext == "idx")) {
            sidecars_by_stem[lower_stem].push_back({ fn_utf8, wide_to_utf8(iter->path().wstring()) });
        }

        iter.increment(ec);
    }

    nlohmann::json items = nlohmann::json::array();

    for (const auto& re : raw_entries) {
        std::wstring entry_wpath = re.path.wstring();
        bool is_dir = re.is_dir;
        uint64_t file_size = 0;
        std::string size_str = "--";
        std::string mod_time_str = "--";
        std::string create_time_str = "--";

        // Get Win32 file attributes and times
        WIN32_FILE_ATTRIBUTE_DATA attr_data;
        if (GetFileAttributesExW(entry_wpath.c_str(), GetFileExInfoStandard, &attr_data)) {
            mod_time_str = format_filetime(attr_data.ftLastWriteTime);
            create_time_str = format_filetime(attr_data.ftCreationTime);

            if (!is_dir) {
                ULARGE_INTEGER uli;
                uli.LowPart = attr_data.nFileSizeLow;
                uli.HighPart = attr_data.nFileSizeHigh;
                file_size = uli.QuadPart;
                size_str = format_bytes(file_size);
            }
        }

        std::string category = get_file_type_category(re.filename_utf8, is_dir);

        // If directory, lookup size from batch Everything query (O(1))
        if (is_dir) {
            std::wstring lower_name = re.filename_w;
            std::transform(lower_name.begin(), lower_name.end(), lower_name.begin(), ::towlower);
            auto sz_it = batch_folder_sizes.find(lower_name);
            if (sz_it != batch_folder_sizes.end() && sz_it->second > 0) {
                file_size = sz_it->second;
                size_str = format_bytes(file_size);
            }
        }

        // Thumbnails matching from in-memory set
        bool item_has_thumb = false;
        bool item_has_video = false;
        std::string thumb_url = "";
        std::string video_url = "";

        if (thumbs_exist) {
            std::wstring lower_stem = re.stem_w;
            std::transform(lower_stem.begin(), lower_stem.end(), lower_stem.begin(), ::towlower);

            std::wstring lower_fn = re.filename_w;
            std::transform(lower_fn.begin(), lower_fn.end(), lower_fn.begin(), ::towlower);

            // Image candidates: stem.jpg, fn.jpg, stem.jpeg, stem.png, stem.webp
            std::vector<std::wstring> img_cands = {
                lower_stem + L".jpg",
                lower_fn + L".jpg",
                lower_stem + L".jpeg",
                lower_fn + L".jpeg",
                lower_stem + L".png",
                lower_fn + L".png",
                lower_stem + L".webp",
                lower_fn + L".webp"
            };

            for (const auto& cand : img_cands) {
                if (thumbs_set.find(cand) != thumbs_set.end()) {
                    item_has_thumb = true;
                    fs::path thumb_file = thumbs_dir / cand;
                    thumb_url = "http://127.0.0.1:" + std::to_string(http_port) +
                                "/stream?path=" + url_encode(wide_to_utf8(thumb_file.wstring()));
                    break;
                }
            }

            // Video preview candidates: stem.webm, fn.webm, stem.mp4, fn.mp4
            std::vector<std::wstring> vid_cands = {
                lower_stem + L".webm",
                lower_fn + L".webm",
                lower_stem + L".mp4",
                lower_fn + L".mp4"
            };

            for (const auto& cand : vid_cands) {
                if (thumbs_set.find(cand) != thumbs_set.end()) {
                    item_has_video = true;
                    fs::path vid_file = thumbs_dir / cand;
                    video_url = "http://127.0.0.1:" + std::to_string(http_port) +
                                "/stream?path=" + url_encode(wide_to_utf8(vid_file.wstring()));
                    break;
                }
            }
        }

        // Direct media stream URL
        std::string stream_url = "http://127.0.0.1:" + std::to_string(http_port) +
                                 "/stream?path=" + url_encode(wide_to_utf8(entry_wpath));

        // Sidecars attached to this file
        nlohmann::json item_sidecars = nlohmann::json::array();
        std::wstring lower_stem = re.stem_w;
        std::transform(lower_stem.begin(), lower_stem.end(), lower_stem.begin(), ::towlower);
        auto sc_it = sidecars_by_stem.find(lower_stem);
        if (sc_it != sidecars_by_stem.end()) {
            for (const auto& sc : sc_it->second) {
                if (sc.first != re.filename_utf8) { // Do not attach file to itself
                    item_sidecars.push_back({
                        {"name", sc.first},
                        {"path", sc.second},
                        {"streamUrl", "http://127.0.0.1:" + std::to_string(http_port) +
                                      "/stream?path=" + url_encode(sc.second)}
                    });
                }
            }
        }

        bool is_sidecar = false;
        if (!is_dir) {
            std::wstring lower_stem = re.stem_w;
            std::transform(lower_stem.begin(), lower_stem.end(), lower_stem.begin(), ::towlower);
            bool matches_media = (media_stems.find(lower_stem) != media_stems.end());
            if (re.ext == "nfo" || re.ext == "srt" || re.ext == "vsmeta" || re.ext == "sub" || re.ext == "idx") {
                is_sidecar = true;
            } else if (re.ext == "json" && matches_media) {
                is_sidecar = true;
            }
        }

        nlohmann::json item_obj = {
            {"name", re.filename_utf8},
            {"path", wide_to_utf8(entry_wpath)},
            {"isDirectory", is_dir},
            {"isParent", false},
            {"size", file_size},
            {"sizeFormatted", size_str},
            {"dateModified", mod_time_str},
            {"dateCreated", create_time_str},
            {"extension", re.ext},
            {"category", category},
            {"hasThumb", item_has_thumb},
            {"thumbUrl", thumb_url},
            {"hasVideoPreview", item_has_video},
            {"videoPreviewUrl", video_url},
            {"streamUrl", stream_url},
            {"isSidecar", is_sidecar},
            {"sidecars", item_sidecars}
        };

        items.push_back(item_obj);
    }

    result["items"] = items;
    return result;
}

bool open_file(const std::string& path_utf8) {
    std::wstring wpath = normalize_input_path(path_utf8);
    HINSTANCE hInst = ShellExecuteW(NULL, L"open", wpath.c_str(), NULL, NULL, SW_SHOWNORMAL);
    return (reinterpret_cast<INT_PTR>(hInst) > 32);
}

bool reveal_in_explorer(const std::string& path_utf8) {
    std::wstring wpath = normalize_input_path(path_utf8);
    std::wstring params = L"/select,\"" + wpath + L"\"";
    HINSTANCE hInst = ShellExecuteW(NULL, L"open", L"explorer.exe", params.c_str(), NULL, SW_SHOWNORMAL);
    return (reinterpret_cast<INT_PTR>(hInst) > 32);
}

} // namespace fs_ops
