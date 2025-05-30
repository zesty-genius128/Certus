# mcp_med_info_server.py
import os
from dotenv import load_dotenv
import json
from typing import Union, List, Dict, Any # Keep typing for type hints

# MCP SDK imports
from mcp.server.fastmcp import FastMCP
# We will rely on FastMCP to infer schema from type hints and docstrings,
# so explicit ToolParameter, PrimitiveType imports might not be needed.

import openfda_client

load_dotenv()

mcp_app = FastMCP(
    name="MedicationInformationService",
    description="An MCP server that provides comprehensive information about medications using openFDA."
)

def get_medication_profile_logic(drug_identifier: str, identifier_type: str = "openfda.generic_name") -> Dict[str, Any]:
    """
    Core logic to fetch and combine drug label and shortage information.
    """
    print(f"MCP Server Logic: Request for drug: {drug_identifier}, type: {identifier_type}")

    label_info = openfda_client.fetch_drug_label_info(drug_identifier, identifier_type=identifier_type)

    # Determine the best identifier for shortage search
    # Prefer generic name if available from label info, otherwise use the original identifier
    shortage_search_term = drug_identifier # Default to original identifier
    if label_info and not label_info.get("error") and "openfda" in label_info:
        generic_names = label_info["openfda"].get("generic_name")
        if generic_names and isinstance(generic_names, list) and len(generic_names) > 0:
            shortage_search_term = generic_names[0]
            print(f"MCP Server Logic: Using generic name '{shortage_search_term}' for shortage lookup.")
        else:
            print(f"MCP Server Logic: No generic name found in label, using original identifier '{drug_identifier}' for shortage lookup.")
    else:
        print(f"MCP Server Logic: Label info error or not found, using original identifier '{drug_identifier}' for shortage lookup.")


    shortage_info = openfda_client.fetch_drug_shortage_info(shortage_search_term)

    profile = {
        "drug_identifier_requested": drug_identifier,
        "identifier_type_used_for_label": identifier_type,
        "identifier_used_for_shortage_lookup": shortage_search_term,
        "label_information": {
            "brand_name": label_info.get("openfda", {}).get("brand_name", []),
            "generic_name": label_info.get("openfda", {}).get("generic_name", []),
            "manufacturer_name": label_info.get("openfda", {}).get("manufacturer_name", []),
            "indications_and_usage": label_info.get("indications_and_usage", ["Not found or not parsed"]),
            "adverse_reactions": label_info.get("adverse_reactions", ["Not found or not parsed"]),
            "warnings_and_cautions": label_info.get("warnings_and_cautions", ["Not found or not parsed"]),
            "dosage_and_administration": label_info.get("dosage_and_administration", ["Not found or not parsed"]),
            "patient_counseling_information": label_info.get("patient_counseling_information", ["Not found or not parsed"]),
        },
        "shortage_status": shortage_info,
        "data_sources": ["openFDA Drug Label API", "openFDA Drug Shortage API"]
    }

    if label_info.get("error"):
        profile["label_information"]["error"] = label_info.get("error", "Unknown label API error")
    if shortage_info.get("error"):
        profile["shortage_status"]["error"] = shortage_info.get("error", "Unknown shortage API error")
    
    # Add a general success/failure indicator at the top level
    if label_info.get("error") and shortage_info.get("error"):
        profile["overall_status"] = "Failed to retrieve any information"
    elif label_info.get("error"):
        profile["overall_status"] = "Retrieved shortage info, but failed to get label info"
    elif shortage_info.get("error"):
        profile["overall_status"] = "Retrieved label info, but failed to get shortage info"
    else:
        profile["overall_status"] = "Successfully retrieved available information"


    return profile

@mcp_app.tool()
async def get_medication_profile(
    drug_identifier: str,
    identifier_type: str = "openfda.generic_name" # Default for label search
) -> Dict[str, Any]:
    """
    Retrieves comprehensive information about a medication from openFDA,
    including labeling details (uses, side effects, manufacturer)
    and current drug shortage status.

    Args:
        drug_identifier: The name (generic or brand), NDC, or other identifier of the drug.
        identifier_type: For drug label search - e.g., 'openfda.generic_name',
                         'openfda.brand_name', 'product_ndc'. Defaults to 'openfda.generic_name'.
                         Shortage search is typically attempted using the generic name.

    Returns:
        A dictionary containing comprehensive medication information.
    """
    # For now, calling synchronous logic. Consider asyncio.to_thread for production.
    return get_medication_profile_logic(drug_identifier, identifier_type)

if __name__ == "__main__":
    print("Starting MCP Medication Information Server...")
    print("This server will listen for requests on stdin/stdout by default.")
    # FastMCP registers tools internally. We can just state what we expect.
    print("Registered tools: get_medication_profile (expected)")
    # The MCP client will discover the tools when it connects.
    # If you need to programmatically access the tool definitions from the mcp_app object,
    # you'd refer to the FastMCP documentation for the correct attribute/method.
    # For now, this print statement is a placeholder.
    mcp_app.run(transport='stdio')

