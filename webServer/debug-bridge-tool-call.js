#!/usr/bin/env node

/**
 * Debug tool calls through the bridge client
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testToolCallDirectly() {
    console.log('🔍 Testing tool call directly to server...');
    
    try {
        const response = await fetch('http://localhost:3000/mcp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'tools/call',
                params: {
                    name: 'get_drug_label_only',
                    arguments: {
                        drug_identifier: 'aspirin'
                    }
                }
            })
        });

        if (response.ok) {
            const result = await response.json();
            console.log('✅ Direct tool call successful');
            console.log('Response time: ~' + (Date.now() % 10000) + 'ms');
            
            if (result.result && result.result.content) {
                console.log('✅ Tool returned content');
                const content = JSON.parse(result.result.content[0].text);
                console.log('✅ Content parsed successfully');
                console.log('Drug:', content.drug_identifier);
            } else {
                console.log('❌ Unexpected response format');
                console.log('Response:', JSON.stringify(result, null, 2));
            }
            
            return true;
        } else {
            console.log('❌ Direct tool call failed:', response.status);
            return false;
        }
    } catch (error) {
        console.log('❌ Direct tool call error:', error.message);
        return false;
    }
}

async function testBridgeClientWithDetailedLogging() {
    console.log('\n🔍 Testing bridge client with detailed logging...');
    
    return new Promise((resolve) => {
        let success = false;
        let messages = [];
        
        const bridge = spawn('node', [path.join(__dirname, 'mcp-bridge-client.js')], {
            env: {
                ...process.env,
                MCP_SERVER_URL: 'http://localhost:3000/mcp',
                MCP_BRIDGE_TYPE: 'simple'
            }
        });

        const timeout = setTimeout(() => {
            if (!success) {
                console.log('❌ Bridge test timed out after 30 seconds');
                bridge.kill();
                resolve(false);
            }
        }, 30000);

        // Log all stderr output
        bridge.stderr.on('data', (data) => {
            const message = data.toString();
            console.log('Bridge log:', message.trim());
            
            if (message.includes('Server connectivity confirmed')) {
                console.log('✅ Bridge connected, sending tool call...');
                
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
                
                console.log('Sending:', JSON.stringify(toolCallMessage));
                bridge.stdin.write(JSON.stringify(toolCallMessage) + '\n');
            }
        });

        // Log all stdout output
        bridge.stdout.on('data', (data) => {
            const message = data.toString().trim();
            console.log('Bridge response:', message);
            messages.push(message);
            
            try {
                const response = JSON.parse(message);
                
                if (response.id === 2) { // Our tool call response
                    if (response.result && response.result.content) {
                        console.log('✅ Tool call through bridge successful!');
                        success = true;
                    } else if (response.error) {
                        console.log('❌ Tool call returned error:', response.error.message);
                    } else {
                        console.log('❌ Tool call returned unexpected format');
                        console.log('Response:', JSON.stringify(response, null, 2));
                    }
                    
                    clearTimeout(timeout);
                    bridge.kill();
                    resolve(success);
                }
            } catch (error) {
                console.log('JSON parse error (might be partial):', error.message);
            }
        });

        bridge.on('error', (error) => {
            console.log('❌ Bridge spawn error:', error.message);
            clearTimeout(timeout);
            resolve(false);
        });

        bridge.on('exit', (code, signal) => {
            console.log(`Bridge exited with code ${code}, signal ${signal}`);
            clearTimeout(timeout);
            if (!success) {
                console.log('All messages received:');
                messages.forEach((msg, i) => console.log(`${i + 1}:`, msg));
                resolve(false);
            }
        });
    });
}

async function main() {
    console.log('🐛 Bridge Tool Call Debug\n');

    // Test 1: Direct server tool call
    const directSuccess = await testToolCallDirectly();
    
    if (!directSuccess) {
        console.log('\n❌ Direct tool call failed - server issue');
        return;
    }

    // Test 2: Bridge client with detailed logging
    const bridgeSuccess = await testBridgeClientWithDetailedLogging();
    
    console.log('\n' + '='.repeat(50));
    if (bridgeSuccess) {
        console.log('🎉 Bridge tool call working!');
        console.log('Bridge client is ready for Claude Desktop');
    } else {
        console.log('❌ Bridge tool call failed');
        console.log('Check the logs above for details');
    }
    console.log('='.repeat(50));
}

main().catch(console.error);