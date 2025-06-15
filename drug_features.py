# drug_features.py - API client for new drug features
import requests
import os
import json
import sys
import time
from typing import Dict, Any, List

OPENFDA_API_KEY = os.environ.get("OPENFDA_API_KEY")
DRUG_LABEL_ENDPOINT = "https://api.fda.gov/drug/label.json"
FAERS_ENDPOINT = "https://api.fda.gov/drug/event.json"
RXNAV_BASE_URL = "https://rxnav.nlm.nih.gov/REST"

# Rate limiting for FAERS API
last_faers_request = 0
FAERS_MIN_INTERVAL = 0.25  # 4 requests per second to stay under 240/minute

def get_rxcui_for_drug(drug_name: str) -> str:
    """Get RxCUI identifier for a drug name"""
    try:
        url = f"{RXNAV_BASE_URL}/rxcui.json"
        params = {"name": drug_name}
        
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        if data.get("idGroup") and data["idGroup"].get("rxnormId"):
            return data["idGroup"]["rxnormId"][0]
        
        return None
        
    except Exception as e:
        print(f"rxcui lookup failed for {drug_name}: {str(e)}", file=sys.stderr)
        return None

def check_drug_interactions(drug1: str, drug2: str, additional_drugs: List[str] = []) -> Dict[str, Any]:
    """Check for drug interactions using RxNav API"""
    try:
        # Get RxCUI codes for all drugs
        all_drugs = [drug1, drug2] + additional_drugs
        rxcuis = []
        drug_mapping = {}
        
        for drug in all_drugs:
            rxcui = get_rxcui_for_drug(drug)
            if rxcui:
                rxcuis.append(rxcui)
                drug_mapping[rxcui] = drug
            else:
                return {"error": f"Could not find RxCUI for drug: {drug}"}
        
        if len(rxcuis) < 2:
            return {"error": "Need at least 2 valid drugs to check interactions"}
        
        # Check interactions
        url = f"{RXNAV_BASE_URL}/interaction/list.json"
        params = {"rxcuis": "+".join(rxcuis)}
        
        response = requests.get(url, params=params, timeout=15)
        
        if response.status_code == 404:
            return {"status": "No interactions found between the specified drugs"}
        
        response.raise_for_status()
        data = response.json()
        
        interactions = []
        if data.get("fullInteractionTypeGroup"):
            for group in data["fullInteractionTypeGroup"]:
                if group.get("fullInteractionType"):
                    for interaction_type in group["fullInteractionType"]:
                        if interaction_type.get("interactionPair"):
                            for pair in interaction_type["interactionPair"]:
                                drug_a = pair.get("interactionConcept", [{}])[0].get("minConceptItem", {}).get("name", "Unknown")
                                drug_b = pair.get("interactionConcept", [{}])[-1].get("minConceptItem", {}).get("name", "Unknown")
                                
                                interactions.append({
                                    "drug_a": drug_a,
                                    "drug_b": drug_b,
                                    "severity": pair.get("severity", "Unknown"),
                                    "description": pair.get("description", "No description available")
                                })
        
        return {
            "drugs_checked": all_drugs,
            "interactions_found": len(interactions),
            "interactions": interactions,
            "data_source": "RxNav Drug Interaction API"
        }
        
    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 404:
            return {"status": "No interactions found between the specified drugs"}
        return {"error": f"API error: {e.response.status_code}"}
    except Exception as e:
        return {"error": f"Error checking interactions: {str(e)}"}

def convert_drug_names(drug_name: str, conversion_type: str = "both") -> Dict[str, Any]:
    """Convert between generic and brand names using existing OpenFDA data"""
    try:
        # Search both generic and brand name fields
        search_strategies = [
            ("openfda.generic_name", drug_name),
            ("openfda.brand_name", drug_name)
        ]
        
        for field, search_term in search_strategies:
            params = {
                'search': f'{field}:"{search_term}"',
                'limit': 5
            }
            if OPENFDA_API_KEY:
                params['api_key'] = OPENFDA_API_KEY
            
            try:
                response = requests.get(DRUG_LABEL_ENDPOINT, params=params, timeout=15)
                
                if response.status_code == 404:
                    continue
                    
                response.raise_for_status()
                data = response.json()
                
                if data.get("results"):
                    # Extract names from results
                    generic_names = set()
                    brand_names = set()
                    
                    for result in data["results"]:
                        openfda = result.get("openfda", {})
                        
                        if openfda.get("generic_name"):
                            generic_names.update(openfda["generic_name"])
                        
                        if openfda.get("brand_name"):
                            brand_names.update(openfda["brand_name"])
                    
                    # Format response based on conversion type
                    result = {
                        "original_drug": drug_name,
                        "conversion_type": conversion_type,
                        "data_source": "OpenFDA Drug Labels"
                    }
                    
                    if conversion_type in ["generic", "both"]:
                        result["generic_names"] = sorted(list(generic_names))
                    
                    if conversion_type in ["brand", "both"]:
                        result["brand_names"] = sorted(list(brand_names))
                    
                    return result
                    
            except (requests.exceptions.RequestException, json.JSONDecodeError):
                continue
        
        return {"error": f"No name conversion data found for '{drug_name}'"}
        
    except Exception as e:
        return {"error": f"Error converting drug names: {str(e)}"}

def get_adverse_events(drug_name: str, time_period: str = "1year", severity_filter: str = "all") -> Dict[str, Any]:
    """Get FDA adverse event reports for a medication"""
    global last_faers_request
    
    try:
        # Rate limiting for FAERS API
        current_time = time.time()
        time_since_last = current_time - last_faers_request
        if time_since_last < FAERS_MIN_INTERVAL:
            time.sleep(FAERS_MIN_INTERVAL - time_since_last)
        
        # Build search parameters
        search_terms = [
            f'patient.drug.medicinalproduct:"{drug_name}"',
            f'patient.drug.drugindication:"{drug_name}"'
        ]
        
        # Try different search strategies
        for search_term in search_terms:
            params = {
                'search': search_term,
                'limit': 100
            }
            
            if OPENFDA_API_KEY:
                params['api_key'] = OPENFDA_API_KEY
            
            try:
                response = requests.get(FAERS_ENDPOINT, params=params, timeout=15)
                last_faers_request = time.time()
                
                if response.status_code == 429:
                    # Rate limited, wait and retry once
                    time.sleep(1)
                    response = requests.get(FAERS_ENDPOINT, params=params, timeout=15)
                    last_faers_request = time.time()
                
                if response.status_code == 404:
                    continue
                
                response.raise_for_status()
                data = response.json()
                
                if data.get("results"):
                    # Process adverse events
                    events = []
                    serious_events = 0
                    
                    for result in data["results"]:
                        # Extract key information
                        event = {
                            "report_id": result.get("safetyreportid", "Unknown"),
                            "serious": result.get("serious", "Unknown"),
                            "outcome": result.get("patient", {}).get("patientdeath", "Unknown"),
                            "reactions": []
                        }
                        
                        # Extract reactions
                        if result.get("patient", {}).get("reaction"):
                            for reaction in result["patient"]["reaction"]:
                                event["reactions"].append({
                                    "term": reaction.get("reactionmeddrapt", "Unknown"),
                                    "outcome": reaction.get("reactionoutcome", "Unknown")
                                })
                        
                        events.append(event)
                        
                        if event["serious"] == "1":
                            serious_events += 1
                    
                    # Filter by severity if requested
                    if severity_filter == "serious":
                        events = [e for e in events if e["serious"] == "1"]
                    
                    return {
                        "drug_name": drug_name,
                        "time_period": time_period,
                        "total_reports": len(events),
                        "serious_reports": serious_events,
                        "adverse_events": events[:20],  # Limit to first 20 for readability
                        "data_source": "FDA FAERS Database"
                    }
                    
            except requests.exceptions.HTTPError as e:
                if e.response.status_code == 429:
                    return {"error": "Rate limit exceeded. Please try again later."}
                elif e.response.status_code == 404:
                    continue
                else:
                    return {"error": f"API error: {e.response.status_code}"}
            except (requests.exceptions.RequestException, json.JSONDecodeError):
                continue
        
        return {"status": f"No adverse event reports found for '{drug_name}'"}
        
    except Exception as e:
        return {"error": f"Error retrieving adverse events: {str(e)}"}

# Test basic functionality
if __name__ == "__main__":
    print("testing drug features client", file=sys.stderr)
    
    # Test drug interaction
    test_result = check_drug_interactions("warfarin", "aspirin")
    print(f"interaction test: {test_result.get('status', 'found interactions')}", file=sys.stderr)
    
    # Test name conversion
    test_result = convert_drug_names("tylenol")
    print(f"name conversion test: {len(test_result.get('generic_names', []))} generic names found", file=sys.stderr)