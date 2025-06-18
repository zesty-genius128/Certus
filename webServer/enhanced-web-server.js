#!/usr/bin/env node

// enhanced-web-server.js - Web API version of the enhanced medication server
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { 
    fetchDrugLabelInfo,
    fetchDrugShortageInfo, 
    searchDrugRecalls,
    analyzeDrugMarketTrends,
    batchDrugAnalysis
} from './openfda-client.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Error handler
const handleError = (res, error, operation) => {
    console.error(`Error in ${operation}:`, error);
    res.status(500).json({
        error: `Error in ${operation}: ${error.message}`,
        operation: operation
    });
};

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'Enhanced Medication Information API',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

// API documentation endpoint
app.get('/', (req, res) => {
    res.json({
        service: 'Enhanced Medication Information API',
        version: '1.0.0',
        endpoints: {
            'GET /health': 'Health check',
            'GET /': 'API documentation',
            'POST /medication/profile': 'Get complete drug profile',
            'POST /medication/shortages': 'Search drug shortages',
            'POST /medication/recalls': 'Search drug recalls',
            'POST /medication/label': 'Get drug label only',
            'POST /medication/trends': 'Analyze market trends',
            'POST /medication/batch': 'Batch drug analysis',
            'GET /medication/shortage-guidance/:drugName': 'Get shortage search guidance'
        },
        data_sources: [
            'OpenFDA Drug Label API',
            'OpenFDA Drug Shortages API',
            'OpenFDA Drug Enforcement API'
        ]
    });
});

// Get complete medication profile
app.post('/medication/profile', async (req, res) => {
    try {
        const { drug_identifier, identifier_type = "openfda.generic_name" } = req.body;
        
        if (!drug_identifier) {
            return res.status(400).json({
                error: 'drug_identifier is required',
                example: { drug_identifier: 'aspirin', identifier_type: 'openfda.generic_name' }
            });
        }

        // Get label information
        const labelInfo = await fetchDrugLabelInfo(drug_identifier, identifier_type);

        // Determine best search term for shortage lookup
        let shortageSearchTerm = drug_identifier;
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

        // Build response
        const response = {
            drug_identifier_requested: drug_identifier,
            identifier_type_used: identifier_type,
            shortage_search_term: shortageSearchTerm,
            label_information: parsedLabelInfo,
            shortage_information: shortageInfo,
            data_sources: {
                label_data: "openFDA Drug Label API",
                shortage_data: "openFDA Drug Shortages API"
            },
            api_version: "1.0.0",
            timestamp: new Date().toISOString()
        };

        res.json(response);
    } catch (error) {
        handleError(res, error, 'medication profile');
    }
});

// Search drug shortages
app.post('/medication/shortages', async (req, res) => {
    try {
        const { search_term, limit = 10 } = req.body;
        
        if (!search_term) {
            return res.status(400).json({
                error: 'search_term is required',
                example: { search_term: 'lisinopril', limit: 10 }
            });
        }

        const shortageInfo = await fetchDrugShortageInfo(search_term);
        
        res.json({
            search_term: search_term,
            shortage_data: shortageInfo,
            data_source: "openFDA Drug Shortages API",
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        handleError(res, error, 'shortage search');
    }
});

// Search drug recalls
app.post('/medication/recalls', async (req, res) => {
    try {
        const { search_term, limit = 10 } = req.body;
        
        if (!search_term) {
            return res.status(400).json({
                error: 'search_term is required',
                example: { search_term: 'ibuprofen', limit: 10 }
            });
        }

        const recallInfo = await searchDrugRecalls(search_term);
        
        res.json({
            search_term: search_term,
            recall_data: recallInfo,
            data_source: "openFDA Drug Enforcement API",
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        handleError(res, error, 'recall search');
    }
});

// Get drug label only
app.post('/medication/label', async (req, res) => {
    try {
        const { drug_identifier, identifier_type = "openfda.generic_name" } = req.body;
        
        if (!drug_identifier) {
            return res.status(400).json({
                error: 'drug_identifier is required',
                example: { drug_identifier: 'metformin', identifier_type: 'openfda.generic_name' }
            });
        }

        const labelInfo = await fetchDrugLabelInfo(drug_identifier, identifier_type);
        
        res.json({
            drug_identifier: drug_identifier,
            identifier_type: identifier_type,
            label_data: labelInfo,
            data_source: "openFDA Drug Label API",
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        handleError(res, error, 'label retrieval');
    }
});

// Analyze market trends
app.post('/medication/trends', async (req, res) => {
    try {
        const { drug_name, months_back = 12 } = req.body;
        
        if (!drug_name) {
            return res.status(400).json({
                error: 'drug_name is required',
                example: { drug_name: 'insulin', months_back: 12 }
            });
        }

        const trendAnalysis = await analyzeDrugMarketTrends(drug_name, months_back);
        
        res.json({
            drug_analyzed: drug_name,
            analysis_period: `${months_back} months`,
            trend_data: trendAnalysis,
            data_source: "openFDA Drug Shortages API - Historical Analysis",
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        handleError(res, error, 'trend analysis');
    }
});

// Batch drug analysis
app.post('/medication/batch', async (req, res) => {
    try {
        const { drug_list, include_trends = false } = req.body;
        
        if (!drug_list || !Array.isArray(drug_list)) {
            return res.status(400).json({
                error: 'drug_list array is required',
                example: { drug_list: ['aspirin', 'metformin', 'lisinopril'], include_trends: false }
            });
        }

        if (drug_list.length > 25) {
            return res.status(400).json({
                error: "Batch size too large. Maximum 25 drugs per batch.",
                recommendation: "Split drug list into smaller batches"
            });
        }

        const batchResults = await batchDrugAnalysis(drug_list, include_trends);
        
        res.json({
            batch_analysis: batchResults,
            data_source: "openFDA APIs - Comprehensive Batch Analysis",
            analysis_type: "Formulary Risk Assessment",
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        handleError(res, error, 'batch analysis');
    }
});

// Get shortage search guidance
app.get('/medication/shortage-guidance/:drugName', async (req, res) => {
    try {
        const { drugName } = req.params;
        
        const openfdaResults = await fetchDrugShortageInfo(drugName);
        
        const guidance = {
            drug_name: drugName,
            openfda_results: openfdaResults,
            additional_search_strategies: {
                recommended_queries: [
                    `${drugName} shortage 2025`,
                    `${drugName} drug shortage current`,
                    `${drugName} supply shortage FDA`,
                    `ASHP ${drugName} shortage`
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
            data_source: "Combined openFDA API and additional source guidance",
            timestamp: new Date().toISOString()
        };
        
        res.json(guidance);
    } catch (error) {
        handleError(res, error, 'shortage guidance');
    }
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Endpoint not found',
        message: 'Visit GET / for API documentation',
        available_endpoints: [
            'POST /medication/profile',
            'POST /medication/shortages',
            'POST /medication/recalls',
            'POST /medication/label',
            'POST /medication/trends',
            'POST /medication/batch',
            'GET /medication/shortage-guidance/:drugName'
        ]
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Enhanced Medication Information API running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`API docs: http://localhost:${PORT}/`);
    console.log(`Example: curl -X POST http://localhost:${PORT}/medication/profile -H "Content-Type: application/json" -d '{"drug_identifier": "aspirin"}'`);
});