import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';

async function testHostedServer() {
    console.log('Testing Unified Medication MCP Hosted Server...\n');
    console.log(`Server URL: ${SERVER_URL}\n`);

    // Test 1: Health Check
    console.log('TEST 1: Health Check');
    try {
        const response = await fetch(`${SERVER_URL}/health`);
        if (response.ok) {
            const health = await response.json();
            console.log('PASSED: Health check successful');
            console.log('   Status:', health.status);
            console.log('   Server:', health.server);
            console.log('   Version:', health.version);
        } else {
            console.log('FAILED: Health check failed with status:', response.status);
        }
    } catch (error) {
        console.log('ERROR: Health check failed:', error.message);
        console.log('   Make sure the server is running on', SERVER_URL);
        return;
    }

    // Test 2: Server Info
    console.log('\nTEST 2: Server Information');
    try {
        const response = await fetch(`${SERVER_URL}/`);
        if (response.ok) {
            const info = await response.json();
            console.log('PASSED: Server info retrieved');
            console.log('   Service:', info.service);
            console.log('   Tools available:', info.tools_available);
            console.log('   Data sources:', info.data_sources.length);
        } else {
            console.log('FAILED: Server info failed with status:', response.status);
        }
    } catch (error) {
        console.log('ERROR: Server info failed:', error.message);
    }

    // Test 3: MCP Endpoint Availability
    console.log('\nTEST 3: MCP Endpoint Availability');
    try {
        const response = await fetch(`${SERVER_URL}/mcp`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'tools/list'
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            if (result.result && result.result.tools) {
                console.log('PASSED: MCP endpoint is working');
                console.log('   Tools found:', result.result.tools.length);
                
                const toolNames = result.result.tools.map(tool => tool.name);
                console.log('   Available tools:');
                toolNames.forEach(name => console.log(`     - ${name}`));
            } else {
                console.log('FAILED: MCP endpoint returned unexpected format');
            }
        } else {
            console.log('FAILED: MCP endpoint failed with status:', response.status);
        }
    } catch (error) {
        console.log('ERROR: MCP endpoint test failed:', error.message);
    }

    // Test 4: Sample Tool Call
    console.log('\nTEST 4: Sample Tool Call (Drug Label)');
    try {
        const response = await fetch(`${SERVER_URL}/mcp`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
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
            if (result.result && result.result.content) {
                console.log('PASSED: Sample tool call successful');
                const content = JSON.parse(result.result.content[0].text);
                if (content.label_data && !content.label_data.error) {
                    console.log('   Drug found:', content.drug_identifier);
                    console.log('   Data source:', content.data_source);
                } else {
                    console.log('   Tool executed but no data found for aspirin');
                }
            } else {
                console.log('FAILED: Tool call returned unexpected format');
            }
        } else {
            console.log('FAILED: Tool call failed with status:', response.status);
        }
    } catch (error) {
        console.log('ERROR: Sample tool call failed:', error.message);
    }

    // Test 5: Sample Drug Interaction Call
    console.log('\nTEST 5: Sample Drug Interaction Call');
    try {
        const response = await fetch(`${SERVER_URL}/mcp`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 3,
                method: 'tools/call',
                params: {
                    name: 'check_drug_interactions',
                    arguments: {
                        drug1: 'aspirin',
                        drug2: 'warfarin'
                    }
                }
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            if (result.result && result.result.content) {
                console.log('PASSED: Drug interaction check successful');
                const content = JSON.parse(result.result.content[0].text);
                if (content.interaction_analysis && !content.interaction_analysis.error) {
                    console.log('   Analysis type:', content.analysis_type);
                    console.log('   Data source:', content.data_source);
                    const analysis = content.interaction_analysis;
                    console.log('   Drugs analyzed:', analysis.drugs_analyzed?.length || 0);
                    console.log('   Potential interactions:', analysis.potential_interactions?.length || 0);
                } else {
                    console.log('   Tool executed but interaction check had errors');
                }
            } else {
                console.log('FAILED: Interaction check returned unexpected format');
            }
        } else {
            console.log('FAILED: Interaction check failed with status:', response.status);
        }
    } catch (error) {
        console.log('ERROR: Drug interaction test failed:', error.message);
    }

    console.log('\nTesting completed!');
    console.log('\nTo use this server with Claude:');
    console.log('1. Make sure the server is running and accessible');
    console.log('2. Configure Claude to use HTTP MCP server at:', SERVER_URL + '/mcp');
    console.log('3. The server provides 11 different medication-related tools');
    
    console.log('\nFor production deployment:');
    console.log('1. Set proper environment variables');
    console.log('2. Use HTTPS with SSL certificates');
    console.log('3. Configure proper CORS settings');
    console.log('4. Set up monitoring and logging');
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\nTest interrupted by user');
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    console.error('\nUncaught exception:', error.message);
    process.exit(1);
});

// Run the tests
testHostedServer().catch(error => {
    console.error('\nTest suite failed:', error.message);
    process.exit(1);
});