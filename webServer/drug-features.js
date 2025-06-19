// drug-features.js
const OPENFDA_API_KEY = process.env.OPENFDA_API_KEY;
const DRUG_LABEL_ENDPOINT = "https://api.fda.gov/drug/label.json";
const FAERS_ENDPOINT = "https://api.fda.gov/drug/event.json";
const RXNAV_BASE_URL = "https://rxnav.nlm.nih.gov/REST";

// Rate limiting for FAERS API
let lastFaersRequest = 0;
const FAERS_MIN_INTERVAL = 250; // 4 requests per second to stay under 240/minute

/**
 * Get RxCUI identifier for a drug name using correct RxNorm API
 * @param {string} drugName - The drug name to search for
 * @returns {Promise<string|null>} RxCUI or null if not found
 */
async function getRxcuiForDrug(drugName) {
    try {
        // Use correct endpoint: rxcui.json with normalized search
        const url = `${RXNAV_BASE_URL}/rxcui.json`;
        const params = new URLSearchParams({
            name: drugName,
            search: '2' // search=2 is normalized search
        });
        
        const response = await fetch(`${url}?${params}`, { timeout: 10000 });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.idGroup && data.idGroup.rxnormId && data.idGroup.rxnormId.length > 0) {
            return data.idGroup.rxnormId[0];
        }
        
        return null;
        
    } catch (error) {
        console.error(`rxcui lookup failed for ${drugName}: ${error.message}`);
        return null;
    }
}

/**
 * Get drug interactions using RxClass API
 * @param {string} rxcui - The RxCUI identifier
 * @returns {Promise<Object>} Drug interaction information
 */
async function getDrugInteractionsViaRxclass(rxcui) {
    try {
        // Use RxClass API to find interactions through drug classes
        const url = "https://rxnav.nlm.nih.gov/REST/rxclass/class/byRxcui.json";
        const params = new URLSearchParams({
            rxcui: rxcui,
            relaSource: "MEDRT"
        });
        
        const response = await fetch(`${url}?${params}`, { timeout: 15000 });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        return {
            drug_classes: data.rxclassDrugInfoList?.rxclassDrugInfo || [],
            interaction_note: "Use drug classes to identify potential interactions manually",
            recommendation: "Consult pharmacist for clinical drug interaction checking"
        };
        
    } catch (error) {
        return { error: `RxClass lookup failed: ${error.message}` };
    }
}

/**
 * Enhanced drug interaction checker using optimal RxNorm API methods
 * @param {string} drug1 - First medication name
 * @param {string} drug2 - Second medication name
 * @param {string[]} additionalDrugs - Optional array of additional medications
 * @returns {Promise<Object>} Interaction analysis results
 */
async function checkDrugInteractions(drug1, drug2, additionalDrugs = []) {
    try {
        const allDrugs = [drug1, drug2, ...additionalDrugs];
        const drugInfo = {};
        
        for (const drug of allDrugs) {
            const rxcui = await getRxcuiForDrug(drug);
            if (rxcui) {
                // Use getRelatedByType to get ONLY ingredients (TTY=IN)
                const url = `${RXNAV_BASE_URL}/rxcui/${rxcui}/related.json`;
                const params = new URLSearchParams({
                    tty: "IN" // TTY=IN means ingredients only
                });
                
                try {
                    const response = await fetch(`${url}?${params}`, { timeout: 15000 });
                    
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}`);
                    }
                    
                    const data = await response.json();
                    
                    // Extract ingredient names (much smaller response)
                    const ingredients = [];
                    if (data.relatedGroup?.conceptGroup) {
                        for (const group of data.relatedGroup.conceptGroup) {
                            if (group.tty === "IN" && group.conceptProperties) {
                                for (const concept of group.conceptProperties) {
                                    ingredients.push(concept.name || "Unknown");
                                }
                            }
                        }
                    }
                    
                    drugInfo[drug] = {
                        rxcui: rxcui,
                        ingredients: ingredients
                    };
                    
                } catch (error) {
                    // Fallback: just store the RxCUI if ingredient lookup fails
                    drugInfo[drug] = {
                        rxcui: rxcui, 
                        ingredients: [],
                        note: `Could not retrieve ingredients: ${error.message}`
                    };
                }
            } else {
                return { error: `Could not find RxCUI for drug: ${drug}` };
            }
        }
        
        // Analyze for interactions based on ingredients
        const potentialInteractions = [];
        const warnings = [];
        const drugNames = Object.keys(drugInfo);
        
        for (let i = 0; i < drugNames.length; i++) {
            for (let j = i + 1; j < drugNames.length; j++) {
                const drugA = drugNames[i];
                const drugB = drugNames[j];
                const infoA = drugInfo[drugA];
                const infoB = drugInfo[drugB];
                
                // Check for same ingredients (potential duplication)
                if (infoA.ingredients && infoB.ingredients) {
                    const commonIngredients = infoA.ingredients.filter(ing => 
                        infoB.ingredients.includes(ing)
                    );
                    
                    if (commonIngredients.length > 0) {
                        potentialInteractions.push({
                            drug_a: drugA,
                            drug_b: drugB,
                            interaction_type: "Ingredient duplication",
                            common_ingredients: commonIngredients,
                            severity: "Monitor for additive effects",
                            recommendation: "Consult pharmacist about potential duplication"
                        });
                    }
                }
            }
        }
        
        // Add general warnings for common problematic combinations
        for (const drugName of drugNames) {
            const ingredients = drugInfo[drugName].ingredients || [];
            const hasAnticoagulant = ingredients.some(ingredient => 
                ["warfarin", "aspirin", "clopidogrel"].includes(ingredient.toLowerCase())
            );
            
            if (hasAnticoagulant) {
                warnings.push(`${drugName} contains anticoagulant/antiplatelet agents - monitor for bleeding risk`);
            }
        }
        
        return {
            drugs_analyzed: allDrugs,
            drug_details: drugInfo,
            potential_interactions: potentialInteractions,
            safety_warnings: warnings,
            summary: `Analyzed ${allDrugs.length} drugs, found ${potentialInteractions.length} potential interactions`,
            limitations: "Based on ingredient comparison only. For comprehensive interaction checking, consult pharmacist or clinical decision support system.",
            data_source: "RxNorm API (getRelatedByType method)",
            methodology: "Compares active ingredients to identify potential duplications and common interaction risks"
        };
        
    } catch (error) {
        return { error: `Error checking interactions: ${error.message}` };
    }
}

/**
 * Convert between generic and brand names using existing OpenFDA data
 * @param {string} drugName - Name of the drug to convert
 * @param {string} conversionType - Type of conversion ("generic", "brand", or "both")
 * @returns {Promise<Object>} Name conversion results
 */
async function convertDrugNames(drugName, conversionType = "both") {
    try {
        // Search both generic and brand name fields
        const searchStrategies = [
            ["openfda.generic_name", drugName],
            ["openfda.brand_name", drugName]
        ];
        
        for (const [field, searchTerm] of searchStrategies) {
            const params = new URLSearchParams({
                search: `${field}:"${searchTerm}"`,
                limit: '5'
            });
            
            if (OPENFDA_API_KEY) {
                params.append('api_key', OPENFDA_API_KEY);
            }
            
            try {
                const response = await fetch(`${DRUG_LABEL_ENDPOINT}?${params}`, { 
                    timeout: 15000 
                });
                
                if (response.status === 404) {
                    continue;
                }
                
                if (!response.ok) {
                    continue;
                }
                
                const data = await response.json();
                
                if (data.results && data.results.length > 0) {
                    // Extract names from results
                    const genericNames = new Set();
                    const brandNames = new Set();
                    
                    for (const result of data.results) {
                        const openfda = result.openfda || {};
                        
                        if (openfda.generic_name) {
                            openfda.generic_name.forEach(name => genericNames.add(name));
                        }
                        
                        if (openfda.brand_name) {
                            openfda.brand_name.forEach(name => brandNames.add(name));
                        }
                    }
                    
                    // Format response based on conversion type
                    const result = {
                        original_drug: drugName,
                        conversion_type: conversionType,
                        data_source: "OpenFDA Drug Labels"
                    };
                    
                    if (conversionType === "generic" || conversionType === "both") {
                        result.generic_names = Array.from(genericNames).sort();
                    }
                    
                    if (conversionType === "brand" || conversionType === "both") {
                        result.brand_names = Array.from(brandNames).sort();
                    }
                    
                    return result;
                }
                    
            } catch (error) {
                continue;
            }
        }
        
        return { error: `No name conversion data found for '${drugName}'` };
        
    } catch (error) {
        return { error: `Error converting drug names: ${error.message}` };
    }
}

/**
 * Get FDA adverse event reports for a medication
 * @param {string} drugName - Name of the medication
 * @param {string} timePeriod - Time period for analysis (currently not implemented in API)
 * @param {string} severityFilter - Filter by severity ("all" or "serious")
 * @returns {Promise<Object>} Adverse event analysis results
 */
async function getAdverseEvents(drugName, timePeriod = "1year", severityFilter = "all") {
    try {
        // Rate limiting for FAERS API
        const currentTime = Date.now();
        const timeSinceLast = currentTime - lastFaersRequest;
        if (timeSinceLast < FAERS_MIN_INTERVAL) {
            await new Promise(resolve => setTimeout(resolve, FAERS_MIN_INTERVAL - timeSinceLast));
        }
        
        // Build search parameters
        const searchTerms = [
            `patient.drug.medicinalproduct:"${drugName}"`,
            `patient.drug.drugindication:"${drugName}"`
        ];
        
        // Try different search strategies
        for (const searchTerm of searchTerms) {
            const params = new URLSearchParams({
                search: searchTerm,
                limit: '100'
            });
            
            if (OPENFDA_API_KEY) {
                params.append('api_key', OPENFDA_API_KEY);
            }
            
            try {
                let response = await fetch(`${FAERS_ENDPOINT}?${params}`, { timeout: 15000 });
                lastFaersRequest = Date.now();
                
                if (response.status === 429) {
                    // Rate limited, wait and retry once
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    response = await fetch(`${FAERS_ENDPOINT}?${params}`, { timeout: 15000 });
                    lastFaersRequest = Date.now();
                }
                
                if (response.status === 404) {
                    continue;
                }
                
                if (!response.ok) {
                    if (response.status === 429) {
                        return { error: "Rate limit exceeded. Please try again later." };
                    }
                    continue;
                }
                
                const data = await response.json();
                
                if (data.results && data.results.length > 0) {
                    // Process adverse events
                    const events = [];
                    let seriousEvents = 0;
                    
                    for (const result of data.results) {
                        // Extract key information
                        const event = {
                            report_id: result.safetyreportid || "Unknown",
                            serious: result.serious || "Unknown",
                            outcome: result.patient?.patientdeath || "Unknown",
                            reactions: []
                        };
                        
                        // Extract reactions
                        if (result.patient?.reaction) {
                            for (const reaction of result.patient.reaction) {
                                event.reactions.push({
                                    term: reaction.reactionmeddrapt || "Unknown",
                                    outcome: reaction.reactionoutcome || "Unknown"
                                });
                            }
                        }
                        
                        events.push(event);
                        
                        if (event.serious === "1") {
                            seriousEvents += 1;
                        }
                    }
                    
                    // Filter by severity if requested
                    let filteredEvents = events;
                    if (severityFilter === "serious") {
                        filteredEvents = events.filter(e => e.serious === "1");
                    }
                    
                    return {
                        drug_name: drugName,
                        time_period: timePeriod,
                        total_reports: filteredEvents.length,
                        serious_reports: seriousEvents,
                        adverse_events: filteredEvents.slice(0, 20), // Limit to first 20 for readability
                        data_source: "FDA FAERS Database"
                    };
                }
                    
            } catch (error) {
                if (error.name === 'AbortError') {
                    continue;
                }
                continue;
            }
        }
        
        return { status: `No adverse event reports found for '${drugName}'` };
        
    } catch (error) {
        return { error: `Error retrieving adverse events: ${error.message}` };
    }
}

// Export functions
export {
    getRxcuiForDrug,
    getDrugInteractionsViaRxclass,
    checkDrugInteractions,
    convertDrugNames,
    getAdverseEvents
};

// Test basic functionality if run directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
    console.log("Testing corrected drug features client");
    
    // Test RxCUI lookup
    getRxcuiForDrug("aspirin").then(rxcui => {
        console.log(`rxcui test: aspirin = ${rxcui}`);
    });
    
    // Test name conversion
    convertDrugNames("tylenol").then(result => {
        console.log(`name conversion test: ${result.generic_names?.length || 0} generic names found`);
    });
    
    // Test interaction with working RxNorm data
    checkDrugInteractions("aspirin", "warfarin").then(result => {
        console.log(`interaction test: ${result.potential_interactions?.length || 0} interactions found`);
    });
}