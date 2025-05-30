# mcp_med_info_server.py (with a dummy tool for testing)
import os
from dotenv import load_dotenv
from typing import Dict, Any # For type hints

# MCP SDK imports
from mcp.server.fastmcp import FastMCP
# import openfda_client # Comment out for this test

load_dotenv()

mcp_app = FastMCP(
    name="MedicationInformationServiceTest",
    description="An MCP server with a dummy tool for testing stdio communication."
)

# --- Dummy Tool ---
@mcp_app.tool()
async def simple_test_tool(input_text: str) -> Dict[str, str]:
    """
    A simple test tool that echoes the input.
    Args:
        input_text: Some text to echo.
    Returns:
        A dictionary with the echoed text.
    """
    print(f"MCP Server (Dummy Tool): Received '{input_text}'")
    return {"status": "success", "echo": input_text, "message": "Dummy tool executed!"}

# --- Original Tool (Commented out for this test) ---
# def get_medication_profile_logic(drug_identifier: str, identifier_type: str = "openfda.generic_name") -> Dict[str, Any]:
#     # ... (your original logic using openfda_client) ...
#     pass # Placeholder

# @mcp_app.tool()
# async def get_medication_profile(
#     drug_identifier: str,
#     identifier_type: str = "openfda.generic_name"
# ) -> Dict[str, Any]:
#     """
#     Retrieves comprehensive information about a medication from openFDA...
#     """
#     return get_medication_profile_logic(drug_identifier, identifier_type)

if __name__ == "__main__":
    # IMPORTANT: Keep this silent for stdio transport
    # print("Starting MCP Medication Information Server (Dummy Test)...")
    # print("Registered tools: simple_test_tool (expected)")
    mcp_app.run(transport='stdio')
