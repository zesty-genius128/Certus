#!/usr/bin/env python3
"""
Find the correct Claude Desktop config location and verify it
"""

import os
import json
from pathlib import Path

def find_claude_config():
    """Find all possible Claude Desktop config locations"""
    
    print("🔍 Searching for Claude Desktop Config Locations")
    print("=" * 50)
    
    # Possible config locations for Claude Desktop
    possible_locations = [
        "~/Library/Application Support/Claude/claude_desktop_config.json",
        "~/.config/claude/claude_desktop_config.json", 
        "~/Library/Preferences/claude_desktop_config.json",
        "~/.claude/claude_desktop_config.json",
        "~/claude_desktop_config.json"
    ]
    
    found_configs = []
    
    for location in possible_locations:
        expanded_path = os.path.expanduser(location)
        if os.path.exists(expanded_path):
            found_configs.append(expanded_path)
            print(f"Found config: {expanded_path}")
            
            # Check if it has our server
            try:
                with open(expanded_path, 'r') as f:
                    config = json.load(f)
                
                if "mcp_servers" in config:
                    servers = config["mcp_servers"]
                    our_server = any(s.get("name") == "EnhancedMedicationInformationService" for s in servers)
                    if our_server:
                        print(f"   Contains our MCP server")
                    else:
                        print(f"   Missing our MCP server")
                else:
                    print(f"   No mcp_servers section")
                    
            except Exception as e:
                print(f"   Error reading config: {e}")
        else:
            print(f"Not found: {location}")
    
    if not found_configs:
        print("\nNo Claude Desktop config files found!")
        print("Let's create one in the standard location...")
        return create_config()
    
    return found_configs

def create_config():
    """Create a proper config file"""
    
    config_dir = os.path.expanduser("~/Library/Application Support/Claude")
    config_path = os.path.join(config_dir, "claude_desktop_config.json")
    
    print(f"\n📝 Creating config at: {config_path}")
    
    # Create directory if it doesn't exist
    os.makedirs(config_dir, exist_ok=True)
    
    config = {
  "mcpServers": {
    "enhanced-medication-info": {
      "command": "python3",
      "args": ["/path/to/your/enhanced_mcp_server.py"]
    }
  }
}
    
    try:
        with open(config_path, 'w') as f:
            json.dump(config, f, indent=2)
        print("Config file created!")
        print("🔄 Restart Claude Desktop now!")
        return [config_path]
    except Exception as e:
        print(f"Error creating config: {e}")
        return []

def check_claude_desktop_version():
    """Check if Claude Desktop supports MCP"""
    
    print(f"\n🔍 Checking Claude Desktop Installation")
    print("=" * 40)
    
    app_path = "/Applications/Claude.app"
    if os.path.exists(app_path):
        print("Claude Desktop is installed")
        
        # Try to get version info
        try:
            import subprocess
            result = subprocess.run([
                "/Applications/Claude.app/Contents/MacOS/Claude", "--version"
            ], capture_output=True, text=True, timeout=5)
            
            if result.stdout:
                print(f"Version info: {result.stdout.strip()}")
            else:
                print("Version info not available via CLI")
                
        except Exception:
            print("Could not get version info")
            
        print("💡 Make sure you have the latest version that supports MCP")
        print("💡 MCP support was added in recent versions")
        
    else:
        print("Claude Desktop not found at /Applications/Claude.app")
        print("Download from: https://claude.ai/download")

def test_permissions():
    """Test if there are permission issues"""
    
    print(f"\nTesting Permissions")
    print("=" * 30)
    
    server_path = "/Users/adityadamerla/Documents/GitHub/med_info_mcp_project/enhanced_mcp_server.py"
    
    if os.path.exists(server_path):
        if os.access(server_path, os.R_OK):
            print("Server file is readable")
        else:
            print("Server file is not readable")
            
        if os.access(server_path, os.X_OK):
            print("Server file is executable")
        else:
            print("Server file is not executable")
            print("Fix with: chmod +x enhanced_mcp_server.py")
    else:
        print(f"Server file not found: {server_path}")

if __name__ == "__main__":
    configs = find_claude_config()
    check_claude_desktop_version()
    test_permissions()
    
    print(f"\n" + "=" * 50)
    print("🔧 TROUBLESHOOTING SUMMARY")
    print("=" * 50)
    
    if configs:
        print("Config file(s) found")
        print("1. Completely quit Claude Desktop")
        print("2. Restart Claude Desktop") 
        print("3. Try asking: 'Get medication profile for lisinopril'")
        print("4. Look for MCP tool usage indicators")
    else:
        print(" No config files found - created one")
        print("1. Restart Claude Desktop")
        print("2. Test again")
    
    print(f"\n If still not working:")
    print("- Check Claude Desktop logs/console")
    print("- Verify Claude Desktop version supports MCP")
    print("- Try a simpler MCP server first")
    print("- Check Anthropic's MCP documentation")