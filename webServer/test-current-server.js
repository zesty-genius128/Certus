#!/usr/bin/env node

// Test what's actually deployed
const RAILWAY_URL = 'https://certus-production-acb5.up.railway.app';

async function testCurrentServer() {
    console.log('Testing current deployed server...');
    console.log('Server URL:', RAILWAY_URL);
    console.log();

    // Test 1: Check what tools are actually available
    console.log('TEST: What tools are available?');
    try {
        const response = await fetch(`${RAILWAY_URL}/mcp`, {
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
            console.log('Available tools:');
            result.result.tools.forEach(tool => {
                console.log(`  - ${tool.name}: ${tool.description}`);
            });
            
            // Check if this is the medication server or minimal server
            const hasMedicationTools = result.result.tools.some(tool => 
                tool.name === 'get_medication_profile' || 
                tool.name === 'get_drug_label_only'
            );
            
            if (hasMedicationTools) {
                console.log();
                console.log('SUCCESS: You have the medication server deployed!');
                return true;
            } else {
                console.log();
                console.log('ISSUE: You have a basic/minimal server, not the medication server.');
                console.log('You need to deploy the medication server with drug tools.');
                return false;
            }
        } else {
            console.log('FAILED: Could not get tools list');
            return false;
        }
    } catch (error) {
        console.log('ERROR:', error.message);
        return false;
    }
}

async function testAvailableTools() {
    console.log();
    console.log('Testing available tools...');
    
    // Test echo_test if it exists
    try {
        const response = await fetch(`${RAILWAY_URL}/mcp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 2,
                method: 'tools/call',
                params: {
                    name: 'echo_test',
                    arguments: {
                        message: 'Hello from test!'
                    }
                }
            })
        });

        if (response.ok) {
            const result = await response.json();
            console.log('echo_test result:');
            console.log(result.result.content[0].text);
        } else {
            console.log('echo_test failed');
        }
    } catch (error) {
        console.log('echo_test error:', error.message);
    }

    // Test server_info
    try {
        const response = await fetch(`${RAILWAY_URL}/mcp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 3,
                method: 'tools/call',
                params: {
                    name: 'server_info',
                    arguments: {}
                }
            })
        });

        if (response.ok) {
            const result = await response.json();
            console.log();
            console.log('server_info result:');
            console.log(result.result.content[0].text);
        }
    } catch (error) {
        console.log('server_info error:', error.message);
    }
}

testCurrentServer().then(async (hasMedicationTools) => {
    if (!hasMedicationTools) {
        console.log();
        console.log('NEXT STEPS:');
        console.log('1. Upload the correct simple-mcp-server.js file to Railway');
        console.log('2. The file should have medication tools like:');
        console.log('   - get_medication_profile');
        console.log('   - search_drug_shortages');
        console.log('   - get_drug_label_only');
        console.log('   - check_drug_interactions');
        console.log('3. Redeploy on Railway');
        console.log('4. Test again');
    }
    
    await testAvailableTools();
});