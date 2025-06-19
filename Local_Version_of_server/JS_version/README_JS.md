# Enhanced Medication Information MCP Server (JavaScript)

A Model Context Protocol (MCP) server providing comprehensive medication information using the OpenFDA API, converted from Python to JavaScript.

## Features

- **Drug Label Information**: Get comprehensive FDA label data including indications, contraindications, and dosing
- **Shortage Monitoring**: Check current and historical drug shortages
- **Recall Information**: Search for drug recalls and safety alerts
- **Market Trend Analysis**: Analyze shortage patterns and supply chain risks
- **Batch Analysis**: Analyze multiple drugs simultaneously for formulary management

## Installation

1. **Install Node.js** (version 18 or higher)

2. **Clone/Download the files** to your project directory

3. **Install dependencies**:
   ```bash
   npm install
   ```

4. **Set up your OpenFDA API Key** (optional but recommended):
   ```bash
   export OPENFDA_API_KEY="your_api_key_here"
   ```
   Get your free API key at: https://open.fda.gov/apis/authentication/

## Testing the Installation

Run the test script to verify everything works:

```bash
npm test
# or
node test-client.js
```

## Configuration for Claude Desktop

Update your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "enhanced-medication-info": {
      "command": "node",
      "args": ["/full/path/to/your/enhanced-mcp-server.js"],
      "env": {
        "OPENFDA_API_KEY": "your_openfda_api_key_here"
      }
    }
  }
}
```

**Important**: Use the full absolute path to your `enhanced-mcp-server.js` file.

## Available Tools

### 1. `get_medication_profile`
Get complete drug information including label and shortage status.

**Parameters**:
- `drug_identifier`: Drug name to search for
- `identifier_type`: Search field type (default: "openfda.generic_name")

### 2. `search_drug_shortages`
Search for current drug shortages.

**Parameters**:
- `search_term`: Drug name to search for shortages
- `limit`: Maximum results (default: 10)

### 3. `get_shortage_search_guidance`
Get search tips and alternative sources for shortage information.

**Parameters**:
- `drug_name`: Drug name to get guidance for

### 4. `search_drug_recalls`
Search for drug recalls and safety alerts.

**Parameters**:
- `search_term`: Drug name to search for recalls
- `limit`: Maximum results (default: 10)

### 5. `get_drug_label_only`
Get only FDA label information (faster than full profile).

**Parameters**:
- `drug_identifier`: Drug name to search for
- `identifier_type`: Search field type (default: "openfda.generic_name")

### 6. `analyze_drug_market_trends`
Analyze shortage patterns and market trends.

**Parameters**:
- `drug_name`: Drug name to analyze
- `months_back`: Analysis period in months (default: 12)

### 7. `batch_drug_analysis`
Analyze multiple drugs for formulary risk assessment.

**Parameters**:
- `drug_list`: Array of drug names to analyze (max 25)
- `include_trends`: Include trend analysis (default: false)

## File Structure

```
your-project/
├── enhanced-mcp-server.js     # Main MCP server
├── openfda-client.js          # OpenFDA API client functions
├── package.json               # Node.js dependencies
├── test-client.js             # Test script
└── README.md                  # This file
```

## Key Differences from Python Version

- **ES Modules**: Uses modern JavaScript module syntax (`import`/`export`)
- **Native Fetch**: Uses built-in `fetch()` instead of `requests` library
- **Async/Await**: Direct async functions instead of `run_in_executor`
- **MCP SDK**: Uses `@modelcontextprotocol/sdk` instead of FastMCP
- **Error Handling**: JavaScript-style error handling and promises

## Troubleshooting

### "Module not found" errors
- Ensure you've run `npm install`
- Check that you're using Node.js 18 or higher

### "Permission denied" errors
- Make sure the script file is executable: `chmod +x enhanced-mcp-server.js`
- Use full absolute paths in Claude Desktop config

### API rate limiting
- The client includes built-in rate limiting
- Consider getting an OpenFDA API key for higher limits

### No data returned
- Verify your internet connection
- Try different search terms (generic names often work better)
- Check the OpenFDA service status

## Development

To run the server in development mode with debugging:

```bash
npm run dev
```

This starts the server with Node.js debugging enabled.

## API Rate Limits

- **Without API Key**: 240 requests per minute, 1000 per hour
- **With API Key**: 1000 requests per minute, 1000 per hour

The client automatically handles rate limiting to stay within these limits.

## Data Sources

- **Drug Labels**: OpenFDA Drug Label API
- **Shortages**: OpenFDA Drug Shortages API  
- **Recalls**: OpenFDA Drug Enforcement API

All data comes from official FDA sources and is updated regularly.

## Next Steps

This completes the conversion of the enhanced medication server. Next, we can convert the drug features server (`drug_features.py` and `drug_server.py`) which handles:

- Drug interaction checking via RxNorm API
- Generic/brand name conversion
- Adverse event analysis from FAERS database

Let me know when you're ready to tackle those files!