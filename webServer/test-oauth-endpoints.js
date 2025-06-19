#!/usr/bin/env node

const RAILWAY_URL = 'https://certus-production-acb5.up.railway.app';

async function testOAuthEndpoints() {
    console.log('Testing OAuth Discovery Endpoints...');
    console.log('Server URL:', RAILWAY_URL);
    console.log();

    // Test 1: OAuth Discovery
    console.log('TEST 1: OAuth Discovery Endpoint');
    try {
        const response = await fetch(`${RAILWAY_URL}/.well-known/oauth-authorization-server`);
        if (response.ok) {
            const discovery = await response.json();
            console.log('PASSED: OAuth discovery working');
            console.log('  Issuer:', discovery.issuer);
            console.log('  Authorization endpoint:', discovery.authorization_endpoint);
            console.log('  Token endpoint:', discovery.token_endpoint);
            console.log('  Authless:', discovery.authless);
        } else {
            console.log('FAILED: OAuth discovery failed with status:', response.status);
            return false;
        }
    } catch (error) {
        console.log('ERROR: OAuth discovery failed:', error.message);
        return false;
    }

    console.log();

    // Test 2: Client Registration
    console.log('TEST 2: Client Registration');
    try {
        const response = await fetch(`${RAILWAY_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_name: 'Test Client',
                redirect_uris: ['https://claude.ai/oauth/callback']
            })
        });

        if (response.ok) {
            const registration = await response.json();
            console.log('PASSED: Client registration working');
            console.log('  Client ID:', registration.client_id);
            console.log('  Authless:', registration.authless);
            console.log('  MCP endpoint:', registration.mcp_endpoint);
        } else {
            console.log('FAILED: Client registration failed with status:', response.status);
            return false;
        }
    } catch (error) {
        console.log('ERROR: Client registration failed:', error.message);
        return false;
    }

    console.log();

    // Test 3: Root endpoint with OAuth info
    console.log('TEST 3: Root Endpoint OAuth Info');
    try {
        const response = await fetch(`${RAILWAY_URL}/`);
        if (response.ok) {
            const info = await response.json();
            console.log('PASSED: Root endpoint with OAuth info');
            console.log('  Service:', info.service);
            console.log('  Tools:', info.tools_available);
            console.log('  Authentication:', info.authentication);
            console.log('  OAuth endpoints available:', Object.keys(info.endpoints).filter(e => e.includes('oauth')).length);
        } else {
            console.log('FAILED: Root endpoint failed');
            return false;
        }
    } catch (error) {
        console.log('ERROR: Root endpoint failed:', error.message);
        return false;
    }

    console.log();

    // Test 4: MCP endpoint still working
    console.log('TEST 4: MCP Endpoint Still Working');
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
            console.log('PASSED: MCP endpoint still working');
            console.log('  Tools available:', result.result.tools.length);
        } else {
            console.log('FAILED: MCP endpoint broken');
            return false;
        }
    } catch (error) {
        console.log('ERROR: MCP endpoint failed:', error.message);
        return false;
    }

    console.log();
    console.log('SUCCESS: All OAuth endpoints working!');
    console.log();
    console.log('Claude Desktop should now be able to connect via OAuth.');
    console.log('Try the Custom Integration setup again.');
    return true;
}

testOAuthEndpoints();