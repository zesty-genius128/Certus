# mcp_med_info_server.py
import os
from dotenv import load_dotenv
import sys
from typing import Dict, Any, Optional
import asyncio

# MCP SDK imports
from mcp.server.fastmcp import FastMCP

# Import your openFDA client functions
import openfda_client

# Load environment variables from .env file
load_dotenv()

# Initialize FastMCP Application
mcp_app = FastMCP(
    name="MedicationInformationService",
    version="0.1.0",
    description="An MCP server that provides comprehensive information about medications using openFDA."
)

def get_medication_profile_logic(drug_identifier: str, identifier_type: str) -> Dict[str, Any]:
    """
    Internal logic to fetch and combine drug label and shortage information.
    """
    print(f"MCP Server Logic: Request for drug: {drug_identifier}, type: {identifier_type}", file=sys.stderr)
    sys.stderr.flush()

    # Fetch label information
    label_info = openfda_client.fetch_drug_label_info(drug_identifier, identifier_type=identifier_type)

    # Determine the best search term for shortage lookup
    shortage_search_term = drug_identifier
    if label_info and not label_info.get("error") and "openfda" in label_info:
        generic_names = label_info["openfda"].get("generic_name")
        if generic_names and isinstance(generic_names, list) and len(generic_names) > 0:
            shortage_search_term = generic_names[0]
            print(f"MCP Server Logic: Using generic name '{shortage_search_term}' for shortage lookup.", file=sys.stderr)
            sys.stderr.flush()

    # Fetch shortage information
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
            "patient_counseling_information": label_info.get("patient_counseling_information", ["Not available"]),
            "contraindications": label_info.get("contraindications", ["Not available"]),
            "drug_interactions": label_info.get("drug_interactions", ["Not available"]),
        }
    else:
        parsed_label_info["error"] = label_info.get("error", "Unknown label API error")

    # Build the comprehensive profile
    profile = {
        "drug_identifier_requested": drug_identifier,
        "identifier_type_used_for_label": identifier_type,
        "identifier_used_for_shortage_lookup": shortage_search_term,
        "label_information": parsed_label_info,
        "shortage_status": shortage_info,
        "data_sources": ["openFDA Drug Label API", "openFDA Drug Shortage API"]
    }

    # Determine overall status
    has_label_error = "error" in parsed_label_info
    has_shortage_error = "error" in shortage_info
    has_shortage_data = "shortages" in shortage_info and len(shortage_info["shortages"]) > 0

    if has_label_error and has_shortage_error:
        profile["overall_status"] = "Failed to retrieve any information"
    elif has_label_error:
        if has_shortage_data:
            profile["overall_status"] = "Retrieved shortage info, but failed to get label info"
        else:
            profile["overall_status"] = "No shortage found and failed to get label info"
    elif has_shortage_error:
        profile["overall_status"] = "Retrieved label info, but failed to get shortage info"
    elif not label_info or not label_info.get("openfda"):
        if has_shortage_data:
            profile["overall_status"] = "Found shortage info, but label data was minimal"
        else:
            profile["overall_status"] = "No shortage found and label data was minimal"
    else:
        if has_shortage_data:
            profile["overall_status"] = "Successfully retrieved label and shortage information"
        else:
            profile["overall_status"] = "Successfully retrieved label info - no current shortage found"
    
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
    This includes labeling details (like uses, side effects, manufacturer)
    and current drug shortage status.

    Args:
        drug_identifier: The name (generic or brand), NDC, or other identifier of the drug.
                         For openFDA label search, this value will be used with the 'identifier_type'.
        identifier_type: Specifies how to search the drug labels in openFDA
                         (e.g., 'openfda.generic_name', 'openfda.brand_name', 'product_ndc').
                         Defaults to 'openfda.generic_name'.

    Returns:
        A dictionary containing structured medication information including label details
        and shortage status.
    """
    # Run the synchronous function in a thread to avoid blocking
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
async def get_drug_label_only(
    drug_identifier: str,
    identifier_type: str = "openfda.generic_name"
) -> Dict[str, Any]:
    """
    Retrieves only the drug labeling information from openFDA.
    
    Args:
        drug_identifier: The name (generic or brand), NDC, or other identifier of the drug.
        identifier_type: Specifies how to search the drug labels in openFDA
    
    Returns:
        A dictionary containing only the drug label information.
    """
    print(f"MCP Server: Fetching label only for: {drug_identifier}", file=sys.stderr)
    sys.stderr.flush()
    
    loop = asyncio.get_event_loop()
    label_info = await loop.run_in_executor(None, openfda_client.fetch_drug_label_info, drug_identifier, identifier_type)
    
    return {
        "drug_identifier": drug_identifier,
        "identifier_type": identifier_type,
        "label_data": label_info,
        "data_source": "openFDA Drug Label API"
    }

# Main Server Execution
if __name__ == "__main__":
    # Log startup to stderr
    print("Starting MCP Medication Information Server...", file=sys.stderr)
    print(f"Available tools: get_medication_profile, search_drug_shortages, get_drug_label_only", file=sys.stderr)
    sys.stderr.flush()
    
    mcp_app.run(transport='stdio')