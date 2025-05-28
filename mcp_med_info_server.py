# mcp_med_info_server.py
import os
from dotenv import load_dotenv
import json # For pretty printing if needed

# Import from the MCP SDK
from model_context_protocol import protocol, server, tools

# Import your openFDA client functions
import openfda_client # Assuming openfda_client.py is in the same directory

# Load environment variables from .env file
load_dotenv()

# --- Your Core Logic Function (will become an MCP Tool) ---
def get_medication_profile_logic(drug_identifier: str, identifier_type: str = "openfda.generic_name.exact") -> dict:
    """
    Fetches and combines drug label and shortage information.
    This is the core logic that your MCP tool will wrap.
    """
    print(f"MCP Server: Received request for drug: {drug_identifier}, type: {identifier_type}")

    # 1. Fetch Label Information
    # Using 'openfda.generic_name.exact' for label, 'generic_name' for shortage
    # You might want to make identifier_type consistent or map it
    label_id_type = identifier_type # Example, adjust as needed
    if identifier_type == "generic_name": # Common for shortage, adjust for label
        label_id_type = "openfda.generic_name.exact"

    label_info = openfda_client.fetch_drug_label_info(drug_identifier, identifier_type=label_id_type)

    # 2. Fetch Shortage Information
    # Shortage API might work better with just generic name
    shortage_info = openfda_client.fetch_drug_shortage_info(drug_identifier, identifier_type="generic_name") # Simplified for shortage

    # 3. Combine and Structure the Results
    # This is where you'll do more detailed parsing of label_info
    # For now, a simple combination:
    profile = {
        "drug_identifier": drug_identifier,
        "label_information": {
            "brand_name": label_info.get("openfda", {}).get("brand_name", []),
            "generic_name": label_info.get("openfda", {}).get("generic_name", []),
            "manufacturer_name": label_info.get("openfda", {}).get("manufacturer_name", []),
            "indications_and_usage": label_info.get("indications_and_usage", ["Not found"]),
            "adverse_reactions": label_info.get("adverse_reactions", ["Not found"]),
            # Add more fields here by parsing label_info
        },
        "shortage_status": shortage_info,
        "data_sources": ["openFDA Drug Label API", "openFDA Drug Shortage API"]
    }
    # Handle errors from the client functions
    if label_info.get("error"):
        profile["label_information"]["error"] = label_info["error"]
    if shortage_info.get("error"):
        profile["shortage_status"]["error"] = shortage_info["error"]

    return profile

# --- Define MCP Tools ---
# The MCP SDK uses classes to group tools.
class MedicationInfoTools(tools.Tools):
    @tools.Tool.from_function(
        name="get_medication_profile", # Name for clients to call
        description=(
            "Retrieves comprehensive information about a medication, "
            "including labeling details and current shortage status. "
            "Use 'openfda.generic_name.exact' or 'openfda.brand_name.exact' for identifier_type for best label results."
        ),
        # Define input parameters for MCP
        parameters=[
            protocol.ToolParameter(
                name="drug_identifier",
                description="The name (generic or brand) or other identifier of the drug.",
                type=protocol.PrimitiveType.STRING,
            ),
            protocol.ToolParameter(
                name="identifier_type",
                description=(
                    "The type of identifier being provided for querying drug labels (e.g., "
                    "'openfda.generic_name.exact', 'openfda.brand_name.exact', 'product_ndc'). "
                    "Defaults to 'openfda.generic_name.exact'."
                ),
                type=protocol.PrimitiveType.STRING,
                optional=True # Make it optional, default handled in logic
            )
        ],
        # Define what the tool returns for MCP
        returns=protocol.ToolParameter(
            name="medication_profile",
            description="A structured dictionary containing comprehensive medication information.",
            type=protocol.PrimitiveType.OBJECT # Assuming you return a dictionary/JSON
        )
    )
    async def get_medication_profile(self, drug_identifier: str, identifier_type: str = "openfda.generic_name.exact") -> dict:
        # MCP tools are often async, but our underlying logic is synchronous.
        # For simplicity now, we run synchronous code. For production, you might use
        # asyncio.to_thread for blocking calls if the MCP server framework requires true async.
        return get_medication_profile_logic(drug_identifier, identifier_type)

# --- Main Server Execution ---
if __name__ == "__main__":
    print("Starting MCP Medication Information Server...")
    print("This server will listen for requests on stdin/stdout.")
    print("To test, you'll typically use an MCP client (e.g., from the mcp-python-sdk examples or another MCP app).")

    # Create an instance of your tools
    med_tools = MedicationInfoTools()

    # Run the server (listens on stdin/stdout by default for simple local testing)
    # The MCP SDK handles the communication protocol.
    server.run_stdio_server(med_tools)

    # For a real deployment, you might use other transports like HTTP SSE,
    # which would involve different server setup from the MCP SDK.
    # Example (conceptual, SDK might vary):
    # server.run_http_sse_server(med_tools, host="localhost", port=8080)