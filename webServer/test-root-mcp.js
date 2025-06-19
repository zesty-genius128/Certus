#!/usr/bin/env node

const RAILWAY_URL = 'https://certus-production-acb5.up.railway.app';

async function testRootMCP() {
    console.log('Testing MCP at Root Path...');
    console.log('Server URL:', RAILWAY_URL);
    console.log();

    // Test 1: POST to root (what Claude Desktop is trying)
    console.log('TEST 1: POST to / (Root MCP)');
    try {
        const response = await fetch(`${RAILWAY_URL}/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'tools/list'
            })
        });

        if (response.ok) {
            const result = await response.json();
            console.log('PASSED: Root MCP endpoint working');
            console.log('  Tools available:', result.result.tools.length);
            console.log('  Response format: JSON-RPC 2.0');
        } else {
            console.log('FAILED: Root MCP endpoint failed with status:', response.status);
            const text = await response.text();
            console.log('  Response:', text);
            return false;
        }
    } catch (error) {
        console.log('ERROR: Root MCP endpoint failed:', error.message);
        return false;
    }

    console.log();

    // Test 2: POST initialize to root
    console.log('TEST 2: Initialize at Root');
    try {
        const response = await fetch(`${RAILWAY_URL}/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 2,
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
            console.log('PASSED: Initialize at root working');
            console.log('  Server:', result.result.serverInfo.name);
            console.log('  Protocol:', result.result.protocolVersion);
        } else {
            console.log('FAILED: Initialize at root failed');
            return false;
        }
    } catch (error) {
        console.log('ERROR: Initialize failed:', error.message);
        return false;
    }

    console.log();

    // Test 3: Tool call at root
    console.log('TEST 3: Tool Call at Root');
    try {
        const response = await fetch(`${RAILWAY_URL}/`, {
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
            console.log('PASSED: Tool call at root working');
            const content = JSON.parse(result.result.content[0].text);
            console.log('  Drug:', content.drug_identifier);
            console.log('  Source:', content.data_source);
        } else {
            console.log('FAILED: Tool call at root failed');
            return false;
        }
    } catch (error) {
        console.log('ERROR: Tool call failed:', error.message);
        return false;
    }

    console.log();

    // Test 4: Verify /mcp still works too
    console.log('TEST 4: /mcp Still Works');
    try {
        const response = await fetch(`${RAILWAY_URL}/mcp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 4,
                method: 'tools/list'
            })
        });

        if (response.ok) {
            const result = await response.json();
            console.log('PASSED: /mcp endpoint still working');
            console.log('  Tools available:', result.result.tools.length);
        } else {
            console.log('FAILED: /mcp endpoint broken');
            return false;
        }
    } catch (error) {
        console.log('ERROR: /mcp endpoint failed:', error.message);
        return false;
    }

    console.log();
    console.log('SUCCESS: Both root (/) and /mcp endpoints working!');
    console.log();
    console.log('Claude Desktop should now connect successfully.');
    console.log('The POST to / that was failing should now work.');
    return true;
}

testRootMCP();