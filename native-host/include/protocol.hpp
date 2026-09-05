#pragma once

#include <string>
#include <mutex>
#include <nlohmann/json.hpp>

namespace protocol {

// Initialize stdio in binary mode for native messaging
void init_stdio();

// Read a single length-prefixed JSON message from stdin
bool read_message(nlohmann::json& out_msg);

// Send a single length-prefixed JSON message to stdout
void write_message(const nlohmann::json& msg);

// Handle an incoming request and return the JSON response
nlohmann::json handle_request(const nlohmann::json& req, int http_port);

// Main stdio processing loop
void run(int http_port);

} // namespace protocol
