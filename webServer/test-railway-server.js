#!/usr/bin/env node

import dotenv from 'dotenv';
dotenv.config();

// Test your Railway deployment
const RAILWAY_URL = process.env.RAILWAY_URL || 'https://your-app.up.railway.app';

async function testRailwayServer() {
    console.log('🚂 Testing Railway MCP Server...\n');
    console.log(`Server URL: ${RAILWAY_URL}\n`);

    let allTestsPassed = true;

    // Test 1: Health Check
    console.log('TEST 1: Health Check');
    try {
        const response = await fetch(`${RAILWAY_URL}/health`);
        if (response.ok) {
            const health = await response.json();
            console.log('✅ PASSED: Health check successful');
            console.log(`   Server: ${health.server}`);
            console.log(`   Status: ${health.status}`);
            console.log(`   Tools: ${health.tools_available}`);
        } else {
            console.log(`❌ FAILED: Health check failed - Status ${response.status}`);
            allTestsPassed = false;
        }
    } catch (error) {
        console.log(`❌ ERROR: Health check failed - ${error.message}`);
        console.log('   Make sure your Railway deployment is running');
        allTestsPassed = false;
    }

    console.log();

    // Test 2: MCP Initialize
    console.log('TEST 2: MCP Initialize');
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
                allTestsPassed = false;
            }
        } else {
            console.log(`❌ FAILED: Initialize failed - Status ${response.status}`);
            allTestsPassed = false;
        }
    } catch (error) {
        console.log(`❌ ERROR: Initialize failed - ${error.message}`);
        allTestsPassed = false;
    }

    console.log();

    // Test 3: Tools List
    console.log('TEST 3: Tools List');
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
                result.result.tools.slice(0, 3).forEach(tool => {
                    console.log(`   - ${tool.name}: ${tool.description}`);
                });
                if (result.result.tools.length > 3) {
                    console.log(`   ... and ${result.result.tools.length - 3} more tools`);
                }
            } else {
                console.log('❌ FAILED: Tools list returned unexpected format');
                allTestsPassed = false;
            }
        } else {
            console.log(`❌ FAILED: Tools list failed - Status ${response.status}`);
            allTestsPassed = false;
        }
    } catch (error) {
        console.log(`❌ ERROR: Tools list failed - ${error.message}`);
        allTestsPassed = false;
    }

    console.log();

    // Test 4: Sample Tool Call
    console.log('TEST 4: Sample Tool Call (aspirin drug label)');
    try {
        const response = await fetch(`${RAILWAY_URL}/mcp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 3,
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
            if (result.result && result.result.content) {
                console.log('✅ PASSED: Tool call successful');
                const content = JSON.parse(result.result.content[0].text);
                console.log(`   Drug: ${content.drug_identifier}`);
                console.log(`   Source: ${content.data_source}`);
                
                if (content.label_data && !content.label_data.error) {
                    console.log('   Label data: Found');
                } else {
                    console.log('   Label data: Not found (but call succeeded)');
                }
            } else {
                console.log('❌ FAILED: Tool call returned unexpected format');
                allTestsPassed = false;
            }
        } else {
            console.log(`❌ FAILED: Tool call failed - Status ${response.status}`);
            allTestsPassed = false;
        }
    } catch (error) {
        console.log(`❌ ERROR: Tool call failed - ${error.message}`);
        allTestsPassed = false;
    }

    console.log();

    // Test 5: CORS Check
    console.log('TEST 5: CORS Configuration');
    try {
        const response = await fetch(`${RAILWAY_URL}/mcp`, {
            method: 'OPTIONS',
            headers: {
                'Origin': 'https://claude.ai',
                'Access-Control-Request-Method': 'POST',
                'Access-Control-Request-Headers': 'Content-Type'
            }
        });

        if (response.ok) {
            const corsHeaders = response.headers.get('access-control-allow-origin');
            console.log('✅ PASSED: CORS preflight successful');
            console.log(`   CORS Origin: ${corsHeaders || 'Not set'}`);
        } else {
            console.log('⚠️  WARNING: CORS preflight failed - This might cause issues with Claude');
        }
    } catch (error) {
        console.log(`⚠️  WARNING: CORS test failed - ${error.message}`);
    }

    console.log();
    console.log('='.repeat(60));
    
    if (allTestsPassed) {
        console.log('🎉 ALL TESTS PASSED!');
        console.log();
        console.log('Your Railway server is ready for Claude Desktop!');
        console.log();
        console.log('📋 Next Steps:');
        console.log('1. Copy your Railway URL:', RAILWAY_URL);
        console.log('2. In Claude Desktop, go to Settings > Custom Integrations');
        console.log('3. Add Custom Integration with URL:', RAILWAY_URL);
        console.log('4. Claude Desktop will handle the /mcp endpoint automatically');
        console.log();
        console.log('🧪 Test with Claude:');
        console.log('   "Check if aspirin has any current shortages"');
        console.log('   "What are the interactions between aspirin and warfarin?"');
    } else {
        console.log('❌ SOME TESTS FAILED');
        console.log();
        console.log('Please fix the issues above before using with Claude Desktop.');
        console.log('Check your Railway deployment logs for more details.');
    }
    
    console.log('='.repeat(60));
}

// Run tests
testRailwayServer().catch(error => {
    console.error(`\n❌ Test suite failed: ${error.message}`);
    process.exit(1);
});