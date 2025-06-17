#!/usr/bin/env node

// drug-server.js - MCP server for drug features
import dotenv from 'dotenv';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import {
    checkDrugInteractions,
    convertDrugNames,
    getAdverseEvents
} from './drug-features.js';

// Load environment variables from .env file
dotenv.config();

// Create the MCP server
const server = new Server(
    {
        name: "DrugFeaturesService",
        version: "1.0.0",
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

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
        switch (name) {
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

// Start the server
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Drug Features Service MCP server running on stdio");
}

main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});