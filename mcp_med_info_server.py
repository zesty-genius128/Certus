# mcp_med_info_server.py
import os
from dotenv import load_dotenv
import sys # For stderr logging from tools if needed
from typing import Dict, Any # For type hints

# MCP SDK imports
from mcp.server.fastmcp import FastMCP # Corrected import based on common SDK structure

# Import your openFDA client functions
# Make sure openfda_client.py is in the same directory or your PYTHONPATH
import openfda_client

# Load environment variables from .env file
load_dotenv()

# Initialize FastMCP Application
mcp_app = FastMCP(
    name="MedicationInformationService",
    version="0.1.0", # Good practice to add a version
    description="An MCP server that provides comprehensive information about medications using openFDA."
)

# This is the core Python logic. The MCP tool will wrap this.
def get_medication_profile_logic(drug_identifier: str, identifier_type: str) -> Dict[str, Any]:
    """
    Internal logic to fetch and combine drug label and shortage information.
    """
    # Using sys.stderr for server-side logs to keep stdout clean for MCP protocol
    print(f"MCP Server Logic: Request for drug: {drug_identifier}, type: {identifier_type}", file=sys.stderr)
    sys.stderr.flush()

    label_info = openfda_client.fetch_drug_label_info(drug_identifier, identifier_type=identifier_type)

    shortage_search_term = drug_identifier
    if label_info and not label_info.get("error") and "openfda" in label_info:
        generic_names = label_info["openfda"].get("generic_name")
        if generic_names and isinstance(generic_names, list) and len(generic_names) > 0:
            shortage_search_term = generic_names[0]
            print(f"MCP Server Logic: Using generic name '{shortage_search_term}' for shortage lookup.", file=sys.stderr)
            sys.stderr.flush()

    shortage_info = openfda_client.fetch_drug_shortage_info(shortage_search_term)

    # --- Detailed Parsing of Label Info (Example - expand this) ---
    # You'll want to extract specific fields from label_info here
    # For example:
    parsed_label_info = {
        "brand_name": label_info.get("openfda", {}).get("brand_name", []),
        "generic_name": label_info.get("openfda", {}).get("generic_name", []),
        "manufacturer_name": label_info.get("openfda", {}).get("manufacturer_name", []),
        "indications_and_usage": label_info.get("indications_and_usage", ["Not parsed or not found"]),
        "adverse_reactions": label_info.get("adverse_reactions", ["Not parsed or not found"]),
        "warnings_and_cautions": label_info.get("warnings_and_cautions", ["Not parsed or not found"]),
        "dosage_and_administration": label_info.get("dosage_and_administration", ["Not parsed or not found"]),
        "patient_counseling_information": label_info.get("patient_counseling_information", ["Not parsed or not found"]),
        # Add more parsed fields as needed
    }
    if label_info.get("error"):
        parsed_label_info["error"] = label_info.get("error", "Unknown label API error")
    # --- End Detailed Parsing Example ---


    profile = {
        "drug_identifier_requested": drug_identifier,
        "identifier_type_used_for_label": identifier_type,
        "identifier_used_for_shortage_lookup": shortage_search_term,
        "label_information": parsed_label_info, # Use the parsed info
        "shortage_status": shortage_info,
        "data_sources": ["openFDA Drug Label API", "openFDA Drug Shortage API"]
    }

    if shortage_info.get("error"): # Check specifically for shortage error
        profile["shortage_status"]["error_details"] = shortage_info.get("error", "Unknown shortage API error")

    # Determine overall status
    has_label_error = "error" in parsed_label_info
    has_shortage_error = "error" in shortage_info or "error_details" in profile["shortage_status"]

    if has_label_error and has_shortage_error:
        profile["overall_status"] = "Failed to retrieve any information"
    elif has_label_error:
        profile["overall_status"] = "Retrieved shortage info, but failed to get label info"
    elif has_shortage_error:
        profile["overall_status"] = "Retrieved label info, but failed to get shortage info"
    elif not label_info or not label_info.get("openfda"): # Check if label_info itself is minimal/empty
        profile["overall_status"] = "Successfully queried APIs, but label data from openFDA was minimal or empty for the identifier."
    else:
        profile["overall_status"] = "Successfully retrieved available information"
    
    print(f"MCP Server Logic: Profile assembled for {drug_identifier}.", file=sys.stderr)
    sys.stderr.flush()
    return profile

# --- Define MCP Tool ---
# FastMCP uses Python type hints and this docstring to generate the MCP tool schema.
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
                         The drug shortage information is typically searched using the generic name.
    Returns:
        A dictionary containing structured medication information including label details
        and shortage status.
    """
    # The underlying logic is synchronous. For a production server with many
    # concurrent requests, you might use asyncio.to_thread or make
    # openfda_client.py fully async with a library like httpx.
    # For this example, direct call is simpler.
    # FastMCP will handle running this in a thread if it's synchronous.
    return get_medication_profile_logic(drug_identifier, identifier_type)

# --- Main Server Execution ---
if __name__ == "__main__":
    # When running as an MCP server with stdio transport,
    # avoid printing anything to stdout before mcp_app.run(),
    # as it can interfere with the MCP handshake.
    # Debug/startup logs should go to stderr if needed or a log file.
    # sys.stderr.write("Starting MCP Medication Information Server (stdio transport)...\n")
    # sys.stderr.write(f"Registered tools: {[tool.name for tool in mcp_app.model.tools]}\n") # This might still error if model isn't ready
    # sys.stderr.flush()
    
    mcp_app.run(transport='stdio')
