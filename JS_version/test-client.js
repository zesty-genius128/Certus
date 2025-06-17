#!/usr/bin/env node

// test-client.js - Simple test script to verify the OpenFDA client functions
import dotenv from 'dotenv';
import { 
    fetchDrugLabelInfo,
    fetchDrugShortageInfo,
    searchDrugRecalls,
    analyzeDrugMarketTrends,
    batchDrugAnalysis
} from './openfda-client.js';

// Load environment variables from .env file
dotenv.config();

async function runTests() {
    console.log('Starting OpenFDA Client Tests...\n');

    // Test 1: Drug Label Info
    console.log('TEST 1: Fetching drug label info for "aspirin"');
    try {
        const labelResult = await fetchDrugLabelInfo('aspirin');
        if (labelResult.error) {
            console.log('FAILED: Label test failed:', labelResult.error);
        } else {
            const genericNames = labelResult.openfda?.generic_name || [];
            console.log('PASSED: Label test passed - found', genericNames.length, 'generic names');
        }
    } catch (error) {
        console.log('ERROR: Label test error:', error.message);
    }

    // Test 2: Drug Shortage Info
    console.log('\nTEST 2: Checking shortages for "metformin"');
    try {
        const shortageResult = await fetchDrugShortageInfo('metformin');
        if (shortageResult.shortages) {
            console.log('PASSED: Shortage test passed - found', shortageResult.shortages.length, 'shortage records');
        } else {
            console.log('PASSED: Shortage test passed - no shortages found (good news!)');
        }
    } catch (error) {
        console.log('ERROR: Shortage test error:', error.message);
    }

    // Test 3: Drug Recalls
    console.log('\nTEST 3: Checking recalls for "ibuprofen"');
    try {
        const recallResult = await searchDrugRecalls('ibuprofen');
        if (recallResult.recalls) {
            console.log('PASSED: Recall test passed - found', recallResult.recalls.length, 'recall records');
        } else {
            console.log('PASSED: Recall test passed - no recalls found');
        }
    } catch (error) {
        console.log('ERROR: Recall test error:', error.message);
    }

    // Test 4: Market Trends Analysis
    console.log('\nTEST 4: Analyzing market trends for "insulin"');
    try {
        const trendResult = await analyzeDrugMarketTrends('insulin', 6);
        console.log('PASSED: Trend analysis test passed');
        console.log('   Risk level:', trendResult.market_insights?.risk_level || 'Unknown');
        console.log('   Total events:', trendResult.total_shortage_events || 0);
    } catch (error) {
        console.log('ERROR: Trend analysis test error:', error.message);
    }

    // Test 5: Batch Analysis (small batch)
    console.log('\nTEST 5: Running batch analysis for 3 drugs');
    try {
        const batchResult = await batchDrugAnalysis(['aspirin', 'tylenol', 'advil'], false);
        console.log('PASSED: Batch analysis test passed');
        console.log('   Drugs analyzed:', batchResult.batch_summary?.total_drugs_analyzed || 0);
        console.log('   High risk drugs:', batchResult.batch_summary?.high_risk_drugs || 0);
        console.log('   Drugs with shortages:', batchResult.batch_summary?.drugs_with_shortages || 0);
    } catch (error) {
        console.log('ERROR: Batch analysis test error:', error.message);
    }

    console.log('\nTests completed! If you see mostly PASSED marks, the conversion was successful.');
    console.log('\nTo use with Claude Desktop:');
    console.log('1. Update your claude_desktop_config.json with the new JavaScript server');
    console.log('2. Make sure you have your OPENFDA_API_KEY environment variable set');
    console.log('3. Run: npm install');
    console.log('4. Test the server: node enhanced-mcp-server.js');
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
runTests().catch(error => {
    console.error('\nTest suite failed:', error.message);
    process.exit(1);
});