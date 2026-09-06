#include "protocol.hpp"
#include "fs_ops.hpp"
#include "everything_client.hpp"

#include <iostream>
#include <io.h>
#include <fcntl.h>
#include <mutex>

namespace protocol {

static std::mutex g_io_mutex;

void init_stdio() {
    _setmode(_fileno(stdin), _O_BINARY);
    _setmode(_fileno(stdout), _O_BINARY);
}

bool read_message(nlohmann::json& out_msg) {
    uint32_t length = 0;
    std::cin.read(reinterpret_cast<char*>(&length), 4);
    if (!std::cin || std::cin.gcount() < 4) {
        return false;
    }

    if (length == 0 || length > 16 * 1024 * 1024) {
        return false;
    }

    std::string buffer(length, '\0');
    std::cin.read(&buffer[0], length);
    if (!std::cin || std::cin.gcount() < static_cast<std::streamsize>(length)) {
        return false;
    }

    try {
        out_msg = nlohmann::json::parse(buffer);
        return true;
    } catch (...) {
        return false;
    }
}

void write_message(const nlohmann::json& msg) {
    std::lock_guard<std::mutex> lock(g_io_mutex);
    std::string str = msg.dump();
    uint32_t length = static_cast<uint32_t>(str.size());

    std::cout.write(reinterpret_cast<const char*>(&length), 4);
    std::cout.write(str.data(), length);
    std::cout.flush();
}

nlohmann::json handle_request(const nlohmann::json& req, int http_port) {
    std::string action = req.value("action", "");
    auto id = req.value("id", nlohmann::json(0));

    if (action == "ping") {
        return {
            {"id", id},
            {"success", true},
            {"version", "1.2.0"},
            {"httpPort", http_port},
            {"everythingAvailable", everything_client::is_available()}
        };
    }

    if (action == "get_drives" || action == "getDrives") {
        return {
            {"id", id},
            {"success", true},
            {"drives", fs_ops::get_drives()},
            {"httpPort", http_port}
        };
    }

    if (action == "list_dir" || action == "listDir") {
        std::string path = req.value("path", "");
        nlohmann::json res = fs_ops::list_dir(path, http_port);
        res["id"] = id;
        res["httpPort"] = http_port;
        return res;
    }

    if (action == "open_file" || action == "openFile") {
        std::string path = req.value("path", "");
        bool ok = fs_ops::open_file(path);
        return {
            {"id", id},
            {"success", ok}
        };
    }

    if (action == "reveal") {
        std::string path = req.value("path", "");
        bool ok = fs_ops::reveal_in_explorer(path);
        return {
            {"id", id},
            {"success", ok}
        };
    }

    if (action == "search") {
        std::string query = req.value("query", "");
        uint32_t max_results = req.value("maxResults", 100);
        auto results = everything_client::search(fs_ops::utf8_to_wide(query), max_results);
        return {
            {"id", id},
            {"success", true},
            {"results", results}
        };
    }

    return {
        {"id", id},
        {"success", false},
        {"error", "Unknown action: " + action}
    };
}

void run(int http_port) {
    init_stdio();

    nlohmann::json req;
    while (read_message(req)) {
        nlohmann::json resp = handle_request(req, http_port);
        write_message(resp);
    }
}

} // namespace protocol
