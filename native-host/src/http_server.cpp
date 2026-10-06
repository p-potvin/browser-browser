#include "http_server.hpp"
#include "fs_ops.hpp"

#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>

#include <iostream>
#include <fstream>
#include <sstream>
#include <filesystem>
#include <algorithm>
#include <vector>

namespace fs = std::filesystem;

HttpServer::HttpServer() : port_(0), running_(false), listen_socket_(INVALID_SOCKET) {}

HttpServer::~HttpServer() {
    stop();
}

static std::string url_decode(const std::string& str) {
    std::string result;
    result.reserve(str.size());
    for (size_t i = 0; i < str.size(); ++i) {
        if (str[i] == '%' && i + 2 < str.size()) {
            int hex_val = 0;
            std::istringstream hex_stream(str.substr(i + 1, 2));
            if (hex_stream >> std::hex >> hex_val) {
                result += static_cast<char>(hex_val);
                i += 2;
                continue;
            }
        } else if (str[i] == '+') {
            result += ' ';
        } else {
            result += str[i];
        }
    }
    return result;
}

static std::string get_mime_type(const std::wstring& path) {
    fs::path p(path);
    std::string ext = fs_ops::wide_to_utf8(p.extension().wstring());
    if (!ext.empty() && ext[0] == '.') ext = ext.substr(1);
    std::transform(ext.begin(), ext.end(), ext.begin(), ::tolower);

    if (ext == "jpg" || ext == "jpeg") return "image/jpeg";
    if (ext == "png") return "image/png";
    if (ext == "gif") return "image/gif";
    if (ext == "webp") return "image/webp";
    if (ext == "svg") return "image/svg+xml";
    if (ext == "ico") return "image/x-icon";
    if (ext == "bmp") return "image/bmp";
    if (ext == "avif") return "image/avif";
    if (ext == "webm") return "video/webm";
    if (ext == "mp4" || ext == "m4v") return "video/mp4";
    if (ext == "mkv") return "video/x-matroska";
    if (ext == "mov") return "video/quicktime";
    if (ext == "avi") return "video/x-msvideo";
    if (ext == "wmv") return "video/x-ms-wmv";
    if (ext == "flv") return "video/x-flv";
    if (ext == "ts") return "video/mp2t";
    if (ext == "mp3") return "audio/mpeg";
    if (ext == "wav") return "audio/wav";
    if (ext == "ogg" || ext == "oga") return "audio/ogg";
    if (ext == "flac") return "audio/flac";
    if (ext == "aac") return "audio/aac";
    if (ext == "m4a") return "audio/mp4";
    if (ext == "opus") return "audio/opus";
    if (ext == "nfo" || ext == "txt" || ext == "log" || ext == "srt" || ext == "vsmeta" || ext == "sub" || ext == "idx") return "text/plain; charset=utf-8";
    if (ext == "json") return "application/json";
    if (ext == "pdf") return "application/pdf";

    return "application/octet-stream";
}

bool HttpServer::start(int base_port) {
    if (running_) return true;

    for (int p = base_port; p < base_port + 20; ++p) {
        SOCKET s = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
        if (s == INVALID_SOCKET) continue;

        int opt = 1;
        setsockopt(s, SOL_SOCKET, SO_REUSEADDR, (const char*)&opt, sizeof(opt));

        sockaddr_in addr = {};
        addr.sin_family = AF_INET;
        addr.sin_addr.s_addr = inet_addr("127.0.0.1");
        addr.sin_port = htons(static_cast<u_short>(p));

        if (bind(s, (sockaddr*)&addr, sizeof(addr)) == 0 && listen(s, SOMAXCONN) == 0) {
            listen_socket_ = s;
            port_ = p;
            running_ = true;
            server_thread_ = std::thread(&HttpServer::server_thread_func, this);
            return true;
        }

        closesocket(s);
    }

    return false;
}

void HttpServer::stop() {
    if (!running_) return;
    running_ = false;

    if (listen_socket_ != INVALID_SOCKET) {
        closesocket(listen_socket_);
        listen_socket_ = INVALID_SOCKET;
    }

    if (server_thread_.joinable()) {
        server_thread_.join();
    }
}

void HttpServer::server_thread_func() {
    while (running_) {
        SOCKET client = accept(listen_socket_, NULL, NULL);
        if (client == INVALID_SOCKET) {
            if (!running_) break;
            continue;
        }

        std::thread([this, client]() {
            handle_client(client);
        }).detach();
    }
}

void HttpServer::handle_client(uintptr_t client_socket) {
    SOCKET s = static_cast<SOCKET>(client_socket);

    // Set 5-second socket timeouts to prevent lingering zombie threads
    DWORD timeout_ms = 5000;
    setsockopt(s, SOL_SOCKET, SO_RCVTIMEO, (const char*)&timeout_ms, sizeof(timeout_ms));
    setsockopt(s, SOL_SOCKET, SO_SNDTIMEO, (const char*)&timeout_ms, sizeof(timeout_ms));

    char buffer[4096];
    int bytes_read = recv(s, buffer, sizeof(buffer) - 1, 0);
    if (bytes_read <= 0) {
        closesocket(s);
        return;
    }
    buffer[bytes_read] = '\0';

    std::string request_str(buffer);
    std::istringstream req_stream(request_str);
    std::string method, uri, version;
    req_stream >> method >> uri >> version;

    // Handle CORS preflight
    if (method == "OPTIONS") {
        std::string resp =
            "HTTP/1.1 200 OK\r\n"
            "Access-Control-Allow-Origin: *\r\n"
            "Access-Control-Allow-Methods: GET, HEAD, OPTIONS\r\n"
            "Access-Control-Allow-Headers: Range, Content-Type\r\n"
            "Content-Length: 0\r\n\r\n";
        send(s, resp.data(), (int)resp.size(), 0);
        closesocket(s);
        return;
    }

    // Health check endpoint
    if (uri == "/ping") {
        std::string body = "{\"status\":\"ok\",\"service\":\"browser-browser-native-host\"}";
        std::ostringstream resp;
        resp << "HTTP/1.1 200 OK\r\n"
             << "Content-Type: application/json\r\n"
             << "Access-Control-Allow-Origin: *\r\n"
             << "Content-Length: " << body.size() << "\r\n\r\n"
             << body;
        std::string r = resp.str();
        send(s, r.data(), (int)r.size(), 0);
        closesocket(s);
        return;
    }

    // Stream endpoint: /stream?path=...
    if (uri.rfind("/stream?", 0) != 0) {
        std::string resp = "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n";
        send(s, resp.data(), (int)resp.size(), 0);
        closesocket(s);
        return;
    }

    // Extract path query param
    size_t query_pos = uri.find("path=");
    if (query_pos == std::string::npos) {
        std::string resp = "HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\n\r\n";
        send(s, resp.data(), (int)resp.size(), 0);
        closesocket(s);
        return;
    }

    std::string raw_path = uri.substr(query_pos + 5);
    size_t amp_pos = raw_path.find('&');
    if (amp_pos != std::string::npos) {
        raw_path = raw_path.substr(0, amp_pos);
    }

    std::string decoded_path = url_decode(raw_path);
    std::wstring wpath = fs_ops::utf8_to_wide(decoded_path);

    std::error_code ec;
    if (!fs::exists(wpath, ec) || fs::is_directory(wpath, ec)) {
        std::string resp = "HTTP/1.1 404 File Not Found\r\nContent-Length: 0\r\n\r\n";
        send(s, resp.data(), (int)resp.size(), 0);
        closesocket(s);
        return;
    }

    uint64_t file_size = fs::file_size(wpath, ec);
    std::string mime_type = get_mime_type(wpath);

    // Check for Range header
    std::string range_header;
    size_t range_pos = request_str.find("Range: bytes=");
    if (range_pos == std::string::npos) {
        range_pos = request_str.find("range: bytes=");
    }

    uint64_t start_byte = 0;
    uint64_t end_byte = (file_size > 0) ? file_size - 1 : 0;
    bool is_range_request = false;

    if (range_pos != std::string::npos && file_size > 0) {
        size_t val_start = range_pos + 13;
        size_t line_end = request_str.find("\r\n", val_start);
        std::string range_val = request_str.substr(val_start, line_end - val_start);

        size_t dash = range_val.find('-');
        if (dash != std::string::npos) {
            std::string start_str = range_val.substr(0, dash);
            std::string end_str = range_val.substr(dash + 1);

            if (!start_str.empty()) {
                start_byte = std::stoull(start_str);
            }
            if (!end_str.empty()) {
                end_byte = std::stoull(end_str);
            }
            if (end_byte >= file_size) {
                end_byte = file_size - 1;
            }
            if (start_byte <= end_byte) {
                is_range_request = true;
            }
        }
    }

    std::ifstream file(wpath, std::ios::binary);
    if (!file) {
        std::string resp = "HTTP/1.1 500 Internal Error\r\nContent-Length: 0\r\n\r\n";
        send(s, resp.data(), (int)resp.size(), 0);
        closesocket(s);
        return;
    }

    bool is_thumb = (decoded_path.find("\\.thumbs\\") != std::string::npos ||
                     decoded_path.find("/.thumbs/") != std::string::npos);
    std::string cache_header = is_thumb ? "Cache-Control: public, max-age=86400, immutable\r\n"
                                        : "Cache-Control: no-cache, no-store, must-revalidate\r\n";

    if (is_range_request) {
        uint64_t content_length = end_byte - start_byte + 1;
        std::ostringstream header;
        header << "HTTP/1.1 206 Partial Content\r\n"
               << "Content-Type: " << mime_type << "\r\n"
               << "Content-Range: bytes " << start_byte << "-" << end_byte << "/" << file_size << "\r\n"
               << "Content-Length: " << content_length << "\r\n"
               << "Accept-Ranges: bytes\r\n"
               << "Access-Control-Allow-Origin: *\r\n"
               << cache_header
               << "Connection: close\r\n\r\n";

        std::string h = header.str();
        send(s, h.data(), (int)h.size(), 0);

        if (method != "HEAD") {
            file.seekg(start_byte);
            char chunk[65536];
            uint64_t remaining = content_length;
            while (remaining > 0 && file) {
                size_t to_read = (remaining < sizeof(chunk)) ? static_cast<size_t>(remaining) : sizeof(chunk);
                file.read(chunk, to_read);
                std::streamsize bytes_have = file.gcount();
                if (bytes_have <= 0) break;
                int sent = send(s, chunk, (int)bytes_have, 0);
                if (sent <= 0) break;
                remaining -= sent;
            }
        }
    } else {
        std::ostringstream header;
        header << "HTTP/1.1 200 OK\r\n"
               << "Content-Type: " << mime_type << "\r\n"
               << "Content-Length: " << file_size << "\r\n"
               << "Accept-Ranges: bytes\r\n"
               << "Access-Control-Allow-Origin: *\r\n"
               << cache_header
               << "Connection: close\r\n\r\n";

        std::string h = header.str();
        send(s, h.data(), (int)h.size(), 0);

        if (method != "HEAD") {
            char chunk[65536];
            while (file) {
                file.read(chunk, sizeof(chunk));
                std::streamsize bytes_have = file.gcount();
                if (bytes_have <= 0) break;
                int sent = send(s, chunk, (int)bytes_have, 0);
                if (sent <= 0) break;
            }
        }
    }

    closesocket(s);
}
