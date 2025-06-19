#!/usr/bin/env node

import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Simplified medication functions (inline to avoid import issues)
async function fetchDrugLabelInfo(drugIdentifier, identifierType = "openfda.generic_name") {
    const params = new URLSearchParams({
        search: `${identifierType}:"${drugIdentifier}"`,
        limit: '1'
    });
    
    if (process.env.OPENFDA_API_KEY) {
        params.append('api_key', process.env.OPENFDA_API_KEY);
    }

    try {
        const response = await fetch(`https://api.fda.gov/drug/label.json?${params}`, {
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
        return { error: `Request failed: ${error.message}` };
    }
}

async function fetchDrugShortageInfo(drugIdentifier) {
    let cleanName = drugIdentifier.toLowerCase().trim();
    
    const searchTerms = [
        `"${cleanName}"`,
        `generic_name:"${cleanName}"`,
        `proprietary_name:"${cleanName}"`
    ];
    
    for (const searchTerm of searchTerms) {
        const params = new URLSearchParams({
            search: searchTerm,
            limit: '20'
        });
        
        if (process.env.OPENFDA_API_KEY) {
            params.append('api_key', process.env.OPENFDA_API_KEY);
        }

        try {
            const response = await fetch(`https://api.fda.gov/drug/shortages.json?${params}`, {
                timeout: 15000
            });
            
            if (response.status === 404) {
                continue;
            } else if (!response.ok) {
                continue;
            }
                
            const data = await response.json();
            
            if (data.results && data.results.length > 0) {
                const shortages = data.results.map(item => ({
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
                    update_type: item.update_type || "N/A"
                }));
                
                return { shortages };
            }
        } catch (error) {
            continue;
        }
    }
    
    return { status: `No current shortages found for '${drugIdentifier}'` };
}

async function searchDrugRecalls(drugIdentifier) {
    const params = new URLSearchParams({
        search: `product_description:"${drugIdentifier}"`,
        limit: '10'
    });
    
    if (process.env.OPENFDA_API_KEY) {
        params.append('api_key', process.env.OPENFDA_API_KEY);
    }

    try {
        const response = await fetch(`https://api.fda.gov/drug/enforcement.json?${params}`, {
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

async function checkDrugInteractions(drug1, drug2, additionalDrugs = []) {
    try {
        const allDrugs = [drug1, drug2, ...additionalDrugs];
        
        return {
            drugs_analyzed: allDrugs,
            analysis_type: "Basic safety check",
            note: "This is a simplified interaction check. For comprehensive analysis, consult a pharmacist.",
            warning: "Always verify drug interactions with healthcare professionals before making medication decisions.",
            recommendation: "Use clinical decision support tools for detailed interaction analysis"
        };
    } catch (error) {
        return { error: `Error checking interactions: ${error.message}` };
    }
}

async function convertDrugNames(drugName, conversionType = "both") {
    const searchStrategies = [
        ["openfda.generic_name", drugName],
        ["openfda.brand_name", drugName]
    ];
    
    for (const [field, searchTerm] of searchStrategies) {
        const params = new URLSearchParams({
            search: `${field}:"${searchTerm}"`,
            limit: '5'
        });
        
        if (process.env.OPENFDA_API_KEY) {
            params.append('api_key', process.env.OPENFDA_API_KEY);
        }
        
        try {
            const response = await fetch(`https://api.fda.gov/drug/label.json?${params}`, { 
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
}

async function getAdverseEvents(drugName, timePeriod = "1year", severityFilter = "all") {
    const searchTerms = [
        `patient.drug.medicinalproduct:"${drugName}"`,
        `patient.drug.drugindication:"${drugName}"`
    ];
    
    for (const searchTerm of searchTerms) {
        const params = new URLSearchParams({
            search: searchTerm,
            limit: '50'
        });
        
        if (process.env.OPENFDA_API_KEY) {
            params.append('api_key', process.env.OPENFDA_API_KEY);
        }
        
        try {
            const response = await fetch(`https://api.fda.gov/drug/event.json?${params}`, { 
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
                const events = [];
                let seriousEvents = 0;
                
                for (const result of data.results) {
                    const event = {
                        report_id: result.safetyreportid || "Unknown",
                        serious: result.serious || "Unknown",
                        outcome: result.patient?.patientdeath || "Unknown",
                        reactions: []
                    };
                    
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
                
                let filteredEvents = events;
                if (severityFilter === "serious") {
                    filteredEvents = events.filter(e => e.serious === "1");
                }
                
                return {
                    drug_name: drugName,
                    time_period: timePeriod,
                    total_reports: filteredEvents.length,
                    serious_reports: seriousEvents,
                    adverse_events: filteredEvents.slice(0, 20),
                    data_source: "FDA FAERS Database"
                };
            }
                
        } catch (error) {
            continue;
        }
    }
    
    return { status: `No adverse event reports found for '${drugName}'` };
}

// Enhanced medication profile logic
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

// Define available tools
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
        name: "search_drug_recalls",
        description: "Search for drug recalls using openFDA enforcement database",
        inputSchema: {
            type: "object",
            properties: {
                search_term: { type: "string", description: "Drug name to search for recalls" },
                limit: { type: "integer", description: "Maximum number of results", default: 10 }
            },
            required: ["search_term"]
        }
    },
    {
        name: "convert_drug_names",
        description: "Convert between generic and brand names using OpenFDA label data",
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
        description: "Get FDA adverse event reports for a medication from FAERS database",
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

// Tool call handler
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
                    data_source: "Basic safety analysis",
                    analysis_type: "Simplified interaction check"
                };
                return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
            }

            case "search_drug_recalls": {
                const { search_term, limit = 10 } = args;
                const recallInfo = await searchDrugRecalls(search_term);
                const result = {
                    search_term: search_term,
                    recall_data: recallInfo,
                    data_source: "openFDA Drug Enforcement API"
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

// Simple CORS
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

// OAuth 2.0 Authorization Server Metadata (RFC 8414)
app.get('/.well-known/oauth-authorization-server', (req, res) => {
    console.log('OAuth discovery request received');
    const baseUrl = `https://${req.get('host')}`;
    
    res.json({
        issuer: baseUrl,
        authorization_endpoint: `${baseUrl}/oauth/authorize`,
        token_endpoint: `${baseUrl}/oauth/token`,
        registration_endpoint: `${baseUrl}/register`,
        scopes_supported: ["mcp"],
        response_types_supported: ["code"],
        grant_types_supported: ["authorization_code"],
        token_endpoint_auth_methods_supported: ["none"],
        code_challenge_methods_supported: ["S256"],
        authless: true,
        require_auth: false,
        mcp_capabilities: {
            tools: true,
            resources: false,
            prompts: false
        }
    });
});

// Dynamic Client Registration endpoint (RFC 7591)
app.post('/register', (req, res) => {
    console.log('OAuth client registration request received', {
        userAgent: req.get('user-agent')
    });
    
    res.json({
        client_id: "mcp-client-" + Date.now(),
        client_secret: "not-required-for-authless",
        client_id_issued_at: Math.floor(Date.now() / 1000),
        grant_types: ["authorization_code"],
        response_types: ["code"],
        scope: "mcp",
        token_endpoint_auth_method: "none",
        require_auth: false,
        authless: true,
        mcp_endpoint: `https://${req.get('host')}/mcp`
    });
});

// OAuth authorization endpoint
app.get('/oauth/authorize', (req, res) => {
    console.log('OAuth authorization request received', { query: req.query });
    
    const { redirect_uri, state, code_challenge } = req.query;
    
    if (!redirect_uri) {
        return res.status(400).json({ 
            error: 'invalid_request', 
            error_description: 'Missing redirect_uri' 
        });
    }
    
    // Generate authorization code and redirect
    const code = 'mcp_auth_code_' + Date.now();
    const redirectUrl = new URL(redirect_uri);
    redirectUrl.searchParams.set('code', code);
    if (state) redirectUrl.searchParams.set('state', state);
    
    console.log('Redirecting to:', redirectUrl.toString());
    res.redirect(redirectUrl.toString());
});

// OAuth token endpoint
app.post('/oauth/token', (req, res) => {
    console.log('OAuth token request received');
    
    res.json({
        access_token: "mcp_no_auth_required",
        token_type: "bearer",
        expires_in: 3600,
        scope: "mcp",
        authless: true,
        mcp_endpoint: `https://${req.get('host')}/mcp`
    });
});

// Root endpoint - handles both GET (info) and POST (MCP)
app.get('/', (req, res) => {
    res.json({
        service: 'Unified Medication MCP Server',
        version: '1.0.0',
        description: 'Remote MCP server for medication information',
        tools_available: TOOLS.length,
        endpoints: {
            health: '/health',
            mcp: '/ (POST)',
            oauth_discovery: '/.well-known/oauth-authorization-server',
            oauth_register: '/register',
            oauth_authorize: '/oauth/authorize',
            oauth_token: '/oauth/token'
        },
        authentication: 'OAuth 2.0 (authless)',
        transport: 'HTTP POST'
    });
});

// Root MCP endpoint - Claude Desktop expects MCP at root path
app.post('/', async (req, res) => {
    console.log('Root MCP request received:', {
        method: req.body?.method,
        id: req.body?.id
    });

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache');

    try {
        const request = req.body;
        
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

        res.json({
            jsonrpc: '2.0',
            id: request.id,
            result: result
        });

    } catch (error) {
        console.error('Root MCP endpoint error:', error);
        res.status(500).json({
            jsonrpc: '2.0',
            id: req.body?.id || null,
            error: { code: -32603, message: `Internal error: ${error.message}` }
        });
    }
});

// MCP endpoint at /mcp (for compatibility)
app.post('/mcp', async (req, res) => {
    console.log('MCP endpoint request received:', {
        method: req.body?.method,
        id: req.body?.id
    });

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache');

    try {
        const request = req.body;
        
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

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ 
        error: 'Not found',
        available_endpoints: [
            '/', '/health', '/mcp',
            '/.well-known/oauth-authorization-server', 
            '/register', '/oauth/authorize', '/oauth/token'
        ]
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
    console.log(`Unified Medication MCP Server with OAuth Discovery`);
    console.log(`Host: ${HOST}`);
    console.log(`Port: ${PORT}`);
    console.log(`MCP Endpoint: / (POST) and /mcp (POST)`);
    console.log(`Health Check: /health`);
    console.log(`OAuth Discovery: /.well-known/oauth-authorization-server`);
    console.log(`Tools Available: ${TOOLS.length}`);
    console.log(`Authentication: OAuth 2.0 (authless)`);
    
    if (process.env.OPENFDA_API_KEY) {
        console.log('OpenFDA API key: configured');
    } else {
        console.log('OpenFDA API key: not configured (using rate-limited access)');
    }
});