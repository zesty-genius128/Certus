# Certus

A production-ready Model Context Protocol (MCP) server for real-time, authoritative medical and medication information. Certus integrates with Claude Desktop and provides live access to FDA drug data, including shortages, recalls, and labeling, via openFDA APIs.

---

## Features

- **Comprehensive Drug Profiles**: FDA labeling, shortage status, manufacturer, and more
- **Real-Time Shortage Search**: Live shortage data from openFDA (1,900+ records)
- **Recall Information**: Current and historical drug recalls from FDA enforcement database
- **Label-Only Lookup**: Retrieve only FDA-approved drug labeling
- **Shortage Search Guidance**: Tips and strategies for finding shortage data
- **Market Trend Analysis**: Analyze shortage patterns and risk for a drug
- **Batch Analysis**: Assess shortages, recalls, and risk for up to 25 drugs at once

---

## API Endpoints

All endpoints are exposed as MCP tools and callable via Claude Desktop or programmatically. Below is a summary of each endpoint:

### Medication Info MCP Server (`enhanced_mcp_server.py`)

| Tool Name                  | Description                                      | Parameters                                                                 | Sample Request & Response |
|----------------------------|--------------------------------------------------|---------------------------------------------------------------------------|--------------------------|
| `get_medication_profile`   | Full drug profile (label + shortage)             | `drug_identifier` (str, required), `identifier_type` (str, default: openfda.generic_name) | `{ "drug_identifier_requested": "lisinopril", ... }` |
| `search_drug_shortages`    | Search for drug shortages                        | `search_term` (str, required), `limit` (int, default: 10)                 | `{ "search_term": "amoxicillin", "shortage_data": {...} }` |
| `search_drug_recalls`      | Search for drug recalls                          | `search_term` (str, required), `limit` (int, default: 10)                 | `{ "search_term": "acetaminophen", "recall_data": {...} }` |
| `get_drug_label_only`      | FDA label info only                              | `drug_identifier` (str, required), `identifier_type` (str, default: openfda.generic_name) | `{ "drug_identifier": "lisinopril", "label_data": {...} }` |
| `get_shortage_search_guidance` | Guidance for finding shortage info           | `drug_name` (str, required)                                               | `{ "drug_name": "clindamycin", "additional_search_strategies": {...} }` |
| `analyze_drug_market_trends` | Analyze shortage/market trends                 | `drug_name` (str, required), `months_back` (int, default: 12)             | `{ "drug_analyzed": "amoxicillin", "trend_data": {...} }` |
| `batch_drug_analysis`      | Batch analysis for multiple drugs                | `drug_list` (list of str, max 25), `include_trends` (bool, default: False) | `{ "batch_analysis": {...} }` |

### Drug Features MCP Server (`drug_server.py`)

| Tool Name                | Description                                 | Parameters                                                                 | Sample Response |
|--------------------------|---------------------------------------------|----------------------------------------------------------------------------|-----------------|
| `check_drug_interactions`| Check for potential drug interactions       | `drug1` (str, required), `drug2` (str, required), `additional_drugs` (list, optional)          | `{ "interaction_analysis": {...} }` |
| `convert_drug_names`     | Convert between generic and brand names     | `drug_name` (str, required), `conversion_type` (str: "generic", "brand", "both", default: "both")     | `{ "name_conversion": {...} }` |
| `get_adverse_events`     | Get FDA adverse event reports (FAERS)       | `drug_name` (str, required), `time_period` (str, default "1year"), `severity_filter` (str, default "all") | `{ "adverse_event_analysis": {...} }` |

---

## API Documentation & Data Sources

- **openFDA Drug Label API** ([docs](https://open.fda.gov/apis/drug/druglabel/))  
  Endpoint: [`https://api.fda.gov/drug/label.json`](https://api.fda.gov/drug/label.json)
- **openFDA Drug Shortages API** ([docs](https://open.fda.gov/apis/drug/drugshortages/))  
  Endpoint: [`https://api.fda.gov/drug/shortages.json`](https://api.fda.gov/drug/shortages.json)
- **openFDA Drug Enforcement/Recalls API** ([docs](https://open.fda.gov/apis/drug/enforcement/))  
  Endpoint: [`https://api.fda.gov/drug/enforcement.json`](https://api.fda.gov/drug/enforcement.json)
- **openFDA FAERS (Adverse Events) API** ([docs](https://open.fda.gov/apis/drug/event/))  
  Endpoint: [`https://api.fda.gov/drug/event.json`](https://api.fda.gov/drug/event.json)
- **RxNorm API** ([docs](https://lhncbc.nlm.nih.gov/RxNav/APIs/))  
  Endpoint: [`https://rxnav.nlm.nih.gov/REST`](https://rxnav.nlm.nih.gov/REST)

---

## Quick Start

### 1. Installation

```bash
git clone <your_repository_url>
cd med_info_mcp_project
pip install -r requirements.txt
```

### 2. Environment Setup (Optional)

Create a `.env` file for your OpenFDA API key ***(this is not necessary but doing so may improve your rate limits if you run into that error)***:
```bash
OPENFDA_API_KEY=your_api_key_here
```
Get a free API key at: https://open.fda.gov/apis/authentication/
- Run this command :
```bash
touch __init__.py
```

### 3. Testing

Test RxNorm client:
```bash
python3 drug_features.py
```
Test OpenFDA client:
```bash
python3 openfda_client.py
```

### 4. Claude Desktop Integration

Edit the Claude Desktop config file:
- **In your Claude Desktop App settings, click on the developer option, then click on the Edit Config button.**
- **Add the following lines into the config file and save it.**
```json
{
  "mcpServers": {
    "enhanced-medication-info": {
      "command": "python3",
      "args": ["/path/to/your/enhanced_mcp_server.py"]
    },
    "drug-features": {
      "command": "python3",
      "args": ["/path/to/your/drug_server.py"]
    }
  }
}
```
Restart Claude Desktop and test with queries like:
- "Get medication profile for lisinopril"
- "Search for amoxicillin shortages"
- "Are there any current drug recalls?"

---

## Usage Examples

### Example: Drug Profile
**Query:** "Get medication profile for lisinopril"
**Response:**
```json
{
  "drug_identifier_requested": "lisinopril",
  "label_information": { ... },
  "shortage_information": { ... },
  "overall_status": "SUCCESS: Retrieved complete drug profile - no current shortages found"
}
```

### Example: Shortage Search
**Query:** "Search for amoxicillin shortages"
**Response:**
```json
{
  "search_term": "amoxicillin",
  "shortage_data": { ... }
}
```

### Example: Recall Information
**Query:** "Search for drug recalls"
**Response:**
```json
{
  "search_term": "acetaminophen",
  "recall_data": { ... }
}
```

---

## Project Structure

```
med_info_mcp_project/
├── data/                       # Data files (e.g., images for testing)
├── tests/                      # Unit and integration tests
├── __init__.py                 # Package marker
├── endpoint_test.py            # OpenFDA endpoint tests
├── enhanced_mcp_server.py      # Main MCP server
├── find_claude_config.py       # Claude Desktop setup helper
├── mcp_med_info_server.py      # Alternative MCP server
├── openfda_client.py           # OpenFDA API client
├── requirements.txt            # Python dependencies
└── README.md                   # This file
```

---

## Troubleshooting & FAQ

- **MCP not working in Claude Desktop?**
  1. Run `python3 find_claude_config.py` to fix config
  2. Run `python3 test_server.py` to verify server
  3. Restart Claude Desktop
  4. Look for real FDA data, manufacturer names, and structured responses
- **Wrong Claude version?** Use Claude Desktop, not claude.ai web
- **Permissions?** Ensure server file is executable
- **API key issues?** Add your key to `.env` for higher rate limits

---

## Dependencies

- mcp>=1.0.0
- fastmcp>=0.1.0
- python-dotenv>=1.0.0
- requests>=2.31.0
- (see `requirements.txt` for full list)

---

## License

This project provides access to public FDA data through openFDA APIs. Always consult healthcare providers for medical decisions.

---

## Contributing

Contributions are welcome! Please open issues or pull requests for improvements or bug fixes.
