# Certus

A production-ready Model Context Protocol (MCP) server for real-time, authoritative medical and medication information. Certus integrates with Claude Desktop and provides live access to FDA drug data, including shortages, recalls, and labeling, via openFDA APIs.

---

## Project Versions

This project supports both **Python** and **JavaScript** implementations of the MCP servers. You can use either version depending on your environment and preferences.

- **Python version:** in `PY_version/` (feature-complete)
- **JavaScript version:** in `JS_version/` (Node.js, feature parity for enhanced medication info)

---

## Quick Start

### 1. Clone the Repository

```bash
# Clone and enter the project directory
$ git clone <your_repository_url>
$ cd med_info_mcp_project
```

---

## Python Version Setup (`PY_version/`)

### Installation

```bash
cd PY_version
pip install -r ../requirements.txt
touch __init__.py
```

### Environment Setup (Optional)

Create a `.env` file for your OpenFDA API key (optional, improves rate limits):

```bash
OPENFDA_API_KEY=your_api_key_here
```
Get a free API key at: https://open.fda.gov/apis/authentication/

### Testing

Test RxNorm client:
```bash
python3 drug_features.py
```
Test OpenFDA client:
```bash
python3 openfda_client.py
```

### Claude Desktop Integration (Python)

Edit your Claude Desktop config file:

```json
{
  "mcpServers": {
    "enhanced-medication-info": {
      "command": "python3",
      "args": ["/full/path/to/PY_version/enhanced_mcp_server.py"]
    },
    "drug-features": {
      "command": "python3",
      "args": ["/full/path/to/PY_version/drug_server.py"]
    }
  }
}
```

---

## JavaScript Version Setup (`JS_version/`)

### Prerequisites
- Node.js v18 or higher

### Installation

```bash
cd JS_version
npm install
```

### Environment Setup (Optional)

Set your OpenFDA API key (optional, improves rate limits):

```bash
export OPENFDA_API_KEY="your_api_key_here"
```
Get a free API key at: https://open.fda.gov/apis/authentication/

### Testing

Run the test client:
```bash
npm test
# or
node test-client.js
```

### Claude Desktop Integration (JavaScript)

Edit your Claude Desktop config file:

```json
{
  "mcpServers": {
    "enhanced-medication-info": {
      "command": "node",
      "args": ["/full/path/to/JS_version/enhanced-mcp-server.js"],
      "env": {
        "OPENFDA_API_KEY": "your_openfda_api_key_here"
      }
    }
  }
}
```

---

## Features (Both Versions)

- **Comprehensive Drug Profiles**: FDA labeling, shortage status, manufacturer, and more
- **Real-Time Shortage Search**: Live shortage data from openFDA (1,900+ records)
- **Recall Information**: Current and historical drug recalls from FDA enforcement database
- **Label-Only Lookup**: Retrieve only FDA-approved drug labeling
- **Shortage Search Guidance**: Tips and strategies for finding shortage data
- **Market Trend Analysis**: Analyze shortage patterns and risk for a drug
- **Batch Analysis**: Assess shortages, recalls, and risk for up to 25 drugs at once

---

## Project Structure

```
med_info_mcp_project/
├── JS_version/                # JavaScript/Node.js implementation
│   ├── enhanced-mcp-server.js
│   ├── openfda-client.js
│   ├── package.json
│   ├── test-client.js
│   └── ...
├── PY_version/                # Python implementation
│   ├── enhanced_mcp_server.py
│   ├── drug_server.py
│   ├── drug_features.py
│   ├── ...
├── data/                      # Data files (e.g., images for testing)
├── requirements.txt           # Python dependencies
├── README.md                  # This file
└── ...
```

---

## API Endpoints & Tools

All endpoints are exposed as MCP tools and callable via Claude Desktop or programmatically. Below is a summary of each endpoint for both Python and JavaScript versions:

### Enhanced Medication Info MCP Server

| Tool Name                  | Description                                      | Parameters                                                                 | Sample Request/Response |
|----------------------------|--------------------------------------------------|---------------------------------------------------------------------------|------------------------|
| `get_medication_profile`   | Full drug profile (label + shortage)             | `drug_identifier` (str, required), `identifier_type` (str, default: openfda.generic_name) | `{ "drug_identifier_requested": "lisinopril", ... }` |
| `search_drug_shortages`    | Search for drug shortages                        | `search_term` (str, required), `limit` (int, default: 10)                 | `{ "search_term": "amoxicillin", "shortage_data": {...} }` |
| `search_drug_recalls`      | Search for drug recalls                          | `search_term` (str, required), `limit` (int, default: 10)                 | `{ "search_term": "acetaminophen", "recall_data": {...} }` |
| `get_drug_label_only`      | FDA label info only                              | `drug_identifier` (str, required), `identifier_type` (str, default: openfda.generic_name) | `{ "drug_identifier": "lisinopril", "label_data": {...} }` |
| `get_shortage_search_guidance` | Guidance for finding shortage info           | `drug_name` (str, required)                                               | `{ "drug_name": "clindamycin", "additional_search_strategies": {...} }` |
| `analyze_drug_market_trends` | Analyze shortage/market trends                 | `drug_name` (str, required), `months_back` (int, default: 12)             | `{ "drug_analyzed": "amoxicillin", "trend_data": {...} }` |
| `batch_drug_analysis`      | Batch analysis for multiple drugs                | `drug_list` (list of str, max 25), `include_trends` (bool, default: False) | `{ "batch_analysis": {...} }` |

### Drug Features MCP Server (Python only)

| Tool Name                | Description                                 | Parameters                                                                 | Sample Response |
|--------------------------|---------------------------------------------|----------------------------------------------------------------------------|-----------------|
| `check_drug_interactions`| Check for potential drug interactions       | `drug1` (str, required), `drug2` (str, required), `additional_drugs` (list, optional)          | `{ "interaction_analysis": {...} }` |
| `convert_drug_names`     | Convert between generic and brand names     | `drug_name` (str, required), `conversion_type` (str: "generic", "brand", "both", default: "both")     | `{ "name_conversion": {...} }` |
| `get_adverse_events`     | Get FDA adverse event reports (FAERS)       | `drug_name` (str, required), `time_period` (str, default "1year"), `severity_filter` (str, default "all") | `{ "adverse_event_analysis": {...} }` |

---

## Data Sources & API Documentation

- **openFDA Drug Label API** ([docs](https://open.fda.gov/apis/drug/label/))  
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

## Troubleshooting & FAQ

- **MCP not working in Claude Desktop?**
  1. Double-check your config file paths and commands
  2. Ensure dependencies are installed (`pip install -r requirements.txt` or `npm install`)
  3. Restart Claude Desktop
- **API key issues?** Add your key to `.env` (Python) or as an env variable (JS) for higher rate limits
- **Wrong Claude version?** Use Claude Desktop, not claude.ai web
- **Permissions?** Ensure server files are executable

---

## Dependencies

- **Python:** See `requirements.txt`
- **JavaScript:** See `JS_version/package.json`

---

## License

This project provides access to public FDA data through openFDA APIs. Always consult healthcare providers for medical decisions.

---

## Contributing

Contributions are welcome! Please open issues or pull requests for improvements or bug fixes.
