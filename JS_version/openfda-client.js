const OPENFDA_API_KEY = process.env.OPENFDA_API_KEY;
const DRUG_LABEL_ENDPOINT = "https://api.fda.gov/drug/label.json";
const DRUG_SHORTAGES_ENDPOINT = "https://api.fda.gov/drug/shortages.json";

/**
 * Retrieve drug label information from openFDA
 * @param {string} drugIdentifier - The drug identifier to search for
 * @param {string} identifierType - The type of identifier (default: "openfda.generic_name")
 * @returns {Promise<Object>} Drug label information
 */
async function fetchDrugLabelInfo(drugIdentifier, identifierType = "openfda.generic_name") {
    const params = new URLSearchParams({
        search: `${identifierType}:"${drugIdentifier}"`,
        limit: '1'
    });
    
    if (OPENFDA_API_KEY) {
        params.append('api_key', OPENFDA_API_KEY);
    }

    try {
        const response = await fetch(`${DRUG_LABEL_ENDPOINT}?${params}`, {
            timeout: 15000
        });

        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
            return data.results[0];
        } else {
            return { error: `No label information found for '${drugIdentifier}'` };
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            return { error: "Request timed out" };
        } else if (error.message.includes('HTTP error')) {
            return { error: error.message };
        } else {
            return { error: `Request failed: ${error.message}` };
        }
    }
}

/**
 * Search for drug shortage information
 * @param {string} drugIdentifier - The drug identifier to search for
 * @returns {Promise<Object>} Drug shortage information
 */
async function fetchDrugShortageInfo(drugIdentifier) {
    let cleanName = drugIdentifier.toLowerCase().trim();
    
    // Clean the name
    if (cleanName.includes(" and ")) {
        cleanName = cleanName.split(" and ")[0].trim();
    }
    
    // Remove common suffixes
    const suffixes = [" tablets", " capsules", " injection", " oral", " solution"];
    for (const suffix of suffixes) {
        if (cleanName.endsWith(suffix)) {
            cleanName = cleanName.replace(suffix, "").trim();
            break;
        }
    }
    
    // Try different search strategies
    const searchTerms = [
        `"${cleanName}"`,
        `generic_name:"${cleanName}"`,
        `proprietary_name:"${cleanName}"`,
        `openfda.generic_name:"${cleanName}"`,
        `openfda.brand_name:"${cleanName}"`
    ];
    
    if (cleanName !== drugIdentifier.toLowerCase()) {
        searchTerms.push(`"${drugIdentifier}"`);
        searchTerms.push(`generic_name:"${drugIdentifier}"`);
    }
    
    for (const searchTerm of searchTerms) {
        const params = new URLSearchParams({
            search: searchTerm,
            limit: '20'
        });
        
        if (OPENFDA_API_KEY) {
            params.append('api_key', OPENFDA_API_KEY);
        }

        try {
            const response = await fetch(`${DRUG_SHORTAGES_ENDPOINT}?${params}`, {
                timeout: 15000
            });
            
            if (response.status === 404) {
                continue;
            } else if (!response.ok) {
                continue;
            }
                
            const data = await response.json();
            
            if (data.results && data.results.length > 0) {
                const shortages = [];
                
                for (const item of data.results) {
                    const genericName = (item.generic_name || "").toLowerCase();
                    const proprietaryName = (item.proprietary_name || "").toLowerCase();
                    
                    const openfdaData = item.openfda || {};
                    const openfdaGeneric = (openfdaData.generic_name || []).map(name => name.toLowerCase());
                    const openfdaBrand = (openfdaData.brand_name || []).map(name => name.toLowerCase());
                    
                    const searchClean = searchTerm
                        .replace(/generic_name:"/g, '')
                        .replace(/proprietary_name:"/g, '')
                        .replace(/"/g, '')
                        .toLowerCase();
                    
                    // Check if this record matches our search
                    const isMatch = (
                        genericName.includes(searchClean) ||
                        proprietaryName.includes(searchClean) ||
                        openfdaGeneric.some(name => name.includes(searchClean)) ||
                        openfdaBrand.some(name => name.includes(searchClean)) ||
                        openfdaGeneric.some(name => name.length > 3 && searchClean.includes(name))
                    );
                    
                    if (isMatch) {
                        shortages.push({
                            generic_name: item.generic_name || "N/A",
                            proprietary_name: item.proprietary_name || "N/A",
                            status: item.status || "N/A",
                            availability: item.availability || "N/A",
                            shortage_reason: item.shortage_reason || "N/A",
                            company_name: item.company_name || "N/A",
                            dosage_form: item.dosage_form || "N/A",
                            strength: item.strength || [],
                            therapeutic_category: item.therapeutic_category || [],
                            initial_posting_date: item.initial_posting_date || "N/A",
                            update_date: item.update_date || "N/A",
                            update_type: item.update_type || "N/A",
                            contact_info: item.contact_info || "N/A",
                            presentation: item.presentation || "N/A",
                            openfda_info: {
                                generic_name: openfdaData.generic_name || [],
                                brand_name: openfdaData.brand_name || [],
                                manufacturer_name: openfdaData.manufacturer_name || []
                            }
                        });
                    }
                }
                
                if (shortages.length > 0) {
                    return { shortages };
                }
            }
        } catch (error) {
            // Continue to next search term
            continue;
        }
    }
    
    return { status: `No current shortages found for '${drugIdentifier}'` };
}

/**
 * Search for drug recalls
 * @param {string} drugIdentifier - The drug identifier to search for
 * @returns {Promise<Object>} Drug recall information
 */
async function searchDrugRecalls(drugIdentifier) {
    const endpoint = "https://api.fda.gov/drug/enforcement.json";
    const params = new URLSearchParams({
        search: `product_description:"${drugIdentifier}"`,
        limit: '10'
    });
    
    if (OPENFDA_API_KEY) {
        params.append('api_key', OPENFDA_API_KEY);
    }

    try {
        const response = await fetch(`${endpoint}?${params}`, {
            timeout: 15000
        });

        if (!response.ok) {
            if (response.status === 404) {
                return { status: `No recalls found for '${drugIdentifier}'` };
            }
            throw new Error(`HTTP error: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
            const recalls = data.results.map(item => ({
                product_description: item.product_description || "N/A",
                reason_for_recall: item.reason_for_recall || "N/A",
                classification: item.classification || "N/A",
                status: item.status || "N/A",
                recall_initiation_date: item.recall_initiation_date || "N/A",
                recalling_firm: item.recalling_firm || "N/A"
            }));
            
            return { recalls };
        } else {
            return { status: `No recalls found for '${drugIdentifier}'` };
        }
    } catch (error) {
        if (error.message.includes('HTTP error: 404')) {
            return { status: `No recalls found for '${drugIdentifier}'` };
        }
        return { error: `Error searching recalls: ${error.message}` };
    }
}

/**
 * Analyze shortage patterns and market trends for a drug
 * @param {string} drugIdentifier - The drug identifier to analyze
 * @param {number} monthsBack - Number of months to look back (default: 12)
 * @returns {Promise<Object>} Trend analysis results
 */
async function analyzeDrugMarketTrends(drugIdentifier, monthsBack = 12) {
    const cleanName = drugIdentifier.toLowerCase().trim();
    
    const params = new URLSearchParams({
        search: `"${cleanName}"`,
        limit: '100'
    });
    
    if (OPENFDA_API_KEY) {
        params.append('api_key', OPENFDA_API_KEY);
    }

    try {
        const response = await fetch(`${DRUG_SHORTAGES_ENDPOINT}?${params}`, {
            timeout: 20000
        });

        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.results || data.results.length === 0) {
            return {
                drug_analyzed: drugIdentifier,
                analysis_period_months: monthsBack,
                trend_summary: "No shortage data found",
                market_insights: {
                    shortage_frequency: "None",
                    risk_level: "Low",
                    recommendation: "No historical shortage patterns detected"
                }
            };
        }
        
        // Filter relevant records
        const relevantRecords = data.results.filter(item => {
            const drugName = (item.generic_name || "").toLowerCase();
            const proprietaryName = (item.proprietary_name || "").toLowerCase();
            const openfdaNames = (item.openfda?.generic_name || []).map(name => name.toLowerCase());
            
            return (
                drugName.includes(cleanName) ||
                proprietaryName.includes(cleanName) ||
                openfdaNames.some(name => name.includes(cleanName))
            );
        });
        
        if (relevantRecords.length === 0) {
            return {
                drug_analyzed: drugIdentifier,
                analysis_period_months: monthsBack,
                trend_summary: "No relevant shortage records found",
                market_insights: {
                    shortage_frequency: "None",
                    risk_level: "Low",
                    recommendation: "No shortage history for this drug"
                }
            };
        }
        
        // Analyze patterns
        const statusCounts = {};
        const companiesAffected = new Set();
        const reasons = [];
        let recentActivity = 0;
        
        for (const record of relevantRecords) {
            const status = record.status || "Unknown";
            statusCounts[status] = (statusCounts[status] || 0) + 1;
            
            const company = record.company_name;
            if (company && company !== "Unknown") {
                companiesAffected.add(company);
            }
            
            const reason = record.shortage_reason;
            if (reason && reason !== "N/A") {
                reasons.push(reason);
            }
            
            if (["Current", "To Be Discontinued"].includes(status)) {
                recentActivity += 1;
            }
        }
        
        // Calculate risk
        const totalRecords = relevantRecords.length;
        const currentShortages = statusCounts["Current"] || 0;
        const resolvedShortages = statusCounts["Resolved"] || 0;
        
        let riskLevel;
        if (currentShortages > 0) {
            riskLevel = "High";
        } else if (totalRecords > 5) {
            riskLevel = "Medium";
        } else {
            riskLevel = "Low";
        }
        
        // Build frequency description
        let frequencyDesc = `${totalRecords} shortage events found`;
        if (totalRecords > 10) {
            frequencyDesc += " (high frequency)";
        } else if (totalRecords > 3) {
            frequencyDesc += " (moderate frequency)";
        } else {
            frequencyDesc += " (low frequency)";
        }
        
        // Top reasons
        let reasonSummary = "Not specified";
        if (reasons.length > 0) {
            const reasonCounts = {};
            reasons.forEach(reason => {
                reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
            });
            
            const topReasons = Object.entries(reasonCounts)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 3)
                .map(([reason]) => reason);
            
            reasonSummary = topReasons.join("; ");
        }
        
        let recommendation = `Risk level: ${riskLevel}.`;
        if (currentShortages > 0) {
            recommendation += ` Monitor ${currentShortages} current shortage(s).`;
        } else {
            recommendation += ` ${resolvedShortages} resolved shortage(s) in history.`;
        }
        
        return {
            drug_analyzed: drugIdentifier,
            analysis_period_months: monthsBack,
            total_shortage_events: totalRecords,
            trend_summary: `Found ${totalRecords} shortage records affecting ${companiesAffected.size} companies`,
            status_breakdown: statusCounts,
            market_insights: {
                shortage_frequency: frequencyDesc,
                risk_level: riskLevel,
                companies_affected: companiesAffected.size,
                recent_activity: recentActivity,
                common_reasons: reasonSummary,
                recommendation: recommendation
            },
            detailed_records: relevantRecords.slice(0, 5)
        };
        
    } catch (error) {
        return {
            drug_analyzed: drugIdentifier,
            error: `Failed to analyze trends: ${error.message}`,
            recommendation: "Unable to perform trend analysis"
        };
    }
}

/**
 * Analyze multiple drugs for shortages and risk assessment
 * @param {string[]} drugList - Array of drug names to analyze
 * @param {boolean} includeTrends - Whether to include trend analysis
 * @returns {Promise<Object>} Batch analysis results
 */
async function batchDrugAnalysis(drugList, includeTrends = false) {
    console.error(`analyzing ${drugList.length} drugs`);
    
    if (drugList.length > 25) {
        return {
            error: "Batch size too large. Limit to 25 drugs per batch.",
            recommendation: "Split list into smaller batches"
        };
    }
    
    const results = {
        batch_summary: {
            total_drugs_analyzed: drugList.length,
            analysis_timestamp: new Date().toISOString().split('T')[0],
            drugs_with_shortages: 0,
            drugs_with_recalls: 0,
            high_risk_drugs: 0,
            total_shortage_events: 0
        },
        individual_analyses: {},
        risk_assessment: {
            high_risk: [],
            medium_risk: [],
            low_risk: []
        },
        formulary_recommendations: []
    };
    
    for (const drug of drugList) {
        const drugAnalysis = {
            drug_name: drug,
            shortage_status: "Unknown",
            recall_status: "Unknown",
            risk_level: "Unknown",
            details: {}
        };
        
        try {
            // Check shortages
            const shortageInfo = await fetchDrugShortageInfo(drug);
            if (shortageInfo.shortages) {
                drugAnalysis.shortage_status = `Found ${shortageInfo.shortages.length} shortage(s)`;
                results.batch_summary.drugs_with_shortages += 1;
                results.batch_summary.total_shortage_events += shortageInfo.shortages.length;
                
                const currentShortages = shortageInfo.shortages.filter(s => s.status === "Current").length;
                if (currentShortages > 0) {
                    drugAnalysis.risk_level = "High";
                    results.risk_assessment.high_risk.push(drug);
                    results.batch_summary.high_risk_drugs += 1;
                } else {
                    drugAnalysis.risk_level = "Medium";
                    results.risk_assessment.medium_risk.push(drug);
                }
                
                const uniqueCompanies = [...new Set(shortageInfo.shortages.slice(0, 5).map(s => s.company_name || "Unknown"))];
                drugAnalysis.details.shortage_summary = {
                    total_records: shortageInfo.shortages.length,
                    current_shortages: currentShortages,
                    companies_affected: uniqueCompanies
                };
            } else {
                drugAnalysis.shortage_status = "No current shortages";
                drugAnalysis.risk_level = "Low";
                results.risk_assessment.low_risk.push(drug);
            }
            
            // Check recalls
            const recallInfo = await searchDrugRecalls(drug);
            if (recallInfo.recalls) {
                drugAnalysis.recall_status = `Found ${recallInfo.recalls.length} recall(s)`;
                results.batch_summary.drugs_with_recalls += 1;
                drugAnalysis.details.recall_summary = {
                    total_recalls: recallInfo.recalls.length,
                    recent_recalls: recallInfo.recalls.slice(0, 2).map(r => 
                        (r.product_description || "Unknown").substring(0, 50) + "..."
                    )
                };
            } else {
                drugAnalysis.recall_status = "No recent recalls";
            }
            
            // Add trend analysis if requested
            if (includeTrends) {
                const trendInfo = await analyzeDrugMarketTrends(drug, 6);
                drugAnalysis.details.trend_analysis = {
                    total_shortage_events: trendInfo.total_shortage_events || 0,
                    risk_level: trendInfo.market_insights?.risk_level || "Unknown",
                    recommendation: trendInfo.market_insights?.recommendation || "No trend data available"
                };
            }
            
        } catch (error) {
            drugAnalysis.error = `Analysis failed: ${error.message}`;
            drugAnalysis.risk_level = "Unknown";
        }
        
        results.individual_analyses[drug] = drugAnalysis;
    }
    
    // Generate recommendations
    const highRiskCount = results.risk_assessment.high_risk.length;
    const totalDrugs = drugList.length;
    
    if (highRiskCount > totalDrugs * 0.3) {
        results.formulary_recommendations.push("HIGH ALERT: Over 30% of drugs show shortage risks");
        results.formulary_recommendations.push("Recommend immediate alternative sourcing for high-risk medications");
    }
    
    if (results.batch_summary.drugs_with_shortages > 0) {
        results.formulary_recommendations.push(`Monitor ${results.batch_summary.drugs_with_shortages} drugs with active shortage concerns`);
    }
    
    if (results.risk_assessment.low_risk.length === totalDrugs) {
        results.formulary_recommendations.push("No significant shortage risks detected in this drug set");
    }
    
    results.formulary_recommendations.push(`Analyzed ${totalDrugs} drugs with ${results.batch_summary.total_shortage_events} total shortage events`);
    
    return results;
}

export {
    fetchDrugLabelInfo,
    fetchDrugShortageInfo,
    searchDrugRecalls,
    analyzeDrugMarketTrends,
    batchDrugAnalysis
};