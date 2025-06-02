#!/usr/bin/env python3
"""
test script to check drugs that are more likely to have shortages
"""

import os
from dotenv import load_dotenv
load_dotenv()

import openfda_client
from mcp_med_info_server import get_medication_profile_logic

# Drugs that commonly have shortages
test_drugs = [
    "amphetamine",  # adhd medication (known to have shortages)
    "dextrose",     # iv fluid (shortage due to hurricane helene)
    "morphine",     # opioid (often in shortage)
    "cisplatin",    # chemotherapy (recent shortages)
    "insulin",      # diabetes medication
    "amoxicillin",  # antibiotic
    "lisinopril"    # your original query
]

print("testing drugs that commonly have shortages...")
print("=" * 60)

for drug in test_drugs:
    print(f"\n🔍 testing: {drug.upper()}")
    print("-" * 30)
    
    try:
        # Test shortage lookup directly
        shortage_result = openfda_client.fetch_drug_shortage_info(drug)
        
        if shortage_result.get("shortages"):
            print(f"   🚨 shortage found! {len(shortage_result['shortages'])} records")
            for i, shortage in enumerate(shortage_result["shortages"][:2]):  # Show first 2
                print(f"      {i+1}. {shortage['drug_name_reported']}")
                print(f"         status: {shortage['status']}")
                print(f"         reason: {shortage['reason']}")
        elif shortage_result.get("error"):
            print(f"   ❌ error: {shortage_result['error']}")
        else:
            print(f"   ✅ no shortage: {shortage_result.get('status', 'unknown')}")
            
    except Exception as e:
        print(f"   💥 exception: {e}")

print("\n" + "=" * 60)
print("if you see '🚨 shortage found!' above, your shortage detection is working!")
print("if you see mostly '✅ no shortage', that's actually good news for patients.")