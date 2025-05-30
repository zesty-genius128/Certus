# Enhanced Medication Information MCP Server

This project provides a **comprehensive medication information server** using the Model Context Protocol (MCP) for integration with **Claude Desktop**. It provides real-time access to FDA drug data, including current shortage information, drug labeling, and recall data through the openFDA APIs.

## Features

The server exposes powerful tools that allow Claude to access authoritative drug information:

- **`get_medication_profile`**: Complete drug information including FDA labeling and current shortage status
- **`search_drug_shortages`**: Real-time drug shortage search using openFDA's 1,912+ shortage records  
- **`search_drug_recalls`**: Current drug recall and enforcement information
- **`get_drug_label_only`**: FDA-approved drug labeling information
- **`get_shortage_search_guidance`**: Comprehensive guidance for finding shortage information

## Real Data Sources

- **✅ FDA Drug Labels**: Complete prescribing information, warnings, dosing
- **✅ Drug Shortages**: Live data from `https://api.fda.gov/drug/shortages.json` 
- **✅ Drug Recalls**: Enforcement actions from FDA database
- **✅ 1,912+ Shortage Records**: Current and historical shortage data

## Quick Start

### 1. Installation

```bash
git clone <your_repository_url>
cd med_info_mcp_project

# Install dependencies
pip install -r requirements.txt
```

### 2. Environment Setup (Optional)

Create a `.env` file for your OpenFDA API key (improves rate limits):

```bash
# .env
OPENFDA_API_KEY=your_api_key_here
```

Get a free API key at: https://open.fda.gov/apis/authentication/

### 3. Test the Server

```bash
# Test all functionality
python3 test_server.py

# Test specific components
python3 openfda_client.py
```

### 4. Claude Desktop Integration

**Configure Claude Desktop:**

```bash
# Find/create Claude Desktop config
python3 find_claude_config.py
```

This creates the proper config file at `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "enhanced-medication-info": {
      "command": "python3",
      "args": ["/path/to/your/enhanced_mcp_server.py"],
      "env": {
        "PYTHONPATH": "/path/to/your/med_info_mcp_project"
      }
    }
  }
}
```

**Restart Claude Desktop** and test with:
- *"Get medication profile for lisinopril"*
- *"Search for amoxicillin shortages"*
- *"Are there any current drug recalls?"*

## Usage Examples

### Example 1: Drug Profile
**Query:** "Get medication profile for lisinopril"

**Response:** Complete FDA information + shortage status
- ✅ No current shortages found
- 📋 Manufacturer: ST. MARY'S MEDICAL PARK PHARMACY  
- 💊 Generic name: LISINOPRIL AND HYDROCHLOROTHIAZIDE TABLETS

### Example 2: Shortage Search
**Query:** "Search for amoxicillin shortages"

**Response:** Real shortage data
- 🚨 Found 20 shortage records
- 📊 Status: Mix of Current/Resolved
- 🏢 Companies: Aurobindo Pharma USA, others
- 📅 Updated: Recent dates

### Example 3: Recall Information  
**Query:** "Search for drug recalls"

**Response:** Current FDA enforcement actions
- 📋 Product descriptions
- ⚠️ Recall reasons
- 🏭 Recalling firms
- 📊 Classification levels

## Project Structure

```
med_info_mcp_project/
├── data/                       # Data files (e.g., images for testing)
├── tests/                      # Unit and integration tests
│   ├── api_test.py             # OCR Pipeline and OpenAI/Gemini API testing
│   ├── test_mcp_connection.py  # MCP connection tests
│   ├── test_server.py          # Comprehensive server tests
│   └── test_shortage.py        # Specific shortage endpoint tests
├── __init__.py                 # Allows directory to be treated as a package
├── .env                        # Environment variables template
├── .gitignore                  # Specifies intentionally untracked files
├── endpoint_test.py            # OpenFDA endpoint tests
├── enhanced_mcp_server.py      # Main MCP server (production)
├── find_claude_config.py       # Claude Desktop setup helper
├── mcp_med_info_server.py      # Alternative MCP server (if applicable)
├── openfda_client.py           # OpenFDA API client
├── requirements.txt            # Python dependencies
└── README.md                   # This file
```

## API Endpoints Used

- **Labels**: `https://api.fda.gov/drug/label.json` ✅ Working
- **Shortages**: `https://api.fda.gov/drug/shortages.json` ✅ Working  
- **Recalls**: `https://api.fda.gov/drug/enforcement.json` ✅ Working

## Testing

### Run All Tests
```bash
python3 test_server.py
```

### Test Individual Components
```bash
# Test OpenFDA client
python3 openfda_client.py

# Test MCP connection
python3 test_mcp_connection.py

# Test endpoint discovery
python3 endpoint_test.py
```

### Verify Working Data
The tests demonstrate:
- ✅ **Lisinopril**: No current shortages (answers the original question!)
- ✅ **Amoxicillin**: 20 shortage records found
- ✅ **Clindamycin**: Current shortages with detailed information
- ✅ **Acetaminophen**: No current shortages

## Troubleshooting

### MCP Not Working in Claude Desktop?

1. **Verify setup:**
   ```bash
   python3 find_claude_config.py
   ```

2. **Check server works:**
   ```bash
   python3 test_server.py
   ```

3. **Restart Claude Desktop completely**

4. **Look for these signs MCP is working:**
   - Specific manufacturer names
   - "openFDA API" mentions  
   - Real shortage data with dates
   - Structured, detailed responses

### Common Issues

- **Wrong Claude version**: Use Claude Desktop, not claude.ai web
- **Config location**: Run `find_claude_config.py` to fix
- **Server already running**: Don't run server manually, let Claude start it
- **Permissions**: Ensure server file is executable

## Dependencies

```txt
mcp>=1.0.0
fastmcp>=0.1.0
python-dotenv>=1.0.0
requests>=2.31.0
```

## License

This project provides access to public FDA data through openFDA APIs. Always consult healthcare providers for medical decisions.

## Success Metrics

✅ **1,912+ shortage records** accessible  
✅ **Real-time FDA data** integration  
✅ **Complete drug profiles** with labeling + shortage status  
✅ **Production-ready** MCP server  
✅ **Answers original question**: No lisinopril shortages found  

## Contributing

This server successfully integrates multiple FDA data sources and provides comprehensive medication information. The implementation demonstrates working OpenFDA API integration with proper error handling and real-time data access.
