#include "raggae_client.hpp"
#include "fs_ops.hpp"

#include <windows.h>
#include <winhttp.h>
#include <algorithm>
#include <nlohmann/json.hpp>

namespace raggae_client {

namespace {

std::string url_encode(const std::string& s) {
    static const char* hex = "0123456789ABCDEF";
    std::string out;
    for (unsigned char c : s) {
        if (isalnum(c) || c == '-' || c == '_' || c == '.' || c == '~') {
            out += static_cast<char>(c);
        } else {
            out += '%';
            out += hex[c >> 4];
            out += hex[c & 15];
        }
    }
    return out;
}

// GET http://127.0.0.1:8750<path>; empty on any failure. Short timeouts: a listing must never wait on the gateway.
std::string http_get(const std::wstring& path) {
    std::string body;
    HINTERNET session = WinHttpOpen(L"browser-browser", WINHTTP_ACCESS_TYPE_NO_PROXY, WINHTTP_NO_PROXY_NAME,
                                    WINHTTP_NO_PROXY_BYPASS, 0);
    if (!session) return body;
    WinHttpSetTimeouts(session, 1000, 1000, 2000, 3000);
    HINTERNET connect = WinHttpConnect(session, L"127.0.0.1", 8750, 0);
    HINTERNET request = connect ? WinHttpOpenRequest(connect, L"GET", path.c_str(), nullptr, WINHTTP_NO_REFERER,
                                                     WINHTTP_DEFAULT_ACCEPT_TYPES, 0) : nullptr;
    if (request &&
        WinHttpSendRequest(request, L"x-vw-project: browser-browser\r\n", static_cast<DWORD>(-1L),
                           WINHTTP_NO_REQUEST_DATA, 0, 0, 0) &&
        WinHttpReceiveResponse(request, nullptr)) {
        DWORD status = 0, size = sizeof(status);
        WinHttpQueryHeaders(request, WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER, WINHTTP_HEADER_NAME_BY_INDEX,
                            &status, &size, WINHTTP_NO_HEADER_INDEX);
        if (status == 200) {
            DWORD avail = 0;
            while (WinHttpQueryDataAvailable(request, &avail) && avail > 0) {
                std::string chunk(avail, '\0');
                DWORD got = 0;
                if (!WinHttpReadData(request, chunk.data(), avail, &got) || got == 0) break;
                body.append(chunk.data(), got);
            }
        }
    }
    if (request) WinHttpCloseHandle(request);
    if (connect) WinHttpCloseHandle(connect);
    WinHttpCloseHandle(session);
    return body;
}

} // namespace

std::unordered_map<std::wstring, uint64_t> get_directory_folder_sizes(const std::wstring& dir_path) {
    std::unordered_map<std::wstring, uint64_t> sizes;
    std::string route = "/v1/files/sizes?limit=5000&path=" + url_encode(fs_ops::wide_to_utf8(dir_path));
    std::string body = http_get(fs_ops::utf8_to_wide(route));
    if (body.empty()) return sizes;
    auto data = nlohmann::json::parse(body, nullptr, false);
    if (data.is_discarded() || !data.contains("children")) return sizes;
    for (const auto& child : data["children"]) {
        std::wstring name = fs_ops::utf8_to_wide(child.value("name", std::string()));
        std::transform(name.begin(), name.end(), name.begin(), ::towlower);
        sizes[name] = child.value("bytes", static_cast<uint64_t>(0));
    }
    return sizes;
}

} // namespace raggae_client
