#!/usr/bin/env node

import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { 
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Import all our existing functionality
import {
    fetchDrugLabelInfo,
    fetchDrugShortageInfo,
    searchDrugRecalls,
    analyzeDrugMarketTrends,
    batchDrugAnalysis
} from './openfda-client.js';

import {
    checkDrugInteractions,
    convertDrugNames,
    getAdverseEvents
} from './drug-features.js';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Enhanced medication profile logic (from original enhanced-mcp-server.js)
async function getMedicationProfileLogic(drugIdentifier, identifierType) {
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

        return profile;
    } catch (error) {
        return {
            error: `Error getting medication profile: ${error.message}`,
            drug_identifier_requested: drugIdentifier,
            identifier_type_used: identifierType
        };
    }
}

// Create the unified MCP server
const server = new Server(
    {
        name: "UnifiedMedicationInformationService",
        version: "1.0.0",
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

// Define all available tools (combining both servers)
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            // Enhanced Medication Tools
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
            },
            // Drug Features Tools
            {
                name: "check_drug_interactions",
                description: "Check for potential drug interactions between medications using RxNav API",
                inputSchema: {
                    type: "object",
                    properties: {
                        drug1: {
                            type: "string",
                            description: "First medication name"
                        },
                        drug2: {
                            type: "string", 
                            description: "Second medication name"
                        },
                        additional_drugs: {
                            type: "array",
                            items: { type: "string" },
                            description: "Optional list of additional medications to check",
                            default: []
                        }
                    },
                    required: ["drug1", "drug2"]
                }
            },
            {
                name: "convert_drug_names",
                description: "Convert between generic and brand names using OpenFDA label data",
                inputSchema: {
                    type: "object",
                    properties: {
                        drug_name: {
                            type: "string",
                            description: "Name of the drug to convert"
                        },
                        conversion_type: {
                            type: "string",
                            description: "Type of conversion - 'generic', 'brand', or 'both'",
                            enum: ["generic", "brand", "both"],
                            default: "both"
                        }
                    },
                    required: ["drug_name"]
                }
            },
            {
                name: "get_adverse_events",
                description: "Get FDA adverse event reports for a medication from FAERS database",
                inputSchema: {
                    type: "object",
                    properties: {
                        drug_name: {
                            type: "string",
                            description: "Name of the medication"
                        },
                        time_period: {
                            type: "string",
                            description: "Time period for analysis (currently not implemented in API)",
                            default: "1year"
                        },
                        severity_filter: {
                            type: "string",
                            description: "Filter by severity - 'all' or 'serious' only",
                            enum: ["all", "serious"],
                            default: "all"
                        }
                    },
                    required: ["drug_name"]
                }
            }
        ]
    };
});

// Handle all tool calls (combining both servers)
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
        switch (name) {
            // Enhanced Medication Tools
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

            // Drug Features Tools
            case "check_drug_interactions": {
                const { drug1, drug2, additional_drugs = [] } = args;
                
                const interactionResults = await checkDrugInteractions(drug1, drug2, additional_drugs);
                
                const result = {
                    interaction_analysis: interactionResults,
                    data_source: "RxNorm API (ingredient analysis)",
                    analysis_type: "Basic Drug Safety Check",
                    note: "Limited to ingredient comparison - consult pharmacist for comprehensive interaction checking"
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

            case "convert_drug_names": {
                const { drug_name, conversion_type = "both" } = args;
                
                const conversionResults = await convertDrugNames(drug_name, conversion_type);
                
                const result = {
                    name_conversion: conversionResults,
                    data_source: "openFDA Drug Label API",
                    analysis_type: "Drug Name Conversion",
                    note: "Uses existing FDA labeling data for name mapping"
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

            case "get_adverse_events": {
                const { drug_name, time_period = "1year", severity_filter = "all" } = args;
                
                const adverseEventResults = await getAdverseEvents(drug_name, time_period, severity_filter);
                
                const result = {
                    adverse_event_analysis: adverseEventResults,
                    data_source: "FDA FAERS (Adverse Event Reporting System)",
                    analysis_type: "Post-Market Safety Surveillance",
                    note: "Real-world adverse event data from healthcare providers and patients"
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

// Create Express app
const app = express();

// Configure CORS
app.use(cors({
    origin: process.env.CORS_ORIGIN || true,
    credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        server: 'UnifiedMedicationInformationService',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

// MCP endpoint
app.use('/mcp', async (req, res) => {
    const transport = new SSEServerTransport('/mcp', res);
    await server.connect(transport);
});

// Root endpoint with service info
app.get('/', (req, res) => {
    res.json({
        service: 'Unified Medication Information MCP Server',
        version: '1.0.0',
        description: 'Comprehensive medication information including drug interactions, shortages, recalls, and adverse events',
        endpoints: {
            health: '/health',
            mcp: '/mcp'
        },
        tools_available: 11,
        data_sources: [
            'openFDA Drug Label API',
            'openFDA Drug Shortages API', 
            'openFDA Drug Enforcement API',
            'RxNorm API',
            'FDA FAERS Database'
        ]
    });
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ 
        error: 'Not found',
        message: 'The requested endpoint does not exist'
    });
});

// Start the server
async function startServer() {
    try {
        app.listen(PORT, HOST, () => {
            console.log(`Unified Medication Information MCP Server started`);
            console.log(`Host: ${HOST}`);
            console.log(`Port: ${PORT}`);
            console.log(`Health check: http://${HOST}:${PORT}/health`);
            console.log(`MCP endpoint: http://${HOST}:${PORT}/mcp`);
            console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
            
            if (process.env.OPENFDA_API_KEY) {
                console.log('OpenFDA API key: configured');
            } else {
                console.log('OpenFDA API key: not configured (using rate-limited access)');
            }
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    process.exit(0);
});

// Start the server
startServer().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});