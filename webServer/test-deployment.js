#!/usr/bin/env node

// Replace this with your actual Railway URL
const RAILWAY_URL = 'https://certus-production-acb5.up.railway.app';

async function testDeployment() {
    console.log('Testing Railway deployment...');
    console.log('Server URL:', RAILWAY_URL);
    console.log();

    // Test 1: Health Check
    console.log('TEST 1: Health Check');
    try {
        const response = await fetch(`${RAILWAY_URL}/health`);
        if (response.ok) {
            const health = await response.json();
            console.log('PASSED: Health check successful');
            console.log('  Status:', health.status);
            console.log('  Server:', health.server);
            console.log('  Tools:', health.tools_available);
        } else {
            console.log('FAILED: Health check failed with status:', response.status);
            return false;
        }
    } catch (error) {
        console.log('ERROR: Health check failed:', error.message);
        return false;
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
            console.log('PASSED: MCP initialize successful');
            console.log('  Server:', result.result.serverInfo.name);
            console.log('  Protocol:', result.result.protocolVersion);
        } else {
            console.log('FAILED: Initialize failed with status:', response.status);
            return false;
        }
    } catch (error) {
        console.log('ERROR: Initialize failed:', error.message);
        return false;
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
            console.log('PASSED: Tools list successful');
            console.log('  Tools found:', result.result.tools.length);
            result.result.tools.forEach(tool => {
                console.log(`    - ${tool.name}: ${tool.description}`);
            });
        } else {
            console.log('FAILED: Tools list failed with status:', response.status);
            return false;
        }
    } catch (error) {
        console.log('ERROR: Tools list failed:', error.message);
        return false;
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
            console.log('PASSED: Tool call successful');
            const content = JSON.parse(result.result.content[0].text);
            console.log('  Drug:', content.drug_identifier);
            console.log('  Source:', content.data_source);
            
            if (content.label_data && !content.label_data.error) {
                console.log('  Label data: Found');
            } else {
                console.log('  Label data: Not found (but call succeeded)');
            }
        } else {
            console.log('FAILED: Tool call failed with status:', response.status);
            return false;
        }
    } catch (error) {
        console.log('ERROR: Tool call failed:', error.message);
        return false;
    }

    console.log();
    console.log('SUCCESS: All tests passed!');
    console.log();
    console.log('Your server is ready for Claude Desktop!');
    return true;
}

testDeployment().catch(error => {
    console.error('Test failed:', error.message);
});