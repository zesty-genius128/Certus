#!/usr/bin/env python3
"""
Test script for the MCP Medication Information Server
Run this to test your server implementation before using it with MCP
"""

import os
import sys
import json
from dotenv import load_dotenv

# Add the parent directory to Python path (where the main modules are)
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, parent_dir)

# Load environment variables from parent directory
load_dotenv(os.path.join(parent_dir, '.env'))

try:
    # Import your modules
    import openfda_client
    from mcp_med_info_server import get_medication_profile_logic
    print("✓ Successfully imported modules")
except ImportError as e:
    print(f"✗ Import error: {e}")
    print(f"Current working directory: {os.getcwd()}")
    print(f"Python path: {sys.path}")
    print(f"Parent directory: {parent_dir}")
    print(f"Files in parent directory: {os.listdir(parent_dir)}")
    sys.exit(1)

def test_openfda_client():
    """Test the OpenFDA client functions directly"""
    print("=" * 60)
    print("TESTING OPENFDA CLIENT")
    print("=" * 60)
    
    # Test drugs
    test_drugs = ["lisinopril", "amoxicillin", "acetaminophen"]
    
    for drug in test_drugs:
        print(f"\n--- Testing {drug.upper()} ---")
        
        # Test label info
        print(f"1. Label Information:")
        label_data = openfda_client.fetch_drug_label_info(drug)
        if label_data.get("error"):
            print(f"   Error: {label_data['error']}")
        else:
            openfda_data = label_data.get("openfda", {})
            print(f"   Generic: {openfda_data.get('generic_name', ['N/A'])}")
            print(f"   Brand: {openfda_data.get('brand_name', ['N/A'])}")
            print(f"   Manufacturer: {openfda_data.get('manufacturer_name', ['N/A'])}")
        
        # Test shortage info
        print(f"2. Shortage Information:")
        shortage_data = openfda_client.fetch_drug_shortage_info(drug)
        if shortage_data.get("error"):
            print(f"   Error: {shortage_data['error']}")
        elif shortage_data.get("shortages"):
            print(f"   Found {len(shortage_data['shortages'])} shortage(s)")
            for shortage in shortage_data["shortages"]:
                print(f"   - {shortage['drug_name_reported']}: {shortage['status']}")
        else:
            print(f"   Status: {shortage_data.get('status', 'No shortage information')}")

def test_mcp_server_logic():
    """Test the MCP server logic functions"""
    print("\n" + "=" * 60)
    print("TESTING MCP SERVER LOGIC")
    print("=" * 60)
    
    test_drugs = ["lisinopril", "acetaminophen"]
    
    for drug in test_drugs:
        print(f"\n--- Testing MCP Logic for {drug.upper()} ---")
        
        try:
            profile = get_medication_profile_logic(drug, "openfda.generic_name")
            print(f"Overall Status: {profile['overall_status']}")
            print(f"Label Error: {'error' in profile['label_information']}")
            print(f"Shortage Data: {'shortages' in profile['shortage_status']}")
            
            if 'shortages' in profile['shortage_status']:
                print(f"Number of shortages: {len(profile['shortage_status']['shortages'])}")
            
        except Exception as e:
            print(f"Error testing {drug}: {e}")

def main():
    """Main test function"""
    print("MCP Medication Information Server - Test Suite")
    print(f"OpenFDA API Key: {'SET' if os.getenv('OPENFDA_API_KEY') else 'NOT SET'}")
    
    if not os.getenv('OPENFDA_API_KEY'):
        print("\nWARNING: No OpenFDA API key found!")
        print("Set OPENFDA_API_KEY in your .env file or environment variables")
        print("You can still test without an API key, but you'll have rate limits")
    
    try:
        test_openfda_client()
        test_mcp_server_logic()
        
        print("\n" + "=" * 60)
        print("TEST COMPLETE")
        print("=" * 60)
        print("If no major errors appeared above, your MCP server should work!")
        print("You can now test it with your MCP client.")
        
    except Exception as e:
        print(f"\nCRITICAL ERROR: {e}")
        print("Please fix the errors above before using the MCP server.")

if __name__ == "__main__":
    main()