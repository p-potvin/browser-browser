#pragma once

#include <string>
#include <atomic>
#include <thread>

class HttpServer {
public:
    HttpServer();
    ~HttpServer();

    // Start server on specified port (or find next available port starting from base_port)
    bool start(int base_port = 45123);

    // Stop server and clean up socket
    void stop();

    // Get the active listening port
    int get_port() const { return port_; }

    // Check if server is running
    bool is_running() const { return running_; }

private:
    void server_thread_func();
    void handle_client(uintptr_t client_socket);

    int port_;
    std::atomic<bool> running_;
    std::thread server_thread_;
    uintptr_t listen_socket_;
};
