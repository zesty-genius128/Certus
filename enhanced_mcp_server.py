# enhanced_mcp_server.py
import os
from dotenv import load_dotenv
import sys
from typing import Dict, Any, Optional
import asyncio
import requests
import json

# MCP SDK imports
from mcp.server.fastmcp import FastMCP

# Import your openFDA client functions
import openfda_client

# Load environment variables from .env file
load_dotenv()

# Initialize FastMCP Application
mcp_app = FastMCP(
    name="EnhancedMedicationInformationService",
    version="0.2.0",
    description="An MCP server that provides comprehensive medication information using openFDA with WORKING shortage data."
)

def get_medication_profile_logic(drug_identifier: str, identifier_type: str) -> Dict[str, Any]:
    """
    Internal logic to fetch and combine drug label and shortage information.
    NOW USING THE WORKING SHORTAGES API!
    """
    print(f"MCP Server Logic: Request for drug: {drug_identifier}, type: {identifier_type}", file=sys.stderr)
    sys.stderr.flush()

    # Fetch label information (this works)
    label_info = openfda_client.fetch_drug_label_info(drug_identifier, identifier_type=identifier_type)

    # Determine the best search term for shortage lookup
    shortage_search_term = drug_identifier
    if label_info and not label_info.get("error") and "openfda" in label_info:
        generic_names = label_info["openfda"].get("generic_name")
        if generic_names and isinstance(generic_names, list) and len(generic_names) > 0:
            shortage_search_term = generic_names[0]
            print(f"MCP Server Logic: Using generic name '{shortage_search_term}' for shortage lookup.", file=sys.stderr)
            sys.stderr.flush()

    # Fetch shortage information using the WORKING API
    shortage_info = openfda_client.fetch_drug_shortage_info(shortage_search_term)

    # Parse and structure label information
    parsed_label_info = {}
    if label_info and not label_info.get("error"):
        parsed_label_info = {
            "brand_name": label_info.get("openfda", {}).get("brand_name", []),
            "generic_name": label_info.get("openfda", {}).get("generic_name", []),
            "manufacturer_name": label_info.get("openfda", {}).get("manufacturer_name", []),
            "route": label_info.get("openfda", {}).get("route", []),
            "dosage_form": label_info.get("openfda", {}).get("dosage_form", []),
            "strength": label_info.get("openfda", {}).get("strength", []),
            "indications_and_usage": label_info.get("indications_and_usage", ["Not available"]),
            "adverse_reactions": label_info.get("adverse_reactions", ["Not available"]),
            "warnings_and_cautions": label_info.get("warnings_and_cautions", ["Not available"]),
            "dosage_and_administration": label_info.get("dosage_and_administration", ["Not available"]),
            "contraindications": label_info.get("contraindications", ["Not available"]),
            "drug_interactions": label_info.get("drug_interactions", ["Not available"]),
        }
    else:
        parsed_label_info["error"] = label_info.get("error", "Unknown label API error")

    # Build the comprehensive profile
    profile = {
        "drug_identifier_requested": drug_identifier,
        "identifier_type_used": identifier_type,
        "shortage_search_term": shortage_search_term,
        "label_information": parsed_label_info,
        "shortage_information": shortage_info,
        "data_sources": {
            "label_data": "openFDA Drug Label API",
            "shortage_data": "openFDA Drug Shortages API (https://api.fda.gov/drug/shortages.json)"
        }
    }

    # Determine overall status
    has_label_error = "error" in parsed_label_info
    has_shortage_error = "error" in shortage_info
    has_shortage_data = "shortages" in shortage_info and len(shortage_info["shortages"]) > 0

    if has_label_error and has_shortage_error:
        profile["overall_status"] = "Failed to retrieve label and shortage information"
    elif has_label_error:
        if has_shortage_data:
            profile["overall_status"] = "Retrieved shortage data but failed to get label information"
        else:
            profile["overall_status"] = "No shortage found and failed to get label information"
    elif has_shortage_error:
        profile["overall_status"] = "Retrieved label information but shortage API error occurred"
    elif not label_info or not label_info.get("openfda"):
        if has_shortage_data:
            profile["overall_status"] = "Found shortage information but label data was minimal"
        else:
            profile["overall_status"] = "No shortage found and label data was minimal"
    else:
        if has_shortage_data:
            profile["overall_status"] = "SUCCESS: Retrieved complete drug profile with current shortage information"
        else:
            profile["overall_status"] = "SUCCESS: Retrieved complete drug profile - no current shortages found"
    
    print(f"MCP Server Logic: Profile assembled for {drug_identifier}.", file=sys.stderr)
    sys.stderr.flush()
    return profile

# Define MCP Tools
@mcp_app.tool()
async def get_medication_profile(
    drug_identifier: str,
    identifier_type: str = "openfda.generic_name"
) -> Dict[str, Any]:
    """
    Retrieves comprehensive information about a medication from openFDA.
    Provides FDA-approved labeling information and current shortage status.

    Args:
        drug_identifier: The name (generic or brand), NDC, or other identifier of the drug.
        identifier_type: How to search openFDA labels ('openfda.generic_name', 'openfda.brand_name', etc.)

    Returns:
        A dictionary containing FDA label information and current shortage data.
    """
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, get_medication_profile_logic, drug_identifier, identifier_type)

@mcp_app.tool()
async def search_drug_shortages(
    search_term: str,
    limit: int = 10
) -> Dict[str, Any]:
    """
    Searches for current drug shortage information using the working OpenFDA shortages API.
    NOW FUNCTIONAL with real shortage data from https://api.fda.gov/drug/shortages.json
    
    Args:
        search_term: The drug name or active ingredient to search for
        limit: Maximum number of shortage records to return (default: 10)
    
    Returns:
        A dictionary containing current shortage information from OpenFDA.
    """
    print(f"MCP Server: Searching OpenFDA for shortages of: {search_term}", file=sys.stderr)
    sys.stderr.flush()
    
    loop = asyncio.get_event_loop()
    shortage_info = await loop.run_in_executor(None, openfda_client.fetch_drug_shortage_info, search_term)
    
    result = {
        "search_term": search_term,
        "shortage_data": shortage_info,
        "data_source": "openFDA Drug Shortages API (https://api.fda.gov/drug/shortages.json)",
        "note": "This data comes from a working OpenFDA endpoint with 1,912+ shortage records"
    }
    
    return result

@mcp_app.tool()
async def get_shortage_search_guidance(
    drug_name: str
) -> Dict[str, Any]:
    """
    Provides specific guidance on how to search for current drug shortage information.
    Includes both OpenFDA results and additional search strategies.
    
    Args:
        drug_name: The drug name to search for shortage information
    
    Returns:
        Detailed guidance on finding current shortage information.
    """
    print(f"MCP Server: Providing shortage search guidance for: {drug_name}", file=sys.stderr)
    sys.stderr.flush()
    
    # First get OpenFDA results
    loop = asyncio.get_event_loop()
    openfda_results = await loop.run_in_executor(None, openfda_client.fetch_drug_shortage_info, drug_name)
    
    # Clean the drug name for better search results
    clean_name = drug_name.lower().strip()
    
    guidance = {
        "drug_name": drug_name,
        "openfda_results": openfda_results,
        "additional_search_strategies": {
            "recommended_queries": [
                f"{drug_name} shortage 2025",
                f"{drug_name} drug shortage current",
                f"{drug_name} supply shortage FDA",
                f"ASHP {drug_name} shortage"
            ],
            "authoritative_sources": {
                "ashp_database": {
                    "url": "https://www.ashp.org/drug-shortages/current-shortages",
                    "description": "American Society of Health-System Pharmacists shortage database",
                    "search_method": "Use site search or browse by drug name"
                },
                "fda_database": {
                    "url": "https://www.accessdata.fda.gov/scripts/drugshortages/",
                    "description": "Official FDA Drug Shortage Database",
                    "search_method": "Search by active ingredient or brand name"
                }
            }
        },
        "data_source": "Combined OpenFDA API + additional source guidance"
    }
    
    return guidance

@mcp_app.tool()
async def search_drug_recalls(
    search_term: str,
    limit: int = 10
) -> Dict[str, Any]:
    """
    Searches for drug recall information using the OpenFDA enforcement API.
    This endpoint is functional and provides current recall/enforcement data.
    
    Args:
        search_term: The drug name to search for in recall records
        limit: Maximum number of recall records to return (default: 10)
    
    Returns:
        A dictionary containing recall information matching the search term.
    """
    print(f"MCP Server: Searching recalls for: {search_term}", file=sys.stderr)
    sys.stderr.flush()
    
    loop = asyncio.get_event_loop()
    recall_info = await loop.run_in_executor(None, openfda_client.search_drug_recalls, search_term)
    
    return {
        "search_term": search_term,
        "recall_data": recall_info,
        "data_source": "openFDA Drug Enforcement API",
        "note": "This data comes from a functional OpenFDA endpoint"
    }

@mcp_app.tool()
async def get_drug_label_only(
    drug_identifier: str,
    identifier_type: str = "openfda.generic_name"
) -> Dict[str, Any]:
    """
    Retrieves only the drug labeling information from openFDA.
    This is the most reliable function since it uses a working API endpoint.
    
    Args:
        drug_identifier: The name (generic or brand), NDC, or other identifier
        identifier_type: How to search openFDA labels
    
    Returns:
        A dictionary containing only FDA-approved drug label information.
    """
    print(f"MCP Server: Fetching FDA label for: {drug_identifier}", file=sys.stderr)
    sys.stderr.flush()
    
    loop = asyncio.get_event_loop()
    label_info = await loop.run_in_executor(None, openfda_client.fetch_drug_label_info, drug_identifier, identifier_type)
    
    return {
        "drug_identifier": drug_identifier,
        "identifier_type": identifier_type,
        "label_data": label_info,
        "data_source": "openFDA Drug Label API (functional)",
        "reliability": "High - this endpoint is working correctly"
    }

# Main Server Execution
if __name__ == "__main__":
    print("Starting Enhanced MCP Medication Information Server...", file=sys.stderr)
    print("Available tools:", file=sys.stderr)
    print("  - get_medication_profile: Complete drug information with shortage data", file=sys.stderr)
    print("  - search_drug_shortages: Direct shortage search using OpenFDA", file=sys.stderr)
    print("  - get_shortage_search_guidance: Comprehensive shortage guidance", file=sys.stderr)
    print("  - search_drug_recalls: Working recall search using openFDA", file=sys.stderr)
    print("  - get_drug_label_only: Reliable FDA label information", file=sys.stderr)
    print("Using WORKING OpenFDA endpoints:", file=sys.stderr)
    print("  - Labels: https://api.fda.gov/drug/label.json", file=sys.stderr)
    print("  - Shortages: https://api.fda.gov/drug/shortages.json", file=sys.stderr)
    print("  - Recalls: https://api.fda.gov/drug/enforcement.json", file=sys.stderr)
    sys.stderr.flush()
    
    mcp_app.run(transport='stdio')