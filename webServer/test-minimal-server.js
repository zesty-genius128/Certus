#!/usr/bin/env node

// Test the minimal server
const RAILWAY_URL = process.env.RAILWAY_URL || 'https://your-app.up.railway.app';

async function testMinimalServer() {
    console.log('🧪 Testing Minimal MCP Server...\n');
    console.log(`Server URL: ${RAILWAY_URL}\n`);

    let allTestsPassed = true;

    // Test 1: Health Check
    console.log('TEST 1: Health Check');
    try {
        const response = await fetch(`${RAILWAY_URL}/health`);
        if (response.ok) {
            const health = await response.json();
            console.log('✅ PASSED: Health check successful');
            console.log(`   Status: ${health.status}`);
            console.log(`   Server: ${health.server}`);
            console.log(`   Uptime: ${health.uptime}s`);
        } else {
            console.log(`❌ FAILED: Health check failed - Status ${response.status}`);
            allTestsPassed = false;
        }
    } catch (error) {
        console.log(`❌ ERROR: Health check failed - ${error.message}`);
        allTestsPassed = false;
    }

    console.log();

    // Test 2: Root endpoint
    console.log('TEST 2: Root Endpoint');
    try {
        const response = await fetch(`${RAILWAY_URL}/`);
        if (response.ok) {
            const info = await response.json();
            console.log('✅ PASSED: Root endpoint working');
            console.log(`   Service: ${info.service}`);
            console.log(`   Status: ${info.status}`);
        } else {
            console.log(`❌ FAILED: Root endpoint failed - Status ${response.status}`);
            allTestsPassed = false;
        }
    } catch (error) {
        console.log(`❌ ERROR: Root endpoint failed - ${error.message}`);
        allTestsPassed = false;
    }

    console.log();

    // Test 3: MCP Initialize
    console.log('TEST 3: MCP Initialize');
    try {
        const response = await fetch(`${RAILWAY_URL}/mcp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'initialize',
                params: {
                    protocolVersion: '2024-11-05',
                    capabilities: {},
                    clientInfo: { name: 'test-client', version: '1.0.0' }
                }
            })
        });

        if (response.ok) {
            const result = await response.json();
            if (result.result && result.result.serverInfo) {
                console.log('✅ PASSED: MCP initialize successful');
                console.log(`   Server: ${result.result.serverInfo.name}`);
                console.log(`   Protocol: ${result.result.protocolVersion}`);
            } else {
                console.log('❌ FAILED: Initialize returned unexpected format');
                console.log('Response:', JSON.stringify(result, null, 2));
                allTestsPassed = false;
            }
        } else {
            const text = await response.text();
            console.log(`❌ FAILED: Initialize failed - Status ${response.status}`);
            console.log('Response:', text);
            allTestsPassed = false;
        }
    } catch (error) {
        console.log(`❌ ERROR: Initialize failed - ${error.message}`);
        allTestsPassed = false;
    }

    console.log();

    // Test 4: Tools List
    console.log('TEST 4: Tools List');
    try {
        const response = await fetch(`${RAILWAY_URL}/mcp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 2,
                method: 'tools/list'
            })
        });

        if (response.ok) {
            const result = await response.json();
            if (result.result && result.result.tools) {
                console.log('✅ PASSED: Tools list successful');
                console.log(`   Tools found: ${result.result.tools.length}`);
                result.result.tools.forEach(tool => {
                    console.log(`   - ${tool.name}: ${tool.description}`);
                });
            } else {
                console.log('❌ FAILED: Tools list returned unexpected format');
                console.log('Response:', JSON.stringify(result, null, 2));
                allTestsPassed = false;
            }
        } else {
            const text = await response.text();
            console.log(`❌ FAILED: Tools list failed - Status ${response.status}`);
            console.log('Response:', text);
            allTestsPassed = false;
        }
    } catch (error) {
        console.log(`❌ ERROR: Tools list failed - ${error.message}`);
        allTestsPassed = false;
    }

    console.log();

    // Test 5: Tool Call
    console.log('TEST 5: Echo Tool Call');
    try {
        const response = await fetch(`${RAILWAY_URL}/mcp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 3,
                method: 'tools/call',
                params: {
                    name: 'echo_test',
                    arguments: {
                        message: 'Hello from Railway!'
                    }
                }
            })
        });

        if (response.ok) {
            const result = await response.json();
            if (result.result && result.result.content) {
                console.log('✅ PASSED: Tool call successful');
                const content = JSON.parse(result.result.content[0].text);
                console.log(`   Echo: ${content.echo}`);
                console.log(`   Server: ${content.server}`);
            } else {
                console.log('❌ FAILED: Tool call returned unexpected format');
                console.log('Response:', JSON.stringify(result, null, 2));
                allTestsPassed = false;
            }
        } else {
            const text = await response.text();
            console.log(`❌ FAILED: Tool call failed - Status ${response.status}`);
            console.log('Response:', text);
            allTestsPassed = false;
        }
    } catch (error) {
        console.log(`❌ ERROR: Tool call failed - ${error.message}`);
        allTestsPassed = false;
    }

    console.log();
    console.log('='.repeat(60));
    
    if (allTestsPassed) {
        console.log('🎉 ALL TESTS PASSED!');
        console.log();
        console.log('Your minimal Railway server is working!');
        console.log();
        console.log('📋 Next Steps:');
        console.log('1. Copy your Railway URL:', RAILWAY_URL);
        console.log('2. Test with Claude Desktop:');
        console.log('   - Settings > Custom Integrations');
        console.log('   - Add Custom Integration with URL:', RAILWAY_URL);
        console.log();
        console.log('🧪 Test with Claude:');
        console.log('   "Use the echo_test tool to say hello"');
        console.log('   "Get server info using the server_info tool"');
        console.log();
        console.log('Once this works, you can add your medication functionality back!');
    } else {
        console.log('❌ SOME TESTS FAILED');
        console.log();
        console.log('Check Railway deployment logs:');
        console.log('railway logs --tail');
    }
    
    console.log('='.repeat(60));
}

// Run tests
testMinimalServer().catch(error => {
    console.error(`\n❌ Test suite failed: ${error.message}`);
    process.exit(1);
});