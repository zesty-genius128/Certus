#!/usr/bin/env node

/**
 * Fixed MCP Bridge Client - Properly handles MCP protocol
 */

const SERVER_URL = process.env.MCP_SERVER_URL || 'http://localhost:3000/mcp';
const TIMEOUT = parseInt(process.env.MCP_TIMEOUT) || 30000;

console.error(`🌉 MCP Bridge Client starting...`);
console.error(`🔗 Server URL: ${SERVER_URL}`);
console.error(`⏱️  Timeout: ${TIMEOUT}ms`);

class MCPBridge {
    constructor() {
        this.serverUrl = SERVER_URL;
        this.requestId = 1;
    }

    async start() {
        // Test server connectivity first
        try {
            const healthUrl = this.serverUrl.replace('/mcp', '/health');
            const healthResponse = await fetch(healthUrl);
            if (!healthResponse.ok) {
                throw new Error(`Server health check failed: ${healthResponse.status}`);
            }
            console.error(`✅ Server connectivity confirmed`);
        } catch (error) {
            console.error(`❌ Cannot connect to server: ${error.message}`);
            process.exit(1);
        }

        // Set up stdio handling with proper buffering
        process.stdin.setEncoding('utf8');
        let inputBuffer = '';

        process.stdin.on('data', async (chunk) => {
            inputBuffer += chunk;
            
            // Process complete JSON-RPC messages (newline delimited)
            let newlineIndex;
            while ((newlineIndex = inputBuffer.indexOf('\n')) !== -1) {
                const message = inputBuffer.slice(0, newlineIndex).trim();
                inputBuffer = inputBuffer.slice(newlineIndex + 1);
                
                if (message) {
                    await this.handleMessage(message);
                }
            }
        });

        process.stdin.on('end', () => {
            console.error('📪 Client disconnected');
            process.exit(0);
        });

        // Handle termination signals
        process.on('SIGTERM', () => this.shutdown());
        process.on('SIGINT', () => this.shutdown());
        process.on('SIGHUP', () => this.shutdown());
    }

    async handleMessage(messageText) {
        try {
            console.error(`📨 Received: ${messageText.substring(0, 100)}${messageText.length > 100 ? '...' : ''}`);
            
            const request = JSON.parse(messageText);
            
            // Validate the request has required fields
            if (!request.jsonrpc || request.jsonrpc !== '2.0') {
                this.sendError(request.id || null, -32600, 'Invalid Request: Missing or invalid jsonrpc field');
                return;
            }

            if (!request.method) {
                this.sendError(request.id || null, -32600, 'Invalid Request: Missing method field');
                return;
            }

            // Forward to HTTP server
            const httpRequest = {
                jsonrpc: '2.0',
                id: request.id || this.requestId++,
                method: request.method,
                params: request.params || {}
            };

            console.error(`🚀 Forwarding to server: ${request.method}`);

            // Make HTTP request with timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

            try {
                const httpResponse = await fetch(this.serverUrl, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(httpRequest),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!httpResponse.ok) {
                    throw new Error(`HTTP ${httpResponse.status}: ${httpResponse.statusText}`);
                }

                const httpResult = await httpResponse.json();
                console.error(`📥 Response received: ${JSON.stringify(httpResult).substring(0, 100)}...`);
                
                // Ensure response has proper format
                const response = {
                    jsonrpc: '2.0',
                    id: request.id,
                    ...(httpResult.result ? { result: httpResult.result } : {}),
                    ...(httpResult.error ? { error: httpResult.error } : {})
                };

                // Send complete response as single line
                const responseText = JSON.stringify(response);
                process.stdout.write(responseText + '\n');
                console.error(`✅ Sent response (${responseText.length} chars)`);
                
            } catch (fetchError) {
                clearTimeout(timeoutId);
                
                if (fetchError.name === 'AbortError') {
                    this.sendError(request.id, -32603, `Request timeout after ${TIMEOUT}ms`);
                } else {
                    this.sendError(request.id, -32603, `Server error: ${fetchError.message}`);
                }
            }
            
        } catch (parseError) {
            console.error(`❌ JSON parse error: ${parseError.message}`);
            this.sendError(null, -32700, 'Parse error: Invalid JSON');
        }
    }

    sendError(id, code, message) {
        const errorResponse = {
            jsonrpc: '2.0',
            id: id,
            error: {
                code: code,
                message: message
            }
        };
        
        const responseText = JSON.stringify(errorResponse);
        process.stdout.write(responseText + '\n');
        console.error(`❌ Sent error: ${message}`);
    }

    shutdown() {
        console.error('🛑 Bridge shutting down...');
        process.exit(0);
    }
}

// Start the bridge
async function main() {
    try {
        const bridge = new MCPBridge();
        await bridge.start();
        console.error('🎉 MCP Bridge Client ready!');
    } catch (error) {
        console.error(`💥 Fatal error: ${error.message}`);
        process.exit(1);
    }
}

main().catch(error => {
    console.error(`💥 Unhandled error: ${error.message}`);
    process.exit(1);
});