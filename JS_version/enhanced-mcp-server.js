import dotenv from 'dotenv';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { 
    fetchDrugLabelInfo,
    fetchDrugShortageInfo, 
    searchDrugRecalls,
    analyzeDrugMarketTrends,
    batchDrugAnalysis
} from './openfda-client.js';

// Load environment variables from .env file
dotenv.config();

/**
 * Get complete drug profile including label and shortage information
 */
function getMedicationProfileLogic(drugIdentifier, identifierType) {
    return new Promise(async (resolve) => {
        try {
            // Get label information
            const labelInfo = await fetchDrugLabelInfo(drugIdentifier, identifierType);

            // Determine best search term for shortage lookup
            let shortageSearchTerm = drugIdentifier;
            if (labelInfo && !labelInfo.error && labelInfo.openfda) {
                const genericNames = labelInfo.openfda.generic_name;
                if (genericNames && Array.isArray(genericNames) && genericNames.length > 0) {
                    shortageSearchTerm = genericNames[0];
                }
            }

            // Get shortage information
            const shortageInfo = await fetchDrugShortageInfo(shortageSearchTerm);

            // Parse label information
            let parsedLabelInfo = {};
            if (labelInfo && !labelInfo.error) {
                parsedLabelInfo = {
                    brand_name: labelInfo.openfda?.brand_name || [],
                    generic_name: labelInfo.openfda?.generic_name || [],
                    manufacturer_name: labelInfo.openfda?.manufacturer_name || [],
                    route: labelInfo.openfda?.route || [],
                    dosage_form: labelInfo.openfda?.dosage_form || [],
                    strength: labelInfo.openfda?.strength || [],
                    indications_and_usage: labelInfo.indications_and_usage || ["Not available"],
                    adverse_reactions: labelInfo.adverse_reactions || ["Not available"],
                    warnings_and_cautions: labelInfo.warnings_and_cautions || ["Not available"],
                    dosage_and_administration: labelInfo.dosage_and_administration || ["Not available"],
                    contraindications: labelInfo.contraindications || ["Not available"],
                    drug_interactions: labelInfo.drug_interactions || ["Not available"]
                };
            } else {
                parsedLabelInfo.error = labelInfo?.error || "Unknown label API error";
            }

            // Build comprehensive profile
            const profile = {
                drug_identifier_requested: drugIdentifier,
                identifier_type_used: identifierType,
                shortage_search_term: shortageSearchTerm,
                label_information: parsedLabelInfo,
                shortage_information: shortageInfo,
                data_sources: {
                    label_data: "openFDA Drug Label API",
                    shortage_data: "openFDA Drug Shortages API"
                }
            };

            // Determine overall status
            const hasLabelError = "error" in parsedLabelInfo;
            const hasShortageError = "error" in shortageInfo;
            const hasShortageData = "shortages" in shortageInfo && shortageInfo.shortages.length > 0;

            if (hasLabelError && hasShortageError) {
                profile.overall_status = "Failed to retrieve label and shortage information";
            } else if (hasLabelError) {
                if (hasShortageData) {
                    profile.overall_status = "Retrieved shortage data but failed to get label information";
                } else {
                    profile.overall_status = "No shortage found and failed to get label information";
                }
            } else if (hasShortageError) {
                profile.overall_status = "Retrieved label information but shortage API error occurred";
            } else if (!labelInfo || !labelInfo.openfda) {
                if (hasShortageData) {
                    profile.overall_status = "Found shortage information but label data was minimal";
                } else {
                    profile.overall_status = "No shortage found and label data was minimal";
                }
            } else {
                if (hasShortageData) {
                    profile.overall_status = "SUCCESS: Retrieved complete drug profile with current shortage information";
                } else {
                    profile.overall_status = "SUCCESS: Retrieved complete drug profile - no current shortages found";
                }
            }

            resolve(profile);
        } catch (error) {
            resolve({
                error: `Error getting medication profile: ${error.message}`,
                drug_identifier_requested: drugIdentifier,
                identifier_type_used: identifierType
            });
        }
    });
}

// Create the MCP server
const server = new Server(
    {
        name: "EnhancedMedicationInformationService",
        version: "0.3.0",
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "get_medication_profile",
                description: "Get complete drug information including label and shortage status",
                inputSchema: {
                    type: "object",
                    properties: {
                        drug_identifier: {
                            type: "string",
                            description: "The drug identifier to search for"
                        },
                        identifier_type: {
                            type: "string",
                            description: "The type of identifier",
                            default: "openfda.generic_name"
                        }
                    },
                    required: ["drug_identifier"]
                }
            },
            {
                name: "search_drug_shortages",
                description: "Search for drug shortages using openFDA database",
                inputSchema: {
                    type: "object",
                    properties: {
                        search_term: {
                            type: "string",
                            description: "Drug name to search for shortages"
                        },
                        limit: {
                            type: "integer",
                            description: "Maximum number of results",
                            default: 10
                        }
                    },
                    required: ["search_term"]
                }
            },
            {
                name: "get_shortage_search_guidance",
                description: "Get search guidance and tips for finding drug shortage information",
                inputSchema: {
                    type: "object",
                    properties: {
                        drug_name: {
                            type: "string",
                            description: "Drug name to get search guidance for"
                        }
                    },
                    required: ["drug_name"]
                }
            },
            {
                name: "search_drug_recalls",
                description: "Search for drug recalls using openFDA enforcement database",
                inputSchema: {
                    type: "object",
                    properties: {
                        search_term: {
                            type: "string",
                            description: "Drug name to search for recalls"
                        },
                        limit: {
                            type: "integer",
                            description: "Maximum number of results",
                            default: 10
                        }
                    },
                    required: ["search_term"]
                }
            },
            {
                name: "get_drug_label_only",
                description: "Get only FDA label information for a drug",
                inputSchema: {
                    type: "object",
                    properties: {
                        drug_identifier: {
                            type: "string",
                            description: "The drug identifier to search for"
                        },
                        identifier_type: {
                            type: "string",
                            description: "The type of identifier",
                            default: "openfda.generic_name"
                        }
                    },
                    required: ["drug_identifier"]
                }
            },
            {
                name: "analyze_drug_market_trends",
                description: "Analyze drug shortage patterns and market trends",
                inputSchema: {
                    type: "object",
                    properties: {
                        drug_name: {
                            type: "string",
                            description: "Drug name to analyze"
                        },
                        months_back: {
                            type: "integer",
                            description: "Number of months to look back",
                            default: 12
                        }
                    },
                    required: ["drug_name"]
                }
            },
            {
                name: "batch_drug_analysis",
                description: "Analyze multiple drugs for shortages, recalls, and risk assessment",
                inputSchema: {
                    type: "object",
                    properties: {
                        drug_list: {
                            type: "array",
                            items: { type: "string" },
                            description: "List of drug names to analyze"
                        },
                        include_trends: {
                            type: "boolean",
                            description: "Whether to include trend analysis",
                            default: false
                        }
                    },
                    required: ["drug_list"]
                }
            }
        ]
    };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
        switch (name) {
            case "get_medication_profile": {
                const { drug_identifier, identifier_type = "openfda.generic_name" } = args;
                const result = await getMedicationProfileLogic(drug_identifier, identifier_type);
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(result, null, 2)
                        }
                    ]
                };
            }

            case "search_drug_shortages": {
                const { search_term, limit = 10 } = args;
                const shortageInfo = await fetchDrugShortageInfo(search_term);
                const result = {
                    search_term: search_term,
                    shortage_data: shortageInfo,
                    data_source: "openFDA Drug Shortages API",
                    note: "Data from openFDA endpoint with 1,900+ shortage records"
                };
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(result, null, 2)
                        }
                    ]
                };
            }

            case "get_shortage_search_guidance": {
                const { drug_name } = args;
                const openfdaResults = await fetchDrugShortageInfo(drug_name);
                const guidance = {
                    drug_name: drug_name,
                    openfda_results: openfdaResults,
                    additional_search_strategies: {
                        recommended_queries: [
                            `${drug_name} shortage 2025`,
                            `${drug_name} drug shortage current`,
                            `${drug_name} supply shortage FDA`,
                            `ASHP ${drug_name} shortage`
                        ],
                        authoritative_sources: {
                            ashp_database: {
                                url: "https://www.ashp.org/drug-shortages/current-shortages",
                                description: "American Society of Health-System Pharmacists shortage database",
                                search_method: "Use site search or browse by drug name"
                            },
                            fda_database: {
                                url: "https://www.accessdata.fda.gov/scripts/drugshortages/",
                                description: "Official FDA Drug Shortage Database",
                                search_method: "Search by active ingredient or brand name"
                            }
                        }
                    },
                    data_source: "Combined openFDA API and additional source guidance"
                };
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(guidance, null, 2)
                        }
                    ]
                };
            }

            case "search_drug_recalls": {
                const { search_term, limit = 10 } = args;
                const recallInfo = await searchDrugRecalls(search_term);
                const result = {
                    search_term: search_term,
                    recall_data: recallInfo,
                    data_source: "openFDA Drug Enforcement API",
                    note: "Data from functional openFDA endpoint"
                };
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(result, null, 2)
                        }
                    ]
                };
            }

            case "get_drug_label_only": {
                const { drug_identifier, identifier_type = "openfda.generic_name" } = args;
                const labelInfo = await fetchDrugLabelInfo(drug_identifier, identifier_type);
                const result = {
                    drug_identifier: drug_identifier,
                    identifier_type: identifier_type,
                    label_data: labelInfo,
                    data_source: "openFDA Drug Label API",
                    reliability: "High - this endpoint is working correctly"
                };
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(result, null, 2)
                        }
                    ]
                };
            }

            case "analyze_drug_market_trends": {
                const { drug_name, months_back = 12 } = args;
                const trendAnalysis = await analyzeDrugMarketTrends(drug_name, months_back);
                const result = {
                    drug_analyzed: drug_name,
                    analysis_period: `${months_back} months`,
                    trend_data: trendAnalysis,
                    data_source: "openFDA Drug Shortages API - Historical Analysis",
                    analysis_type: "Market Trends and Risk Assessment"
                };
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(result, null, 2)
                        }
                    ]
                };
            }

            case "batch_drug_analysis": {
                const { drug_list, include_trends = false } = args;
                if (drug_list.length > 25) {
                    const result = {
                        error: "Batch size too large. Maximum 25 drugs per batch.",
                        recommendation: "Split drug list into smaller batches for optimal performance"
                    };
                    return {
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify(result, null, 2)
                            }
                        ]
                    };
                }

                const batchResults = await batchDrugAnalysis(drug_list, include_trends);
                const result = {
                    batch_analysis: batchResults,
                    data_source: "openFDA APIs - Comprehensive Batch Analysis",
                    analysis_type: "Formulary Risk Assessment",
                    note: `Analyzed ${drug_list.length} drugs with trend analysis: ${include_trends ? 'enabled' : 'disabled'}`
                };
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(result, null, 2)
                        }
                    ]
                };
            }

            default:
                throw new Error(`Unknown tool: ${name}`);
        }
    } catch (error) {
        return {
            content: [
                {
                    type: "text",
                    text: `Error: ${error.message}`
                }
            ],
            isError: true
        };
    }
});

// Start the server
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("MCP server running on stdio");
}

main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});