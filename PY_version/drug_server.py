#new mcp server for drug features
import os
from dotenv import load_dotenv
import sys
from typing import Dict, Any, List
import asyncio

# Add current directory to Python path to find our client module
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from mcp.server.fastmcp import FastMCP
import drug_features

load_dotenv()

mcp_app = FastMCP(
    name="DrugFeaturesService",
    version="1.0.0",
    description="MCP server for drug interactions, name conversion, and adverse events"
)

@mcp_app.tool()
async def check_drug_interactions(
    drug1: str,
    drug2: str,
    additional_drugs: List[str] = []
) -> Dict[str, Any]:
    """
    Check for potential drug interactions between medications using RxNav API
    
    Args:
        drug1: First medication name
        drug2: Second medication name  
        additional_drugs: Optional list of additional medications to check
    
    Returns:
        Dictionary containing interaction analysis results
    """
    loop = asyncio.get_event_loop()
    interaction_results = await loop.run_in_executor(
        None, 
        drug_features.check_drug_interactions, 
        drug1, 
        drug2, 
        additional_drugs
    )
    
    return {
        "interaction_analysis": interaction_results,
        "data_source": "RxNorm API (ingredient analysis)",
        "analysis_type": "Basic Drug Safety Check",
        "note": "Limited to ingredient comparison - consult pharmacist for comprehensive interaction checking"
    }

@mcp_app.tool()
async def convert_drug_names(
    drug_name: str,
    conversion_type: str = "both"  # "generic", "brand", "both"
) -> Dict[str, Any]:
    """
    Convert between generic and brand names using OpenFDA label data
    
    Args:
        drug_name: Name of the drug to convert
        conversion_type: Type of conversion - "generic", "brand", or "both"
    
    Returns:
        Dictionary containing name conversion results
    """
    loop = asyncio.get_event_loop()
    conversion_results = await loop.run_in_executor(
        None, 
        drug_features.convert_drug_names, 
        drug_name, 
        conversion_type
    )
    
    return {
        "name_conversion": conversion_results,
        "data_source": "openFDA Drug Label API",
        "analysis_type": "Drug Name Conversion",
        "note": "Uses existing FDA labeling data for name mapping"
    }

@mcp_app.tool()
async def get_adverse_events(
    drug_name: str,
    time_period: str = "1year",
    severity_filter: str = "all"  # "all", "serious"
) -> Dict[str, Any]:
    """
    Get FDA adverse event reports for a medication from FAERS database
    
    Args:
        drug_name: Name of the medication
        time_period: Time period for analysis (currently not implemented in API)
        severity_filter: Filter by severity - "all" or "serious" only
    
    Returns:
        Dictionary containing adverse event analysis results
    """
    loop = asyncio.get_event_loop()
    adverse_event_results = await loop.run_in_executor(
        None, 
        drug_features.get_adverse_events, 
        drug_name, 
        time_period, 
        severity_filter
    )
    
    return {
        "adverse_event_analysis": adverse_event_results,
        "data_source": "FDA FAERS (Adverse Event Reporting System)",
        "analysis_type": "Post-Market Safety Surveillance",
        "note": "Real-world adverse event data from healthcare providers and patients"
    }

if __name__ == "__main__":
    print("drug features server starting", file=sys.stderr)
    mcp_app.run(transport='stdio')