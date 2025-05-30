#!/usr/bin/env python3
"""
Test if MCP server can be reached by a client
"""

import subprocess
import json
import sys

def test_mcp_server():
    """Test if the MCP server responds correctly"""
    
    print("Testing MCP Server Connection")
    print("=" * 40)
    
    server_path = "/Users/adityadamerla/Documents/GitHub/med_info_mcp_project/enhanced_mcp_server.py"
    
    try:
        # Test if server starts without errors
        print("1. Testing server startup...")
        result = subprocess.run([
            "python3", server_path
        ], capture_output=True, text=True, timeout=5)
        
        if "Starting Enhanced MCP Medication Information Server" in result.stderr:
            print("   ✅ Server starts successfully")
        else:
            print("   ❌ Server startup failed")
            print(f"   Error: {result.stderr}")
            return False
            
    except subprocess.TimeoutExpired:
        print("   ✅ Server started (timeout expected for stdio server)")
    except Exception as e:
        print(f"   ❌ Server startup error: {e}")
        return False
    
    print("\n2. Testing config file...")
    config_path = "~/Library/Application Support/Claude/claude_desktop_config.json"
    expanded_path = config_path.replace("~", "/Users/adityadamerla")
    
    try:
        with open(expanded_path, 'r') as f:
            config = json.load(f)
            
        if "mcp_servers" in config:
            print("   ✅ Config file exists and has mcp_servers")
            
            # Check if our server is configured
            servers = config["mcp_servers"]
            our_server = None
            for server in servers:
                if server.get("name") == "EnhancedMedicationInformationService":
                    our_server = server
                    break
            
            if our_server:
                print("   ✅ EnhancedMedicationInformationService found in config")
                print(f"   Command: {our_server['transport']['command']}")
            else:
                print("   ❌ EnhancedMedicationInformationService NOT found in config")
                return False
        else:
            print("   ❌ Config file missing mcp_servers section")
            return False
            
    except FileNotFoundError:
        print(f"   ❌ Config file not found at {expanded_path}")
        print("   Create the config file in the correct location")
        return False
    except json.JSONDecodeError:
        print("   ❌ Config file has invalid JSON")
        return False
    except Exception as e:
        print(f"   ❌ Config file error: {e}")
        return False
    
    print("\n3. Testing dependencies...")
    try:
        import mcp.server.fastmcp
        print("   ✅ MCP SDK installed")
    except ImportError:
        print("   ❌ MCP SDK not installed - run: pip install mcp")
        return False
    
    try:
        import openfda_client
        print("   ✅ OpenFDA client available")
    except ImportError:
        print("   ❌ OpenFDA client not found - check file location")
        return False
    
    return True

def show_next_steps():
    """Show what to do next"""
    print("\n" + "=" * 50)
    print("🔧 NEXT STEPS:")
    print("=" * 50)
    
    print("\n1. Ensure Claude Desktop is installed and updated")
    print("2. Restart Claude Desktop after config changes")
    print("3. In Claude Desktop, try asking:")
    print('   "Get medication profile for lisinopril"')
    print("\n4. Look for signs that MCP is working:")
    print("   - Specific manufacturer names")
    print("   - OpenFDA API mentions")
    print("   - Detailed shortage data")
    
    print("\n5. If still not working, try:")
    print("   - Check Claude Desktop logs")
    print("   - Verify file permissions")
    print("   - Test with a simpler MCP server first")

if __name__ == "__main__":
    if test_mcp_server():
        print("\n🎉 MCP Server setup looks good!")
        print("Try asking Claude about drug information now.")
    else:
        print("\n❌ MCP Server setup has issues.")
        print("Fix the errors above before testing with Claude.")
    
    show_next_steps()