#!/usr/bin/env node

import express from 'express';
import cors from 'cors';

// Get PORT from Railway environment
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'; // Railway requires binding to 0.0.0.0

console.log('Starting server...');
console.log('PORT:', PORT);
console.log('HOST:', HOST);

// Create Express app
const app = express();

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false
}));

app.use(express.json({ limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Basic tools for testing (no external dependencies)
const BASIC_TOOLS = [
    {
        name: "echo_test",
        description: "Simple echo test to verify MCP connectivity",
        inputSchema: {
            type: "object",
            properties: {
                message: { 
                    type: "string", 
                    description: "Message to echo back" 
                }
            },
            required: ["message"]
        }
    },
    {
        name: "server_info",
        description: "Get server information and status",
        inputSchema: {
            type: "object",
            properties: {},
            required: []
        }
    }
];

// Simple tool handler (no external dependencies)
async function handleBasicToolCall(name, args) {
    try {
        switch (name) {
            case "echo_test": {
                const { message } = args;
                const result = {
                    echo: message,
                    timestamp: new Date().toISOString(),
                    server: "Railway MCP Server"
                };
                return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
            }

            case "server_info": {
                const result = {
                    server_name: "Minimal MCP Server",
                    version: "1.0.0",
                    status: "running",
                    platform: "Railway",
                    timestamp: new Date().toISOString(),
                    environment: process.env.NODE_ENV || 'production',
                    uptime_seconds: Math.floor(process.uptime())
                };
                return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
            }

            default:
                throw new Error(`Unknown tool: ${name}`);
        }
    } catch (error) {
        return {
            content: [{ type: "text", text: `Error: ${error.message}` }],
            isError: true
        };
    }
}

// Health check endpoint - MUST work for Railway
app.get('/health', (req, res) => {
    console.log('Health check requested');
    res.status(200).json({ 
        status: 'healthy',
        timestamp: new Date().toISOString(),
        server: 'Minimal MCP Server',
        version: '1.0.0',
        uptime: Math.floor(process.uptime()),
        tools_available: BASIC_TOOLS.length
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        service: 'Minimal MCP Server',
        version: '1.0.0',
        status: 'running',
        platform: 'Railway',
        tools_available: BASIC_TOOLS.length,
        endpoints: {
            health: '/health',
            mcp: '/mcp'
        },
        timestamp: new Date().toISOString()
    });
});

// MCP endpoint
app.post('/mcp', async (req, res) => {
    console.log('MCP request:', req.body?.method, 'ID:', req.body?.id);

    // Set standard JSON response headers
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache');

    try {
        const request = req.body;
        
        // Validate JSON-RPC 2.0
        if (!request || typeof request !== 'object') {
            return res.status(400).json({
                jsonrpc: '2.0',
                id: null,
                error: { code: -32700, message: 'Parse error' }
            });
        }

        if (request.jsonrpc !== '2.0') {
            return res.status(400).json({
                jsonrpc: '2.0',
                id: request.id || null,
                error: { code: -32600, message: 'Invalid Request' }
            });
        }

        if (!request.method) {
            return res.status(400).json({
                jsonrpc: '2.0',
                id: request.id || null,
                error: { code: -32600, message: 'Missing method' }
            });
        }

        let result;
        
        // Handle MCP methods
        switch (request.method) {
            case 'initialize':
                console.log('Initialize request received');
                result = {
                    protocolVersion: '2024-11-05',
                    capabilities: {
                        tools: {},
                        resources: {},
                        prompts: {}
                    },
                    serverInfo: {
                        name: 'Minimal MCP Server',
                        version: '1.0.0'
                    }
                };
                break;

            case 'tools/list':
                console.log('Tools list request');
                result = { tools: BASIC_TOOLS };
                break;

            case 'tools/call':
                if (!request.params || !request.params.name) {
                    return res.status(400).json({
                        jsonrpc: '2.0',
                        id: request.id,
                        error: { code: -32602, message: 'Invalid params: tool name required' }
                    });
                }
                
                console.log('Tool call:', request.params.name);
                result = await handleBasicToolCall(request.params.name, request.params.arguments || {});
                break;

            default:
                return res.status(400).json({
                    jsonrpc: '2.0',
                    id: request.id || null,
                    error: { code: -32601, message: `Method not found: ${request.method}` }
                });
        }

        // Return success response
        res.json({
            jsonrpc: '2.0',
            id: request.id,
            result: result
        });

    } catch (error) {
        console.error('MCP endpoint error:', error);
        res.status(500).json({
            jsonrpc: '2.0',
            id: req.body?.id || null,
            error: { code: -32603, message: `Internal error: ${error.message}` }
        });
    }
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ 
        error: 'Not found',
        available_endpoints: ['/', '/health', '/mcp']
    });
});

// Error handling
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({ 
        error: 'Internal server error',
        message: error.message
    });
});

// Start server with error handling
const server = app.listen(PORT, HOST, () => {
    console.log(`✅ Minimal MCP Server started successfully!`);
    console.log(`   Host: ${HOST}`);
    console.log(`   Port: ${PORT}`);
    console.log(`   Health: http://${HOST}:${PORT}/health`);
    console.log(`   MCP: http://${HOST}:${PORT}/mcp`);
    console.log(`   Tools: ${BASIC_TOOLS.length}`);
    console.log(`   Environment: ${process.env.NODE_ENV || 'production'}`);
});

server.on('error', (error) => {
    console.error('❌ Server failed to start:', error);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

console.log('Server setup complete, waiting for Railway...');