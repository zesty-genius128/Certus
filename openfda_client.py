# openfda_client.py
import requests
import os
import json

# OPENFDA_API_KEY = os.environ.get("OPENFDA_API_KEY") # If you decide to use one

DRUG_LABEL_ENDPOINT = "https://api.fda.gov/drug/label.json"
DRUG_SHORTAGE_ENDPOINT = "https://api.fda.gov/drug/shortages.json"

def fetch_drug_label_info(drug_identifier: str, identifier_type: str = "openfda.generic_name.exact") -> dict:
    """
    Fetches drug labeling information from openFDA.
    Identifier type could be:
    'openfda.generic_name.exact', 'openfda.brand_name.exact',
    'openfda.spl_set_id.exact', 'openfda.product_ndc.exact', etc.
    """
    print(f"Fetching label info for: {drug_identifier} using {identifier_type}")
    # Note: openFDA search is powerful but can be tricky.
    # You'll need to construct the search query carefully.
    # Example: search for generic name
    params = {
        'search': f'{identifier_type}:"{drug_identifier}"',
        'limit': 1 # Usually you want the most relevant single product label
    }
    # if OPENFDA_API_KEY:
    #     params['api_key'] = OPENFDA_API_KEY

    try:
        response = requests.get(DRUG_LABEL_ENDPOINT, params=params, timeout=10)
        response.raise_for_status() # Raises an HTTPError for bad responses (4XX or 5XX)
        data = response.json()
        if data.get("results"):
            # You'll need to parse this to get specific sections like:
            # indications_and_usage, adverse_reactions, dosage_and_administration,
            # warnings_and_cautions, openfda (for manufacturer, brand/generic names etc.)
            # For now, just returning the first result.
            # This will be a large JSON object representing the SPL.
            return data["results"][0]
        else:
            print(f"No label results found for {drug_identifier}")
            return {"error": "No label information found"}
    except requests.exceptions.RequestException as e:
        print(f"Error fetching drug label info: {e}")
        return {"error": f"API request failed: {e}"}
    except json.JSONDecodeError:
        print("Error decoding JSON from drug label API")
        return {"error": "Failed to decode JSON response"}

def fetch_drug_shortage_info(drug_identifier: str, identifier_type: str = "generic_name") -> dict:
    """
    Fetches drug shortage information from openFDA.
    Identifier type can be generic_name, ndc, etc.
    The shortage API search is simpler, often by generic name.
    """
    print(f"Fetching shortage info for: {drug_identifier}")
    # Example: search for generic name; the API is a bit basic here.
    # You might need to refine search logic or use NDC if possible.
    # The shortage API often lists shortages by active ingredient or generic name.
    params = {
        'search': f'drug_name:"{drug_identifier}" OR active_ingredient:"{drug_identifier}"',
        'limit': 5 # Get a few in case of multiple entries
    }
    # if OPENFDA_API_KEY:
    #     params['api_key'] = OPENFDA_API_KEY

    try:
        response = requests.get(DRUG_SHORTAGE_ENDPOINT, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()
        if data.get("results"):
            # You'll need to parse this to find the most relevant shortage info.
            # For now, just returning a summary.
            # Fields include: "reason", "status", "estimated_shortage_duration", "information_source"
            # A drug might have multiple shortage reports.
            shortages = []
            for item in data["results"]:
                shortages.append({
                    "status": item.get("status"),
                    "reason": item.get("reason"),
                    "estimated_duration": item.get("estimated_shortage_duration"),
                    "information_source": item.get("information_source")
                })
            return {"shortages": shortages} if shortages else {"status": "No active shortage found"}
        else:
            print(f"No shortage results found for {drug_identifier}")
            return {"status": "No shortage information found or not in shortage"}
    except requests.exceptions.RequestException as e:
        print(f"Error fetching drug shortage info: {e}")
        return {"error": f"API request failed: {e}"}
    except json.JSONDecodeError:
        print("Error decoding JSON from drug shortage API")
        return {"error": "Failed to decode JSON response"}

if __name__ == '__main__':
    # Quick test for the client (optional)
    drug = "Lisinopril"
    print(f"\n--- Testing {drug} Label Info ---")
    label_info = fetch_drug_label_info(drug)
    # print(json.dumps(label_info, indent=2)) # This will be a lot of text
    if label_info and not label_info.get("error"):
        print(f"Manufacturer for {drug}: {label_info.get('openfda', {}).get('manufacturer_name', ['N/A'])[0]}")

    print(f"\n--- Testing {drug} Shortage Info ---")
    shortage_info = fetch_drug_shortage_info(drug)
    print(json.dumps(shortage_info, indent=2))

    drug_with_known_shortage = "Amoxicillin" # Example, actual shortages vary
    print(f"\n--- Testing {drug_with_known_shortage} Shortage Info ---")
    shortage_info_amox = fetch_drug_shortage_info(drug_with_known_shortage)
    print(json.dumps(shortage_info_amox, indent=2))