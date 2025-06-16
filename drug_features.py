#api client with corrected RxNorm endpoints
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
    """Get RxCUI identifier for a drug name using correct RxNorm API"""
    try:
        # Use correct endpoint: findRxcuiByString
        url = f"{RXNAV_BASE_URL}/rxcui.json"
        params = {"name": drug_name, "search": "2"}  # search=2 is normalized search
        
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        if data.get("idGroup") and data["idGroup"].get("rxnormId"):
            return data["idGroup"]["rxnormId"][0]
        
        return None
        
    except Exception as e:
        print(f"rxcui lookup failed for {drug_name}: {str(e)}", file=sys.stderr)
        return None

def get_drug_interactions_via_rxclass(rxcui: str) -> Dict[str, Any]:
    """Get drug interactions using RxClass API (still working)"""
    try:
        # Use RxClass API to find interactions through drug classes
        url = f"https://rxnav.nlm.nih.gov/REST/rxclass/class/byRxcui.json"
        params = {"rxcui": rxcui, "relaSource": "MEDRT"}
        
        response = requests.get(url, params=params, timeout=15)
        response.raise_for_status()
        data = response.json()
        
        return {
            "drug_classes": data.get("rxclassDrugInfoList", {}).get("rxclassDrugInfo", []),
            "interaction_note": "Use drug classes to identify potential interactions manually",
            "recommendation": "Consult pharmacist for clinical drug interaction checking"
        }
        
    except Exception as e:
        return {"error": f"RxClass lookup failed: {str(e)}"}

def check_drug_interactions(drug1: str, drug2: str, additional_drugs: List[str] = []) -> Dict[str, Any]:
    """Enhanced drug interaction checker using optimal RxNorm API methods"""
    try:
        all_drugs = [drug1, drug2] + additional_drugs
        drug_info = {}
        
        for drug in all_drugs:
            rxcui = get_rxcui_for_drug(drug)
            if rxcui:
                # OPTIMAL: Use getRelatedByType to get ONLY ingredients (TTY=IN)
                url = f"{RXNAV_BASE_URL}/rxcui/{rxcui}/related.json"
                params = {"tty": "IN"}  # TTY=IN means ingredients only
                
                try:
                    response = requests.get(url, params=params, timeout=15)
                    response.raise_for_status()
                    data = response.json()
                    
                    # Extract ingredient names (much smaller response)
                    ingredients = []
                    if data.get("relatedGroup", {}).get("conceptGroup"):
                        for group in data["relatedGroup"]["conceptGroup"]:
                            if group.get("tty") == "IN" and group.get("conceptProperties"):
                                for concept in group["conceptProperties"]:
                                    ingredients.append(concept.get("name", "Unknown"))
                    
                    drug_info[drug] = {
                        "rxcui": rxcui,
                        "ingredients": ingredients
                    }
                    
                except Exception as e:
                    # Fallback: just store the RxCUI if ingredient lookup fails
                    drug_info[drug] = {
                        "rxcui": rxcui, 
                        "ingredients": [],
                        "note": f"Could not retrieve ingredients: {str(e)}"
                    }
            else:
                return {"error": f"Could not find RxCUI for drug: {drug}"}
        
        # Analyze for interactions based on ingredients
        potential_interactions = []
        warnings = []
        drug_names = list(drug_info.keys())
        
        for i, drug_a in enumerate(drug_names):
            for drug_b in drug_names[i+1:]:
                info_a = drug_info[drug_a]
                info_b = drug_info[drug_b]
                
                # Check for same ingredients (potential duplication)
                if info_a.get("ingredients") and info_b.get("ingredients"):
                    common_ingredients = set(info_a["ingredients"]) & set(info_b["ingredients"])
                    if common_ingredients:
                        potential_interactions.append({
                            "drug_a": drug_a,
                            "drug_b": drug_b,
                            "interaction_type": "Ingredient duplication",
                            "common_ingredients": list(common_ingredients),
                            "severity": "Monitor for additive effects",
                            "recommendation": "Consult pharmacist about potential duplication"
                        })
        
        # Add general warnings for common problematic combinations
        for drug_name in drug_names:
            if any(ingredient.lower() in ["warfarin", "aspirin", "clopidogrel"] 
                   for ingredient in drug_info[drug_name].get("ingredients", [])):
                warnings.append(f"{drug_name} contains anticoagulant/antiplatelet agents - monitor for bleeding risk")
        
        return {
            "drugs_analyzed": all_drugs,
            "drug_details": drug_info,
            "potential_interactions": potential_interactions,
            "safety_warnings": warnings,
            "summary": f"Analyzed {len(all_drugs)} drugs, found {len(potential_interactions)} potential interactions",
            "limitations": "Based on ingredient comparison only. For comprehensive interaction checking, consult pharmacist or clinical decision support system.",
            "data_source": "RxNorm API (getRelatedByType method)",
            "methodology": "Compares active ingredients to identify potential duplications and common interaction risks"
        }
        
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
    print("testing corrected drug features client", file=sys.stderr)
    
    # Test RxCUI lookup
    rxcui = get_rxcui_for_drug("aspirin")
    print(f"rxcui test: aspirin = {rxcui}", file=sys.stderr)
    
    # Test name conversion
    test_result = convert_drug_names("tylenol")
    print(f"name conversion test: {len(test_result.get('generic_names', []))} generic names found", file=sys.stderr)
    
    # Test interaction with working RxNorm data
    test_result = check_drug_interactions("aspirin", "warfarin")
    print(f"interaction test: {len(test_result.get('potential_interactions', []))} interactions found", file=sys.stderr)