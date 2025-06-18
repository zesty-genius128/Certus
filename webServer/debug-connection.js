#!/usr/bin/env node

/**
 * Debug connection issues between test and server
 */

import http from 'http';

console.log('Debugging server connection...\n');

// Test 1: Check Node.js version
console.log('Node.js version:', process.version);

// Test 2: Test if fetch is available
console.log('fetch available:', typeof fetch !== 'undefined');

// Test 3: Try manual HTTP request
function testHttpRequest() {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: '/health',
            method: 'GET',
            timeout: 5000
        };

        console.log('\n Testing HTTP request to localhost:3000/health...');

        const req = http.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                console.log(' HTTP request successful!');
                console.log('Status:', res.statusCode);
                console.log('Headers:', res.headers);
                console.log('Body:', data);
                resolve(true);
            });
        });

        req.on('error', (error) => {
            console.log(' HTTP request failed:', error.message);
            console.log('Error code:', error.code);
            resolve(false);
        });

        req.on('timeout', () => {
            console.log(' HTTP request timed out');
            req.destroy();
            resolve(false);
        });

        req.end();
    });
}

// Test 4: Try different URLs
async function testDifferentUrls() {
    const urls = [
        'http://localhost:3000/health',
        'http://127.0.0.1:3000/health',
        'http://0.0.0.0:3000/health'
    ];

    for (const url of urls) {
        console.log(`\n Testing ${url}...`);
        
        try {
            // Try with fetch if available
            if (typeof fetch !== 'undefined') {
                const response = await fetch(url, { timeout: 5000 });
                console.log(` ${url} - Status: ${response.status}`);
                const data = await response.text();
                console.log(`   Response: ${data.substring(0, 100)}...`);
            } else {
                console.log('   Skipping fetch test (not available)');
            }
        } catch (error) {
            console.log(` ${url} - Error: ${error.message}`);
        }
    }
}

async function main() {
    // Test basic HTTP request
    await testHttpRequest();
    
    // Test different URLs if fetch is available
    if (typeof fetch !== 'undefined') {
        await testDifferentUrls();
    } else {
        console.log('\n⚠️  fetch() not available in this Node.js version');
        console.log('Consider upgrading to Node.js 18+ or using a polyfill');
    }

    console.log('\n📋 Debug Summary:');
    console.log(`Node.js version: ${process.version}`);
    console.log(`fetch available: ${typeof fetch !== 'undefined'}`);
    console.log('If HTTP request succeeded but fetch failed, upgrade Node.js or add node-fetch');
}

main().catch(console.error);