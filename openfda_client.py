# openfda_client.py
import requests
import os
import json
import sys
from typing import Dict, Any, List

OPENFDA_API_KEY = os.environ.get("OPENFDA_API_KEY")
DRUG_LABEL_ENDPOINT = "https://api.fda.gov/drug/label.json"
DRUG_SHORTAGES_ENDPOINT = "https://api.fda.gov/drug/shortages.json"

def fetch_drug_label_info(drug_identifier: str, identifier_type: str = "openfda.generic_name") -> Dict[str, Any]:
    """Retrieve drug label information from openFDA"""
    print(f"Fetching label info for: {drug_identifier}", file=sys.stderr)
    
    params = {
        'search': f'{identifier_type}:"{drug_identifier}"',
        'limit': 1
    }
    if OPENFDA_API_KEY:
        params['api_key'] = OPENFDA_API_KEY

    try:
        response = requests.get(DRUG_LABEL_ENDPOINT, params=params, timeout=15)
        response.raise_for_status()
        data = response.json()
        
        if data.get("results"):
            return data["results"][0]
        else:
            return {"error": f"No label information found for '{drug_identifier}'"}
            
    except requests.exceptions.Timeout:
        return {"error": "Request timed out"}
    except requests.exceptions.HTTPError as e:
        return {"error": f"HTTP error: {e.response.status_code}"}
    except requests.exceptions.RequestException as e:
        return {"error": f"Request failed: {str(e)}"}
    except json.JSONDecodeError:
        return {"error": "Invalid JSON response"}

def fetch_drug_shortage_info(drug_identifier: str) -> Dict[str, Any]:
    """Search for drug shortage information"""
    print(f"Searching shortages for: {drug_identifier}", file=sys.stderr)
    
    # Clean up drug name
    clean_name = drug_identifier.lower().strip()
    if " and " in clean_name:
        clean_name = clean_name.split(" and ")[0].strip()
    
    # Remove common suffixes
    suffixes = [" tablets", " capsules", " injection", " oral", " solution"]
    for suffix in suffixes:
        if clean_name.endswith(suffix):
            clean_name = clean_name.replace(suffix, "").strip()
    
    # Try different search strategies
    search_terms = [
        f'"{clean_name}"',
        f'generic_name:"{clean_name}"',
        f'proprietary_name:"{clean_name}"',
        f'openfda.generic_name:"{clean_name}"',
        f'openfda.brand_name:"{clean_name}"'
    ]
    
    if clean_name != drug_identifier.lower():
        search_terms.extend([
            f'"{drug_identifier}"',
            f'generic_name:"{drug_identifier}"'
        ])
    
    for search_term in search_terms:
        params = {
            'search': search_term,
            'limit': 20
        }
        if OPENFDA_API_KEY:
            params['api_key'] = OPENFDA_API_KEY

        try:
            response = requests.get(DRUG_SHORTAGES_ENDPOINT, params=params, timeout=15)
            
            if response.status_code == 404:
                continue
            elif response.status_code != 200:
                continue
                
            data = response.json()
            
            if data.get("results"):
                shortages = []
                for item in data["results"]:
                    generic_name = item.get("generic_name", "").lower()
                    proprietary_name = item.get("proprietary_name", "").lower()
                    
                    openfda_data = item.get("openfda", {})
                    openfda_generic = [name.lower() for name in openfda_data.get("generic_name", [])]
                    openfda_brand = [name.lower() for name in openfda_data.get("brand_name", [])]
                    
                    search_clean = search_term.replace('generic_name:"', '').replace('proprietary_name:"', '').replace('"', '').lower()
                    
                    # Check if this record matches our search
                    if (search_clean in generic_name or 
                        search_clean in proprietary_name or
                        any(search_clean in name for name in openfda_generic) or
                        any(search_clean in name for name in openfda_brand) or
                        any(name in search_clean for name in openfda_generic if len(name) > 3)):
                        
                        shortages.append({
                            "generic_name": item.get("generic_name", "N/A"),
                            "proprietary_name": item.get("proprietary_name", "N/A"),
                            "status": item.get("status", "N/A"),
                            "availability": item.get("availability", "N/A"),
                            "shortage_reason": item.get("shortage_reason", "N/A"),
                            "company_name": item.get("company_name", "N/A"),
                            "dosage_form": item.get("dosage_form", "N/A"),
                            "strength": item.get("strength", []),
                            "therapeutic_category": item.get("therapeutic_category", []),
                            "initial_posting_date": item.get("initial_posting_date", "N/A"),
                            "update_date": item.get("update_date", "N/A"),
                            "update_type": item.get("update_type", "N/A"),
                            "contact_info": item.get("contact_info", "N/A"),
                            "presentation": item.get("presentation", "N/A"),
                            "openfda_info": {
                                "generic_name": openfda_data.get("generic_name", []),
                                "brand_name": openfda_data.get("brand_name", []),
                                "manufacturer_name": openfda_data.get("manufacturer_name", [])
                            }
                        })
                
                if shortages:
                    print(f"Found {len(shortages)} shortage records", file=sys.stderr)
                    return {"shortages": shortages}
                    
        except (requests.exceptions.RequestException, json.JSONDecodeError):
            continue
    
    return {"status": f"No current shortages found for '{drug_identifier}'"}

def search_drug_recalls(drug_identifier: str) -> Dict[str, Any]:
    """Search for drug recalls"""
    print(f"Searching recalls for: {drug_identifier}", file=sys.stderr)
    
    endpoint = "https://api.fda.gov/drug/enforcement.json"
    params = {
        'search': f'product_description:"{drug_identifier}"',
        'limit': 10
    }
    if OPENFDA_API_KEY:
        params['api_key'] = OPENFDA_API_KEY

    try:
        response = requests.get(endpoint, params=params, timeout=15)
        response.raise_for_status()
        data = response.json()
        
        if data.get("results"):
            recalls = []
            for item in data["results"]:
                recalls.append({
                    "product_description": item.get("product_description", "N/A"),
                    "reason_for_recall": item.get("reason_for_recall", "N/A"),
                    "classification": item.get("classification", "N/A"),
                    "status": item.get("status", "N/A"),
                    "recall_initiation_date": item.get("recall_initiation_date", "N/A"),
                    "recalling_firm": item.get("recalling_firm", "N/A")
                })
            return {"recalls": recalls}
        else:
            return {"status": f"No recalls found for '{drug_identifier}'"}
            
    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 404:
            return {"status": f"No recalls found for '{drug_identifier}'"}
        return {"error": f"HTTP error: {e.response.status_code}"}
    except Exception as e:
        return {"error": f"Error searching recalls: {str(e)}"}

def analyze_drug_market_trends(drug_identifier: str, months_back: int = 12) -> Dict[str, Any]:
    """Analyze shortage patterns and market trends for a drug"""
    print(f"Analyzing trends for: {drug_identifier}", file=sys.stderr)
    
    clean_name = drug_identifier.lower().strip()
    
    params = {
        'search': f'"{clean_name}"',
        'limit': 100
    }
    if OPENFDA_API_KEY:
        params['api_key'] = OPENFDA_API_KEY

    try:
        response = requests.get(DRUG_SHORTAGES_ENDPOINT, params=params, timeout=20)
        response.raise_for_status()
        data = response.json()
        
        if not data.get("results"):
            return {
                "drug_analyzed": drug_identifier,
                "analysis_period_months": months_back,
                "trend_summary": "No shortage data found",
                "market_insights": {
                    "shortage_frequency": "None",
                    "risk_level": "Low",
                    "recommendation": "No historical shortage patterns detected"
                }
            }
        
        # Filter relevant records
        relevant_records = []
        for item in data["results"]:
            drug_name = item.get("generic_name", "").lower()
            proprietary_name = item.get("proprietary_name", "").lower()
            
            if (clean_name in drug_name or 
                clean_name in proprietary_name or
                any(clean_name in name.lower() for name in item.get("openfda", {}).get("generic_name", []))):
                relevant_records.append(item)
        
        if not relevant_records:
            return {
                "drug_analyzed": drug_identifier,
                "analysis_period_months": months_back,
                "trend_summary": "No relevant shortage records found",
                "market_insights": {
                    "shortage_frequency": "None",
                    "risk_level": "Low",
                    "recommendation": "No shortage history for this drug"
                }
            }
        
        # Analyze patterns
        status_counts = {}
        companies_affected = set()
        reasons = []
        recent_activity = 0
        
        for record in relevant_records:
            status = record.get("status", "Unknown")
            status_counts[status] = status_counts.get(status, 0) + 1
            
            company = record.get("company_name", "Unknown")
            if company != "Unknown":
                companies_affected.add(company)
            
            reason = record.get("shortage_reason", "")
            if reason and reason != "N/A":
                reasons.append(reason)
            
            if status in ["Current", "To Be Discontinued"]:
                recent_activity += 1
        
        # Calculate risk
        total_records = len(relevant_records)
        current_shortages = status_counts.get("Current", 0)
        resolved_shortages = status_counts.get("Resolved", 0)
        
        if current_shortages > 0:
            risk_level = "High"
        elif total_records > 5:
            risk_level = "Medium"
        else:
            risk_level = "Low"
        
        # Build frequency description
        frequency_desc = f"{total_records} shortage events found"
        if total_records > 10:
            frequency_desc += " (high frequency)"
        elif total_records > 3:
            frequency_desc += " (moderate frequency)"
        else:
            frequency_desc += " (low frequency)"
        
        # Top reasons
        reason_summary = "Not specified"
        if reasons:
            from collections import Counter
            top_reasons = Counter(reasons).most_common(3)
            reason_summary = "; ".join([reason for reason, count in top_reasons])
        
        recommendation = f"Risk level: {risk_level}."
        if current_shortages > 0:
            recommendation += f" Monitor {current_shortages} current shortage(s)."
        else:
            recommendation += f" {resolved_shortages} resolved shortage(s) in history."
        
        return {
            "drug_analyzed": drug_identifier,
            "analysis_period_months": months_back,
            "total_shortage_events": total_records,
            "trend_summary": f"Found {total_records} shortage records affecting {len(companies_affected)} companies",
            "status_breakdown": status_counts,
            "market_insights": {
                "shortage_frequency": frequency_desc,
                "risk_level": risk_level,
                "companies_affected": len(companies_affected),
                "recent_activity": recent_activity,
                "common_reasons": reason_summary,
                "recommendation": recommendation
            },
            "detailed_records": relevant_records[:5]
        }
        
    except Exception as e:
        return {
            "drug_analyzed": drug_identifier,
            "error": f"Failed to analyze trends: {str(e)}",
            "recommendation": "Unable to perform trend analysis"
        }

def batch_drug_analysis(drug_list: List[str], include_trends: bool = False) -> Dict[str, Any]:
    """Analyze multiple drugs for shortages and risk assessment"""
    print(f"Starting batch analysis for {len(drug_list)} drugs", file=sys.stderr)
    
    if len(drug_list) > 25:
        return {
            "error": "Batch size too large. Limit to 25 drugs per batch.",
            "recommendation": "Split list into smaller batches"
        }
    
    results = {
        "batch_summary": {
            "total_drugs_analyzed": len(drug_list),
            "analysis_timestamp": "2025-06-02",
            "drugs_with_shortages": 0,
            "drugs_with_recalls": 0,
            "high_risk_drugs": 0,
            "total_shortage_events": 0
        },
        "individual_analyses": {},
        "risk_assessment": {
            "high_risk": [],
            "medium_risk": [],
            "low_risk": []
        },
        "formulary_recommendations": []
    }
    
    for drug in drug_list:
        print(f"Analyzing {drug}", file=sys.stderr)
        
        drug_analysis = {
            "drug_name": drug,
            "shortage_status": "Unknown",
            "recall_status": "Unknown",
            "risk_level": "Unknown",
            "details": {}
        }
        
        try:
            # Check shortages
            shortage_info = fetch_drug_shortage_info(drug)
            if shortage_info.get("shortages"):
                drug_analysis["shortage_status"] = f"Found {len(shortage_info['shortages'])} shortage(s)"
                results["batch_summary"]["drugs_with_shortages"] += 1
                results["batch_summary"]["total_shortage_events"] += len(shortage_info["shortages"])
                
                current_shortages = sum(1 for s in shortage_info["shortages"] if s.get("status") == "Current")
                if current_shortages > 0:
                    drug_analysis["risk_level"] = "High"
                    results["risk_assessment"]["high_risk"].append(drug)
                    results["batch_summary"]["high_risk_drugs"] += 1
                else:
                    drug_analysis["risk_level"] = "Medium"
                    results["risk_assessment"]["medium_risk"].append(drug)
                
                drug_analysis["details"]["shortage_summary"] = {
                    "total_records": len(shortage_info["shortages"]),
                    "current_shortages": current_shortages,
                    "companies_affected": list(set(s.get("company_name", "Unknown") for s in shortage_info["shortages"][:5]))
                }
            else:
                drug_analysis["shortage_status"] = "No current shortages"
                drug_analysis["risk_level"] = "Low"
                results["risk_assessment"]["low_risk"].append(drug)
            
            # Check recalls
            recall_info = search_drug_recalls(drug)
            if recall_info.get("recalls"):
                drug_analysis["recall_status"] = f"Found {len(recall_info['recalls'])} recall(s)"
                results["batch_summary"]["drugs_with_recalls"] += 1
                drug_analysis["details"]["recall_summary"] = {
                    "total_recalls": len(recall_info["recalls"]),
                    "recent_recalls": [r.get("product_description", "Unknown")[:50] + "..." for r in recall_info["recalls"][:2]]
                }
            else:
                drug_analysis["recall_status"] = "No recent recalls"
            
            # Add trend analysis if requested
            if include_trends:
                trend_info = analyze_drug_market_trends(drug, months_back=6)
                drug_analysis["details"]["trend_analysis"] = {
                    "total_shortage_events": trend_info.get("total_shortage_events", 0),
                    "risk_level": trend_info.get("market_insights", {}).get("risk_level", "Unknown"),
                    "recommendation": trend_info.get("market_insights", {}).get("recommendation", "No trend data available")
                }
            
        except Exception as e:
            drug_analysis["error"] = f"Analysis failed: {str(e)}"
            drug_analysis["risk_level"] = "Unknown"
        
        results["individual_analyses"][drug] = drug_analysis
    
    # Generate recommendations
    high_risk_count = len(results["risk_assessment"]["high_risk"])
    total_drugs = len(drug_list)
    
    if high_risk_count > total_drugs * 0.3:
        results["formulary_recommendations"].append("HIGH ALERT: Over 30% of drugs show shortage risks")
        results["formulary_recommendations"].append("Recommend immediate alternative sourcing for high-risk medications")
    
    if results["batch_summary"]["drugs_with_shortages"] > 0:
        results["formulary_recommendations"].append(f"Monitor {results['batch_summary']['drugs_with_shortages']} drugs with active shortage concerns")
    
    if len(results["risk_assessment"]["low_risk"]) == total_drugs:
        results["formulary_recommendations"].append("No significant shortage risks detected in this drug set")
    
    results["formulary_recommendations"].append(f"Analyzed {total_drugs} drugs with {results['batch_summary']['total_shortage_events']} total shortage events")
    
    print(f"Completed batch analysis for {len(drug_list)} drugs", file=sys.stderr)
    return results