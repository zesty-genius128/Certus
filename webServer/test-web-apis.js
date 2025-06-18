#!/usr/bin/env node

// test-web-apis.js - Test script for the web API servers
import fetch from 'node-fetch';

const ENHANCED_API_URL = 'http://localhost:3000';
const DRUG_FEATURES_API_URL = 'http://localhost:3001';

// Helper function to make API calls
async function apiCall(url, method = 'GET', body = null) {
    try {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
            }
        };
        
        if (body) {
            options.body = JSON.stringify(body);
        }
        
        const response = await fetch(url, options);
        const data = await response.json();
        
        return {
            status: response.status,
            data: data
        };
    } catch (error) {
        return {
            status: 'ERROR',
            error: error.message
        };
    }
}

async function testEnhancedAPI() {
    console.log('='.repeat(50));
    console.log('Testing Enhanced Medication API (Port 3000)');
    console.log('='.repeat(50));

    // Test health check
    console.log('\n1. Testing health check...');
    const health = await apiCall(`${ENHANCED_API_URL}/health`);
    console.log('Status:', health.status);
    console.log('Response:', health.data?.status || health.error);

    // Test medication profile
    console.log('\n2. Testing medication profile for aspirin...');
    const profile = await apiCall(`${ENHANCED_API_URL}/medication/profile`, 'POST', {
        drug_identifier: 'aspirin'
    });
    console.log('Status:', profile.status);
    if (profile.data && !profile.data.error) {
        console.log('SUCCESS: Got medication profile');
        console.log('Generic names:', profile.data.label_information?.generic_name || 'None');
        console.log('Brand names:', profile.data.label_information?.brand_name || 'None');
    } else {
        console.log('ERROR:', profile.data?.error || profile.error);
    }

    // Test shortage search
    console.log('\n3. Testing shortage search for lidocaine...');
    const shortage = await apiCall(`${ENHANCED_API_URL}/medication/shortages`, 'POST', {
        search_term: 'lidocaine'
    });
    console.log('Status:', shortage.status);
    if (shortage.data && shortage.data.shortage_data?.shortages) {
        console.log('SUCCESS: Found', shortage.data.shortage_data.shortages.length, 'shortage records');
    } else {
        console.log('Result:', shortage.data?.shortage_data?.status || shortage.error);
    }

    // Test recalls
    console.log('\n4. Testing recall search for ibuprofen...');
    const recalls = await apiCall(`${ENHANCED_API_URL}/medication/recalls`, 'POST', {
        search_term: 'ibuprofen'
    });
    console.log('Status:', recalls.status);
    if (recalls.data && recalls.data.recall_data?.recalls) {
        console.log('SUCCESS: Found', recalls.data.recall_data.recalls.length, 'recall records');
    } else {
        console.log('Result:', recalls.data?.recall_data?.status || recalls.error);
    }
}

async function testDrugFeaturesAPI() {
    console.log('\n' + '='.repeat(50));
    console.log('Testing Drug Features API (Port 3001)');
    console.log('='.repeat(50));

    // Test health check
    console.log('\n1. Testing health check...');
    const health = await apiCall(`${DRUG_FEATURES_API_URL}/health`);
    console.log('Status:', health.status);
    console.log('Response:', health.data?.status || health.error);

    // Test drug interactions
    console.log('\n2. Testing drug interactions (aspirin + warfarin)...');
    const interactions = await apiCall(`${DRUG_FEATURES_API_URL}/drug/interactions`, 'POST', {
        drug1: 'aspirin',
        drug2: 'warfarin'
    });
    console.log('Status:', interactions.status);
    if (interactions.data && interactions.data.interaction_analysis) {
        const analysis = interactions.data.interaction_analysis;
        console.log('SUCCESS: Analyzed', analysis.drugs_analyzed?.length || 0, 'drugs');
        console.log('Potential interactions:', analysis.potential_interactions?.length || 0);
        console.log('Safety warnings:', analysis.safety_warnings?.length || 0);
        if (analysis.safety_warnings?.length > 0) {
            console.log('Warning:', analysis.safety_warnings[0]);
        }
    } else {
        console.log('ERROR:', interactions.data?.error || interactions.error);
    }

    // Test name conversion
    console.log('\n3. Testing name conversion (tylenol)...');
    const conversion = await apiCall(`${DRUG_FEATURES_API_URL}/drug/convert-names`, 'POST', {
        drug_name: 'tylenol',
        conversion_type: 'both'
    });
    console.log('Status:', conversion.status);
    if (conversion.data && conversion.data.name_conversion) {
        const conv = conversion.data.name_conversion;
        console.log('SUCCESS: Name conversion completed');
        console.log('Generic names:', conv.generic_names?.length || 0);
        console.log('Brand names:', conv.brand_names?.length || 0);
        if (conv.generic_names?.length > 0) {
            console.log('First generic:', conv.generic_names[0]);
        }
    } else {
        console.log('ERROR:', conversion.data?.error || conversion.error);
    }

    // Test adverse events
    console.log('\n4. Testing adverse events (ibuprofen)...');
    const adverse = await apiCall(`${DRUG_FEATURES_API_URL}/drug/adverse-events`, 'POST', {
        drug_name: 'ibuprofen',
        severity_filter: 'all'
    });
    console.log('Status:', adverse.status);
    if (adverse.data && adverse.data.adverse_event_analysis) {
        const analysis = adverse.data.adverse_event_analysis;
        if (analysis.total_reports) {
            console.log('SUCCESS: Found', analysis.total_reports, 'adverse event reports');
            console.log('Serious reports:', analysis.serious_reports || 0);
        } else {
            console.log('Result:', analysis.status || 'No reports found');
        }
    } else {
        console.log('ERROR:', adverse.data?.error || adverse.error);
    }

    // Test combined safety analysis
    console.log('\n5. Testing combined safety analysis...');
    const safety = await apiCall(`${DRUG_FEATURES_API_URL}/drug/safety-analysis`, 'POST', {
        drugs: ['aspirin', 'warfarin', 'ibuprofen'],
        include_interactions: true,
        include_adverse_events: false
    });
    console.log('Status:', safety.status);
    if (safety.data && safety.data.interactions) {
        console.log('SUCCESS: Combined safety analysis completed');
        console.log('Drugs analyzed:', safety.data.drugs_analyzed?.length || 0);
        console.log('Safety warnings:', safety.data.interactions.safety_warnings?.length || 0);
    } else {
        console.log('Result:', safety.data?.error || safety.error);
    }
}

async function runAllTests() {
    console.log('Starting Web API Tests...');
    console.log('Make sure both servers are running:');
    console.log('- Enhanced API: npm run start-web');
    console.log('- Drug Features API: npm run start-drug-web');
    console.log('Or run both: npm run start-all-web\n');

    try {
        await testEnhancedAPI();
        await testDrugFeaturesAPI();
        
        console.log('\n' + '='.repeat(50));
        console.log('All tests completed!');
        console.log('='.repeat(50));
        
        console.log('\nNext steps:');
        console.log('1. Both APIs are ready for hosting');
        console.log('2. You can deploy to Heroku, Vercel, Railway, etc.');
        console.log('3. Use environment variables for production');
        console.log('4. Add authentication if needed');
        console.log('5. Consider rate limiting for production use');
        
    } catch (error) {
        console.error('\nTest suite failed:', error.message);
        console.log('\nMake sure both servers are running before testing!');
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\nTests interrupted');
    process.exit(0);
});

// Run the tests
runAllTests();