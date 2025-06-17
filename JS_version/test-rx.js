import dotenv from 'dotenv';
import {
    getRxcuiForDrug,
    checkDrugInteractions,
    convertDrugNames,
    getAdverseEvents
} from './drug-features.js';

// Load environment variables from .env file
dotenv.config();

async function runDrugFeaturesTests() {
    console.log('Starting Drug Features Tests...\n');

    // Test 1: RxCUI Lookup
    console.log('TEST 1: Getting RxCUI for "aspirin"');
    try {
        const rxcui = await getRxcuiForDrug('aspirin');
        if (rxcui) {
            console.log('PASSED: RxCUI lookup successful - found RxCUI:', rxcui);
        } else {
            console.log('FAILED: Could not find RxCUI for aspirin');
        }
    } catch (error) {
        console.log('ERROR: RxCUI lookup error:', error.message);
    }

    // Test 2: Drug Interactions
    console.log('\nTEST 2: Checking interactions between "aspirin" and "warfarin"');
    try {
        const interactionResult = await checkDrugInteractions('aspirin', 'warfarin');
        if (interactionResult.error) {
            console.log('FAILED: Interaction check failed:', interactionResult.error);
        } else {
            console.log('PASSED: Interaction check completed');
            console.log('   Drugs analyzed:', interactionResult.drugs_analyzed?.length || 0);
            console.log('   Potential interactions found:', interactionResult.potential_interactions?.length || 0);
            console.log('   Safety warnings:', interactionResult.safety_warnings?.length || 0);
        }
    } catch (error) {
        console.log('ERROR: Interaction check error:', error.message);
    }

    // Test 3: Drug Name Conversion
    console.log('\nTEST 3: Converting "tylenol" to generic/brand names');
    try {
        const conversionResult = await convertDrugNames('tylenol');
        if (conversionResult.error) {
            console.log('FAILED: Name conversion failed:', conversionResult.error);
        } else {
            console.log('PASSED: Name conversion successful');
            console.log('   Generic names found:', conversionResult.generic_names?.length || 0);
            console.log('   Brand names found:', conversionResult.brand_names?.length || 0);
            if (conversionResult.generic_names?.length > 0) {
                console.log('   First generic name:', conversionResult.generic_names[0]);
            }
        }
    } catch (error) {
        console.log('ERROR: Name conversion error:', error.message);
    }

    // Test 4: Adverse Events (with rate limiting consideration)
    console.log('\nTEST 4: Getting adverse events for "ibuprofen"');
    try {
        const adverseEventsResult = await getAdverseEvents('ibuprofen', '1year', 'all');
        if (adverseEventsResult.error) {
            console.log('FAILED: Adverse events lookup failed:', adverseEventsResult.error);
        } else if (adverseEventsResult.status) {
            console.log('PASSED: Adverse events lookup completed - no events found');
        } else {
            console.log('PASSED: Adverse events lookup successful');
            console.log('   Total reports:', adverseEventsResult.total_reports || 0);
            console.log('   Serious reports:', adverseEventsResult.serious_reports || 0);
            console.log('   Events returned:', adverseEventsResult.adverse_events?.length || 0);
        }
    } catch (error) {
        console.log('ERROR: Adverse events error:', error.message);
    }

    // Test 5: Complex Drug Interaction (3 drugs)
    console.log('\nTEST 5: Checking complex interaction (aspirin + warfarin + ibuprofen)');
    try {
        const complexInteractionResult = await checkDrugInteractions('aspirin', 'warfarin', ['ibuprofen']);
        if (complexInteractionResult.error) {
            console.log('FAILED: Complex interaction check failed:', complexInteractionResult.error);
        } else {
            console.log('PASSED: Complex interaction check completed');
            console.log('   Drugs analyzed:', complexInteractionResult.drugs_analyzed?.length || 0);
            console.log('   Potential interactions:', complexInteractionResult.potential_interactions?.length || 0);
            console.log('   Safety warnings:', complexInteractionResult.safety_warnings?.length || 0);
            
            if (complexInteractionResult.safety_warnings?.length > 0) {
                console.log('   Warning example:', complexInteractionResult.safety_warnings[0]);
            }
        }
    } catch (error) {
        console.log('ERROR: Complex interaction error:', error.message);
    }

    console.log('\nDrug Features tests completed!');
    console.log('\nTo test the MCP server:');
    console.log('1. Run: node drug-server.js');
    console.log('2. You should see: "Drug Features Service MCP server running on stdio"');
    console.log('3. Press Ctrl+C to stop the server');
    console.log('4. Add the server to your Claude Desktop config');
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
runDrugFeaturesTests().catch(error => {
    console.error('\nTest suite failed:', error.message);
    process.exit(1);
});