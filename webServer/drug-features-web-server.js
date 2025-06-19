#!/usr/bin/env node

// drug-features-web-server.js - Web API version of the drug features server
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import {
    checkDrugInteractions,
    convertDrugNames,
    getAdverseEvents
} from './drug-features.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

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
        service: 'Drug Features API',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

// API documentation endpoint
app.get('/', (req, res) => {
    res.json({
        service: 'Drug Features API',
        version: '1.0.0',
        endpoints: {
            'GET /health': 'Health check',
            'GET /': 'API documentation',
            'POST /drug/interactions': 'Check drug interactions',
            'POST /drug/convert-names': 'Convert between generic and brand names',
            'POST /drug/adverse-events': 'Get adverse event reports'
        },
        data_sources: [
            'RxNorm API (ingredient analysis)',
            'OpenFDA Drug Label API',
            'FDA FAERS (Adverse Event Reporting System)'
        ]
    });
});

// Check drug interactions
app.post('/drug/interactions', async (req, res) => {
    try {
        const { drug1, drug2, additional_drugs = [] } = req.body;
        
        if (!drug1 || !drug2) {
            return res.status(400).json({
                error: 'Both drug1 and drug2 are required',
                example: { 
                    drug1: 'aspirin', 
                    drug2: 'warfarin', 
                    additional_drugs: ['ibuprofen'] 
                }
            });
        }

        const interactionResults = await checkDrugInteractions(drug1, drug2, additional_drugs);
        
        res.json({
            interaction_analysis: interactionResults,
            data_source: "RxNorm API (ingredient analysis)",
            analysis_type: "Basic Drug Safety Check",
            note: "Limited to ingredient comparison - consult pharmacist for comprehensive interaction checking",
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        handleError(res, error, 'drug interaction check');
    }
});

// Convert drug names
app.post('/drug/convert-names', async (req, res) => {
    try {
        const { drug_name, conversion_type = "both" } = req.body;
        
        if (!drug_name) {
            return res.status(400).json({
                error: 'drug_name is required',
                example: { 
                    drug_name: 'tylenol', 
                    conversion_type: 'both' 
                },
                valid_conversion_types: ['generic', 'brand', 'both']
            });
        }

        if (!['generic', 'brand', 'both'].includes(conversion_type)) {
            return res.status(400).json({
                error: 'Invalid conversion_type',
                valid_types: ['generic', 'brand', 'both'],
                provided: conversion_type
            });
        }

        const conversionResults = await convertDrugNames(drug_name, conversion_type);
        
        res.json({
            name_conversion: conversionResults,
            data_source: "openFDA Drug Label API",
            analysis_type: "Drug Name Conversion",
            note: "Uses existing FDA labeling data for name mapping",
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        handleError(res, error, 'drug name conversion');
    }
});

// Get adverse events
app.post('/drug/adverse-events', async (req, res) => {
    try {
        const { drug_name, time_period = "1year", severity_filter = "all" } = req.body;
        
        if (!drug_name) {
            return res.status(400).json({
                error: 'drug_name is required',
                example: { 
                    drug_name: 'ibuprofen', 
                    time_period: '1year',
                    severity_filter: 'all'
                },
                valid_severity_filters: ['all', 'serious']
            });
        }

        if (!['all', 'serious'].includes(severity_filter)) {
            return res.status(400).json({
                error: 'Invalid severity_filter',
                valid_filters: ['all', 'serious'],
                provided: severity_filter
            });
        }

        const adverseEventResults = await getAdverseEvents(drug_name, time_period, severity_filter);
        
        res.json({
            adverse_event_analysis: adverseEventResults,
            data_source: "FDA FAERS (Adverse Event Reporting System)",
            analysis_type: "Post-Market Safety Surveillance",
            note: "Real-world adverse event data from healthcare providers and patients",
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        handleError(res, error, 'adverse events lookup');
    }
});

// Combined drug safety analysis endpoint
app.post('/drug/safety-analysis', async (req, res) => {
    try {
        const { drugs, include_interactions = true, include_adverse_events = false } = req.body;
        
        if (!drugs || !Array.isArray(drugs) || drugs.length < 1) {
            return res.status(400).json({
                error: 'drugs array with at least 1 drug is required',
                example: { 
                    drugs: ['aspirin', 'warfarin'], 
                    include_interactions: true,
                    include_adverse_events: false
                }
            });
        }

        if (drugs.length > 10) {
            return res.status(400).json({
                error: 'Maximum 10 drugs allowed for safety analysis',
                provided_count: drugs.length
            });
        }

        const results = {
            drugs_analyzed: drugs,
            analysis_type: "Comprehensive Drug Safety Analysis",
            interactions: null,
            adverse_events: null,
            timestamp: new Date().toISOString()
        };

        // Check interactions if requested and we have 2+ drugs
        if (include_interactions && drugs.length >= 2) {
            const [drug1, drug2, ...additionalDrugs] = drugs;
            results.interactions = await checkDrugInteractions(drug1, drug2, additionalDrugs);
        }

        // Get adverse events if requested
        if (include_adverse_events) {
            results.adverse_events = {};
            for (const drug of drugs) {
                try {
                    results.adverse_events[drug] = await getAdverseEvents(drug, "1year", "all");
                } catch (error) {
                    results.adverse_events[drug] = { error: `Failed to get adverse events: ${error.message}` };
                }
            }
        }

        res.json(results);
    } catch (error) {
        handleError(res, error, 'comprehensive safety analysis');
    }
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Endpoint not found',
        message: 'Visit GET / for API documentation',
        available_endpoints: [
            'POST /drug/interactions',
            'POST /drug/convert-names',
            'POST /drug/adverse-events',
            'POST /drug/safety-analysis'
        ]
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Drug Features API running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`API docs: http://localhost:${PORT}/`);
    console.log(`Example: curl -X POST http://localhost:${PORT}/drug/interactions -H "Content-Type: application/json" -d '{"drug1": "aspirin", "drug2": "warfarin"}'`);
});