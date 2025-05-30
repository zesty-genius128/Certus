#!/usr/bin/env python3
"""
Test script to check drugs that are more likely to have shortages
"""

import os
from dotenv import load_dotenv
load_dotenv()

import openfda_client
from mcp_med_info_server import get_medication_profile_logic

# Drugs that commonly have shortages
test_drugs = [
    "amphetamine",  # ADHD medication (known to have shortages)
    "dextrose",     # IV fluid (shortage due to Hurricane Helene)
    "morphine",     # Opioid (often in shortage)
    "cisplatin",    # Chemotherapy (recent shortages)
    "insulin",      # Diabetes medication
    "amoxicillin",  # Antibiotic
    "lisinopril"    # Your original query
]

print("Testing drugs that commonly have shortages...")
print("=" * 60)

for drug in test_drugs:
    print(f"\n🔍 Testing: {drug.upper()}")
    print("-" * 30)
    
    try:
        # Test shortage lookup directly
        shortage_result = openfda_client.fetch_drug_shortage_info(drug)
        
        if shortage_result.get("shortages"):
            print(f"   🚨 SHORTAGE FOUND! {len(shortage_result['shortages'])} records")
            for i, shortage in enumerate(shortage_result["shortages"][:2]):  # Show first 2
                print(f"      {i+1}. {shortage['drug_name_reported']}")
                print(f"         Status: {shortage['status']}")
                print(f"         Reason: {shortage['reason']}")
        elif shortage_result.get("error"):
            print(f"   ❌ Error: {shortage_result['error']}")
        else:
            print(f"   ✅ No shortage: {shortage_result.get('status', 'Unknown')}")
            
    except Exception as e:
        print(f"   💥 Exception: {e}")

print("\n" + "=" * 60)
print("If you see '🚨 SHORTAGE FOUND!' above, your shortage detection is working!")
print("If you see mostly '✅ No shortage', that's actually good news for patients.")