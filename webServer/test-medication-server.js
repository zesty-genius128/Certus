#!/usr/bin/env node

const RAILWAY_URL = 'https://certus-production-acb5.up.railway.app';

async function testMedicationServer() {
    console.log('Testing Medication Server...');
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
            
            // Check if this is the medication server
            if (health.server !== 'Unified Medication MCP Server') {
                console.log('WARNING: This does not appear to be the medication server!');
                return false;
            }
        } else {
            console.log('FAILED: Health check failed');
            return false;
        }
    } catch (error) {
        console.log('ERROR: Health check failed:', error.message);
        return false;
    }

    console.log();

    // Test 2: Tools List
    console.log('TEST 2: Medication Tools List');
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
            console.log('PASSED: Tools list successful');
            console.log('  Tools found:', result.result.tools.length);
            
            const expectedTools = ['get_medication_profile', 'search_drug_shortages', 'get_drug_label_only', 'check_drug_interactions'];
            const actualTools = result.result.tools.map(t => t.name);
            
            console.log('  Available tools:');
            result.result.tools.forEach(tool => {
                console.log(`    - ${tool.name}: ${tool.description}`);
            });
            
            const hasMedicationTools = expectedTools.some(tool => actualTools.includes(tool));
            if (!hasMedicationTools) {
                console.log('ERROR: Missing medication tools! You have the wrong server deployed.');
                return false;
            }
            
        } else {
            console.log('FAILED: Tools list failed');
            return false;
        }
    } catch (error) {
        console.log('ERROR: Tools list failed:', error.message);
        return false;
    }

    console.log();

    // Test 3: Medication Tool Call
    console.log('TEST 3: Medication Tool Call (aspirin drug label)');
    try {
        const response = await fetch(`${RAILWAY_URL}/mcp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 2,
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
            console.log('PASSED: Medication tool call successful');
            
            try {
                const content = JSON.parse(result.result.content[0].text);
                console.log('  Drug:', content.drug_identifier);
                console.log('  Source:', content.data_source);
                
                if (content.label_data && !content.label_data.error) {
                    console.log('  Label data: Found');
                } else {
                    console.log('  Label data: Not found (but call succeeded)');
                }
            } catch (parseError) {
                console.log('  Raw response:', result.result.content[0].text);
            }
        } else {
            console.log('FAILED: Medication tool call failed');
            return false;
        }
    } catch (error) {
        console.log('ERROR: Medication tool call failed:', error.message);
        return false;
    }

    console.log();
    console.log('SUCCESS: Medication server is working correctly!');
    console.log();
    console.log('Ready for Claude Desktop integration!');
    return true;
}

testMedicationServer();