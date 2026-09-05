#include "protocol.hpp"
#include "http_server.hpp"

#include <winsock2.h>
#include <windows.h>
#include <fstream>
#include <iostream>

int main(int argc, char* argv[]) {
    (void)argc;
    (void)argv;

    // Initialize Winsock
    WSADATA wsa_data;
    if (WSAStartup(MAKEWORD(2, 2), &wsa_data) != 0) {
        return 1;
    }

    // Start local media streaming HTTP server
    HttpServer server;
    bool server_started = server.start(45123);

    // Optional debug log
    wchar_t temp_path[MAX_PATH];
    if (GetTempPathW(MAX_PATH, temp_path)) {
        std::wstring log_path = std::wstring(temp_path) + L"browser_browser_host.log";
        std::ofstream log(log_path, std::ios::app);
        if (log) {
            log << "browser_browser_host started. HTTP streaming on port: "
                << server.get_port() << " (status: " << (server_started ? "ok" : "failed") << ")" << std::endl;
        }
    }

    // Enter Native Messaging stdio event loop
    protocol::run(server.get_port());

    // Clean up
    server.stop();
    WSACleanup();

    return 0;
}
