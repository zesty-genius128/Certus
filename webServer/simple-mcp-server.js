#!/usr/bin/env node

import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';

// Import your existing functionality
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

// Enhanced medication profile logic (keeping your existing logic)
async function getMedicationProfileLogic(drugIdentifier, identifierType) {
    try {
        const labelInfo = await fetchDrugLabelInfo(drugIdentifier, identifierType);
        let shortageSearchTerm = drugIdentifier;
        
        if (labelInfo && !labelInfo.error && labelInfo.openfda) {
            const genericNames = labelInfo.openfda.generic_name;
            if (genericNames && Array.isArray(genericNames) && genericNames.length > 0) {
                shortageSearchTerm = genericNames[0];
            }
        }

        const shortageInfo = await fetchDrugShortageInfo(shortageSearchTerm);
        
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

// Define available tools (keeping your existing tools)
const TOOLS = [
    {
        name: "get_medication_profile",
        description: "Get complete drug information including label and shortage status",
        inputSchema: {
            type: "object",
            properties: {
                drug_identifier: { type: "string", description: "The drug identifier to search for" },
                identifier_type: { type: "string", description: "The type of identifier", default: "openfda.generic_name" }
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
                search_term: { type: "string", description: "Drug name to search for shortages" },
                limit: { type: "integer", description: "Maximum number of results", default: 10 }
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
                drug_identifier: { type: "string", description: "The drug identifier to search for" },
                identifier_type: { type: "string", description: "The type of identifier", default: "openfda.generic_name" }
            },
            required: ["drug_identifier"]
        }
    },
    {
        name: "check_drug_interactions",
        description: "Check for potential drug interactions between medications",
        inputSchema: {
            type: "object",
            properties: {
                drug1: { type: "string", description: "First medication name" },
                drug2: { type: "string", description: "Second medication name" },
                additional_drugs: { type: "array", items: { type: "string" }, description: "Optional additional medications", default: [] }
            },
            required: ["drug1", "drug2"]
        }
    },
    {
        name: "convert_drug_names",
        description: "Convert between generic and brand names",
        inputSchema: {
            type: "object",
            properties: {
                drug_name: { type: "string", description: "Name of the drug to convert" },
                conversion_type: { type: "string", description: "Type of conversion", enum: ["generic", "brand", "both"], default: "both" }
            },
            required: ["drug_name"]
        }
    },
    {
        name: "get_adverse_events",
        description: "Get FDA adverse event reports for a medication",
        inputSchema: {
            type: "object",
            properties: {
                drug_name: { type: "string", description: "Name of the medication" },
                time_period: { type: "string", description: "Time period for analysis", default: "1year" },
                severity_filter: { type: "string", description: "Filter by severity", enum: ["all", "serious"], default: "all" }
            },
            required: ["drug_name"]
        }
    }
];

// Tool call handler (keeping your existing logic)
async function handleToolCall(name, args) {
    try {
        switch (name) {
            case "get_medication_profile": {
                const { drug_identifier, identifier_type = "openfda.generic_name" } = args;
                const result = await getMedicationProfileLogic(drug_identifier, identifier_type);
                return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
            }

            case "search_drug_shortages": {
                const { search_term, limit = 10 } = args;
                const shortageInfo = await fetchDrugShortageInfo(search_term);
                const result = {
                    search_term: search_term,
                    shortage_data: shortageInfo,
                    data_source: "openFDA Drug Shortages API"
                };
                return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
            }

            case "get_drug_label_only": {
                const { drug_identifier, identifier_type = "openfda.generic_name" } = args;
                const labelInfo = await fetchDrugLabelInfo(drug_identifier, identifier_type);
                const result = {
                    drug_identifier: drug_identifier,
                    identifier_type: identifier_type,
                    label_data: labelInfo,
                    data_source: "openFDA Drug Label API"
                };
                return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
            }

            case "check_drug_interactions": {
                const { drug1, drug2, additional_drugs = [] } = args;
                const interactionResults = await checkDrugInteractions(drug1, drug2, additional_drugs);
                const result = {
                    interaction_analysis: interactionResults,
                    data_source: "RxNorm API (ingredient analysis)",
                    analysis_type: "Basic Drug Safety Check"
                };
                return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
            }

            case "convert_drug_names": {
                const { drug_name, conversion_type = "both" } = args;
                const conversionResults = await convertDrugNames(drug_name, conversion_type);
                const result = {
                    name_conversion: conversionResults,
                    data_source: "openFDA Drug Label API"
                };
                return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
            }

            case "get_adverse_events": {
                const { drug_name, time_period = "1year", severity_filter = "all" } = args;
                const adverseEventResults = await getAdverseEvents(drug_name, time_period, severity_filter);
                const result = {
                    adverse_event_analysis: adverseEventResults,
                    data_source: "FDA FAERS (Adverse Event Reporting System)"
                };
                return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
            }

            default:
                throw new Error(`Unknown tool: ${name}`);
        }
    } catch (error) {
        return {
            content: [{ type: "text", text: `Error: ${error.message}` }],
            isError: true
        };
    }
}

// Create Express app
const app = express();

// Simple CORS - allow all origins for testing
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false
}));

app.use(express.json({ limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        server: 'Unified Medication MCP Server',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        tools_available: TOOLS.length
    });
});

// Root info endpoint
app.get('/', (req, res) => {
    res.json({
        service: 'Unified Medication MCP Server',
        version: '1.0.0',
        description: 'Remote MCP server for medication information',
        tools_available: TOOLS.length,
        endpoints: {
            health: '/health',
            mcp: '/mcp'
        },
        usage: {
            mcp_endpoint: '/mcp',
            method: 'POST',
            content_type: 'application/json'
        }
    });
});

// Main MCP endpoint - simplified for Claude Desktop compatibility
app.post('/mcp', async (req, res) => {
    console.log('MCP request received:', {
        method: req.body?.method,
        id: req.body?.id
    });

    // Set standard JSON response headers
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache');

    try {
        const request = req.body;
        
        // Validate JSON-RPC 2.0 format
        if (!request || typeof request !== 'object') {
            return res.status(400).json({
                jsonrpc: '2.0',
                id: null,
                error: { code: -32700, message: 'Parse error' }
            });
        }

        if (request.jsonrpc !== '2.0') {
            return res.status(400).json({
                jsonrpc: '2.0',
                id: request.id || null,
                error: { code: -32600, message: 'Invalid Request' }
            });
        }

        if (!request.method) {
            return res.status(400).json({
                jsonrpc: '2.0',
                id: request.id || null,
                error: { code: -32600, message: 'Missing method' }
            });
        }

        let result;
        
        // Handle MCP methods
        switch (request.method) {
            case 'initialize':
                result = {
                    protocolVersion: '2024-11-05',
                    capabilities: {
                        tools: {},
                        resources: {},
                        prompts: {}
                    },
                    serverInfo: {
                        name: 'Unified Medication MCP Server',
                        version: '1.0.0'
                    }
                };
                break;

            case 'tools/list':
                result = { tools: TOOLS };
                break;

            case 'tools/call':
                if (!request.params || !request.params.name) {
                    return res.status(400).json({
                        jsonrpc: '2.0',
                        id: request.id,
                        error: { code: -32602, message: 'Invalid params: tool name required' }
                    });
                }
                
                result = await handleToolCall(request.params.name, request.params.arguments || {});
                break;

            default:
                return res.status(400).json({
                    jsonrpc: '2.0',
                    id: request.id || null,
                    error: { code: -32601, message: `Method not found: ${request.method}` }
                });
        }

        // Return standard JSON response
        res.json({
            jsonrpc: '2.0',
            id: request.id,
            result: result
        });

    } catch (error) {
        console.error('MCP endpoint error:', error);
        res.status(500).json({
            jsonrpc: '2.0',
            id: req.body?.id || null,
            error: { code: -32603, message: `Internal error: ${error.message}` }
        });
    }
});

// Handle notifications (no response needed)
app.post('/mcp/notifications/:type', (req, res) => {
    console.log('Notification received:', req.params.type);
    res.status(204).end();
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ 
        error: 'Not found',
        available_endpoints: ['/', '/health', '/mcp']
    });
});

// Error handling
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({ 
        error: 'Internal server error',
        message: error.message
    });
});

// Start server
app.listen(PORT, HOST, () => {
    console.log(`Unified Medication MCP Server`);
    console.log(`Host: ${HOST}`);
    console.log(`Port: ${PORT}`);
    console.log(`MCP Endpoint: /mcp`);
    console.log(`Health Check: /health`);
    console.log(`Tools Available: ${TOOLS.length}`);
});