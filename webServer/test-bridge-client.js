#!/usr/bin/env node

/**
 * Test script for MCP Bridge Client
 * 
 * This script tests the bridge client to ensure it can properly communicate
 * with the hosted MCP server before configuring Claude Desktop.
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class BridgeClientTester {
    constructor(serverUrl = 'http://localhost:3000/mcp') {
        this.serverUrl = serverUrl;
        this.bridgeClientPath = path.join(__dirname, 'mcp-bridge-client.js');
        this.timeout = 10000; // 10 seconds
    }

    async testServerDirectly() {
        console.log('🔍 Testing direct server connection...');
        
        try {
            const healthUrl = this.serverUrl.replace('/mcp', '/health');
            const response = await fetch(healthUrl, { timeout: 5000 });
            
            if (response.ok) {
                const health = await response.json();
                console.log(`✅ Server is healthy: ${health.server} v${health.version}`);
                return true;
            } else {
                console.log(`❌ Server health check failed: ${response.status}`);
                return false;
            }
        } catch (error) {
            console.log(`❌ Cannot connect to server: ${error.message}`);
            return false;
        }
    }

    async testMcpEndpoint() {
        console.log('🔍 Testing MCP endpoint directly...');
        
        try {
            const response = await fetch(this.serverUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'tools/list'
                }),
                timeout: 5000
            });

            if (response.ok) {
                const result = await response.json();
                if (result.result && result.result.tools) {
                    console.log(`✅ MCP endpoint working: ${result.result.tools.length} tools available`);
                    return true;
                } else {
                    console.log(`❌ MCP endpoint returned unexpected format`);
                    return false;
                }
            } else {
                console.log(`❌ MCP endpoint failed: ${response.status}`);
                return false;
            }
        } catch (error) {
            console.log(`❌ MCP endpoint error: ${error.message}`);
            return false;
        }
    }

    async testBridgeClient() {
        console.log('🔍 Testing bridge client...');
        
        return new Promise((resolve) => {
            let success = false;
            let output = '';
            let errorOutput = '';

            // Spawn the bridge client
            const bridge = spawn('node', [this.bridgeClientPath], {
                env: {
                    ...process.env,
                    MCP_SERVER_URL: this.serverUrl,
                    MCP_BRIDGE_TYPE: 'simple'
                }
            });

            // Set up timeout
            const timeout = setTimeout(() => {
                if (!success) {
                    bridge.kill();
                    console.log(`❌ Bridge client test timed out after ${this.timeout}ms`);
                    resolve(false);
                }
            }, this.timeout);

            // Handle bridge output
            bridge.stderr.on('data', (data) => {
                errorOutput += data.toString();
                
                // Look for successful startup message
                if (data.toString().includes('Server connectivity confirmed')) {
                    console.log('✅ Bridge client started successfully');
                    
                    // Send a test message
                    const testMessage = {
                        jsonrpc: '2.0',
                        id: 1,
                        method: 'tools/list'
                    };
                    
                    bridge.stdin.write(JSON.stringify(testMessage) + '\n');
                }
            });

            // Buffer stdout data properly for large responses
            let stdoutBuffer = '';
            bridge.stdout.on('data', (data) => {
                stdoutBuffer += data.toString();
                
                // Process complete lines (JSON responses should be line-delimited)
                let newlineIndex;
                while ((newlineIndex = stdoutBuffer.indexOf('\n')) !== -1) {
                    const line = stdoutBuffer.slice(0, newlineIndex).trim();
                    stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);
                    
                    if (line) {
                        try {
                            const response = JSON.parse(line);
                            
                            if (response.result && response.result.tools) {
                                console.log(`✅ Bridge client test successful: ${response.result.tools.length} tools returned`);
                                success = true;
                                clearTimeout(timeout);
                                bridge.kill();
                                resolve(true);
                            } else if (response.error) {
                                console.log(`❌ Bridge client returned error: ${response.error.message}`);
                                clearTimeout(timeout);
                                bridge.kill();
                                resolve(false);
                            }
                        } catch (error) {
                            // If JSON parse fails, might be partial data - continue buffering
                            console.log(`JSON parse error on line: ${error.message}`);
                        }
                    }
                }
            });

            bridge.on('error', (error) => {
                console.log(`❌ Bridge client spawn error: ${error.message}`);
                clearTimeout(timeout);
                resolve(false);
            });

            bridge.on('exit', (code) => {
                clearTimeout(timeout);
                if (!success) {
                    console.log(`❌ Bridge client exited with code: ${code}`);
                    if (errorOutput) {
                        console.log('Error output:', errorOutput);
                    }
                    resolve(false);
                }
            });
        });
    }

    async testToolCall() {
        console.log('🔍 Testing sample tool call through bridge...');
        
        return new Promise((resolve) => {
            let success = false;
            let responseReceived = false;

            const bridge = spawn('node', [this.bridgeClientPath], {
                env: {
                    ...process.env,
                    MCP_SERVER_URL: this.serverUrl,
                    MCP_BRIDGE_TYPE: 'simple'
                }
            });

            const timeout = setTimeout(() => {
                if (!success) {
                    bridge.kill();
                    console.log(`❌ Tool call test timed out`);
                    resolve(false);
                }
            }, 15000); // Longer timeout for actual tool call

            bridge.stderr.on('data', (data) => {
                if (data.toString().includes('Server connectivity confirmed') && !responseReceived) {
                    // Send a tool call request
                    const toolCallMessage = {
                        jsonrpc: '2.0',
                        id: 2,
                        method: 'tools/call',
                        params: {
                            name: 'get_drug_label_only',
                            arguments: {
                                drug_identifier: 'aspirin'
                            }
                        }
                    };
                    
                    console.log('   Sending sample tool call (aspirin drug label)...');
                    bridge.stdin.write(JSON.stringify(toolCallMessage) + '\n');
                    responseReceived = true;
                }
            });

            // Buffer stdout data properly for large responses
            let stdoutBuffer = '';
            bridge.stdout.on('data', (data) => {
                stdoutBuffer += data.toString();
                
                // Process complete lines (JSON responses should be line-delimited)
                let newlineIndex;
                while ((newlineIndex = stdoutBuffer.indexOf('\n')) !== -1) {
                    const line = stdoutBuffer.slice(0, newlineIndex).trim();
                    stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);
                    
                    if (line) {
                        try {
                            const response = JSON.parse(line);
                            
                            if (response.id === 2) { // Our tool call response
                                if (response.result && response.result.content) {
                                    console.log('✅ Tool call successful: received drug label data');
                                    success = true;
                                } else if (response.error) {
                                    console.log(`❌ Tool call failed: ${response.error.message}`);
                                } else {
                                    console.log('❌ Tool call returned unexpected format');
                                }
                                
                                clearTimeout(timeout);
                                bridge.kill();
                                resolve(success);
                            }
                        } catch (error) {
                            // If JSON parse fails, might be partial data - continue buffering
                            console.log(`JSON parse error: ${error.message.substring(0, 100)}`);
                        }
                    }
                }
            });

            bridge.on('error', (error) => {
                console.log(`❌ Tool call test error: ${error.message}`);
                clearTimeout(timeout);
                resolve(false);
            });

            bridge.on('exit', (code) => {
                clearTimeout(timeout);
                if (!success && code !== 0) {
                    console.log(`❌ Tool call test failed, exit code: ${code}`);
                    resolve(false);
                }
            });
        });
    }

    async runAllTests() {
        console.log('🧪 MCP Bridge Client Test Suite\n');
        console.log(`Server URL: ${this.serverUrl}\n`);

        let allPassed = true;

        // Test 1: Direct server connection
        const serverTest = await this.testServerDirectly();
        allPassed = allPassed && serverTest;

        if (!serverTest) {
            console.log('\n❌ Server is not running. Please start the server first:');
            console.log('   npm start');
            console.log('   # or');
            console.log('   docker-compose up -d\n');
            return false;
        }

        console.log();

        // Test 2: MCP endpoint
        const mcpTest = await this.testMcpEndpoint();
        allPassed = allPassed && mcpTest;

        if (!mcpTest) {
            console.log('\n❌ MCP endpoint is not working properly.\n');
            return false;
        }

        console.log();

        // Test 3: Bridge client basic functionality
        const bridgeTest = await this.testBridgeClient();
        allPassed = allPassed && bridgeTest;

        if (!bridgeTest) {
            console.log('\n❌ Bridge client is not working properly.\n');
            return false;
        }

        console.log();

        // Test 4: Actual tool call
        const toolTest = await this.testToolCall();
        allPassed = allPassed && toolTest;

        console.log('\n' + '='.repeat(50));
        if (allPassed) {
            console.log('🎉 All tests passed!');
            console.log('\nYour bridge client is ready to use with Claude Desktop.');
            console.log('Run: node setup-claude-bridge.js');
        } else {
            console.log('❌ Some tests failed.');
            console.log('\nPlease fix the issues before configuring Claude Desktop.');
        }
        console.log('='.repeat(50));

        return allPassed;
    }
}

// Main execution
async function main() {
    const args = process.argv.slice(2);
    const serverUrl = args[0] || process.env.MCP_SERVER_URL || 'http://localhost:3000/mcp';
    
    if (args.includes('--help') || args.includes('-h')) {
        console.log(`
MCP Bridge Client Tester

Usage:
  node test-bridge-client.js [server-url]

Examples:
  node test-bridge-client.js                           # Test localhost:3000
  node test-bridge-client.js http://192.168.1.100:3000/mcp  # Test remote server
  
Environment Variables:
  MCP_SERVER_URL    # Default server URL if not provided as argument

This script will test:
1. Server connectivity and health
2. MCP endpoint functionality  
3. Bridge client communication
4. Sample tool call execution
        `);
        return;
    }

    const tester = new BridgeClientTester(serverUrl);
    
    try {
        await tester.runAllTests();
    } catch (error) {
        console.error(`\nTest suite failed: ${error.message}`);
        process.exit(1);
    }
}

main().catch(error => {
    console.error(`Fatal error: ${error.message}`);
    process.exit(1);
});