#!/usr/bin/env python3
"""
Test the working OpenFDA drug shortages endpoint
https://api.fda.gov/drug/shortages.json
"""

import requests
import json
import os
from dotenv import load_dotenv

load_dotenv()

DRUG_SHORTAGES_ENDPOINT = "https://api.fda.gov/drug/shortages.json"
OPENFDA_API_KEY = os.environ.get("OPENFDA_API_KEY")

def test_working_endpoint():
    """Test the working shortages endpoint"""
    
    print("Testing the WORKING OpenFDA Drug Shortages Endpoint")
    print("=" * 60)
    print(f"Endpoint: {DRUG_SHORTAGES_ENDPOINT}")
    print()
    
    # Test basic query first
    print("1. Basic query - get one shortage record")
    print("-" * 40)
    
    params = {"limit": 1}
    if OPENFDA_API_KEY:
        params['api_key'] = OPENFDA_API_KEY
    
    try:
        response = requests.get(DRUG_SHORTAGES_ENDPOINT, params=params, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            print("✅ SUCCESS! Endpoint is working!")
            
            # Explore the data structure
            if 'results' in data and len(data['results']) > 0:
                first_result = data['results'][0]
                print(f"\nAvailable fields in shortage records:")
                for field in sorted(first_result.keys()):
                    value = first_result[field]
                    if isinstance(value, str) and len(value) > 100:
                        value = value[:100] + "..."
                    elif isinstance(value, list) and len(value) > 0:
                        value = f"[List with {len(value)} items: {value[0] if value else 'empty'}...]"
                    print(f"  - {field}: {value}")
                
                # Show total available shortages
                if 'meta' in data and 'results' in data['meta']:
                    total = data['meta']['results'].get('total', 'Unknown')
                    print(f"\n📊 Total shortage records available: {total}")
                
            return True
        else:
            print(f"❌ Error: {response.status_code}")
            print(response.text[:300])
            return False
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_drug_searches():
    """Test searching for specific drugs"""
    
    print("\n\n2. Testing searches for specific drugs")
    print("-" * 40)
    
    test_drugs = ["lisinopril", "insulin", "amoxicillin", "acetaminophen"]
    
    for drug in test_drugs:
        print(f"\n🔍 Searching for: {drug}")
        
        # Try different search strategies
        search_strategies = [
            f'"{drug}"',  # General search
            f'drug_name:"{drug}"',  # If drug_name field exists
            f'active_ingredient:"{drug}"',  # If active_ingredient field exists
        ]
        
        found_results = False
        
        for strategy in search_strategies:
            params = {"search": strategy, "limit": 5}
            if OPENFDA_API_KEY:
                params['api_key'] = OPENFDA_API_KEY
            
            try:
                response = requests.get(DRUG_SHORTAGES_ENDPOINT, params=params, timeout=10)
                
                if response.status_code == 200:
                    data = response.json()
                    if 'results' in data and len(data['results']) > 0:
                        print(f"  ✅ Found {len(data['results'])} shortage(s) with strategy: {strategy}")
                        
                        # Show the first result
                        result = data['results'][0]
                        drug_name = result.get('drug_name', 'Unknown')
                        status = result.get('status', 'Unknown')
                        print(f"    📋 Example: {drug_name} - Status: {status}")
                        
                        found_results = True
                        break
                elif response.status_code == 404:
                    continue  # Try next strategy
                else:
                    print(f"    ❌ Error {response.status_code} with strategy: {strategy}")
                    
            except Exception as e:
                print(f"    ❌ Error with strategy {strategy}: {e}")
        
        if not found_results:
            print(f"  ℹ️  No current shortages found for {drug}")

def explore_fields():
    """Explore what fields are available for searching"""
    
    print("\n\n3. Exploring available fields")
    print("-" * 40)
    
    # Get several records to see field variations
    params = {"limit": 10}
    if OPENFDA_API_KEY:
        params['api_key'] = OPENFDA_API_KEY
    
    try:
        response = requests.get(DRUG_SHORTAGES_ENDPOINT, params=params, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if 'results' in data:
                all_fields = set()
                
                # Collect all unique fields
                for result in data['results']:
                    all_fields.update(result.keys())
                
                print(f"All available fields across {len(data['results'])} records:")
                for field in sorted(all_fields):
                    print(f"  - {field}")
                
                # Show examples of key fields
                print(f"\nExample shortage records:")
                for i, result in enumerate(data['results'][:3], 1):
                    print(f"\n  Record {i}:")
                    for key_field in ['drug_name', 'status', 'reason_for_shortage', 'active_ingredient']:
                        if key_field in result:
                            value = result[key_field]
                            if isinstance(value, str) and len(value) > 80:
                                value = value[:80] + "..."
                            print(f"    {key_field}: {value}")
        else:
            print(f"❌ Error: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    if test_working_endpoint():
        test_drug_searches()
        explore_fields()
        
        print("\n" + "=" * 60)
        print("🎉 SUCCESS! The OpenFDA drug shortages API is working!")
        print("Endpoint: https://api.fda.gov/drug/shortages.json")
        print("\nNext step: Update your MCP server to use this endpoint!")
    else:
        print("\n❌ Could not connect to the shortages endpoint")