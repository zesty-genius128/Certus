# openfda_client.py
import requests
import os
import json
from typing import Dict, Any, List

# Load the API key from environment variables
OPENFDA_API_KEY = os.environ.get("OPENFDA_API_KEY")

DRUG_LABEL_ENDPOINT = "https://api.fda.gov/drug/label.json"
DRUG_SHORTAGE_ENDPOINT = "https://api.fda.gov/drug/shortages.json"

def fetch_drug_label_info(drug_identifier: str, identifier_type: str = "openfda.generic_name") -> Dict[str, Any]:
    """
    Fetches drug labeling information from openFDA.
    """
    print(f"openFDA Client: Fetching label info for: {drug_identifier} using field {identifier_type}")
    params = {
        'search': f'{identifier_type}:"{drug_identifier}"',
        'limit': 1
    }
    if OPENFDA_API_KEY:
        params['api_key'] = OPENFDA_API_KEY

    try:
        response = requests.get(DRUG_LABEL_ENDPOINT, params=params, timeout=15)
        response.raise_for_status() # Raises an HTTPError for bad responses (4XX or 5XX)
        data = response.json()
        if data.get("results"):
            return data["results"][0]
        else:
            print(f"openFDA Client: No label results found for '{drug_identifier}' with type '{identifier_type}'")
            return {"error": f"No label information found for '{drug_identifier}' using type '{identifier_type}'"}
    except requests.exceptions.Timeout:
        print(f"openFDA Client: Timeout fetching drug label info for {drug_identifier}")
        return {"error": "API request timed out"}
    except requests.exceptions.HTTPError as e:
        print(f"openFDA Client: HTTP Error fetching drug label info: {e.response.status_code} for URL: {e.request.url}")
        return {"error": f"API request failed with status {e.response.status_code}: {e.response.text}"}
    except requests.exceptions.RequestException as e:
        print(f"openFDA Client: Error fetching drug label info: {e}")
        return {"error": f"API request failed: {e}"}
    except json.JSONDecodeError:
        print("openFDA Client: Error decoding JSON from drug label API")
        return {"error": "Failed to decode JSON response from label API"}

def fetch_drug_shortage_info(drug_identifier: str) -> Dict[str, Any]:
    """
    Fetches drug shortage information from openFDA.
    Searches primarily by active_ingredient or drug_name.
    """
    print(f"openFDA Client: Fetching shortage info for: {drug_identifier}")
    # Try a focused search on active_ingredient first, then broaden if needed or combine
    # Using a general search term that might cover various fields where the drug name appears.
    # The shortage API might be more sensitive; sometimes simpler queries work better.
    # Let's try searching for the identifier in the 'active_ingredient' field,
    # as this is often how shortages are cataloged.
    search_term = f'active_ingredient:"{drug_identifier}"'
    # Alternative or additional search: f'drug_name:"{drug_identifier}"'
    # If the above doesn't work well, you might need to experiment with how openFDA indexes shortage data.
    # For example, searching for the exact drug_name or even NDC if available.

    params = {
        'search': search_term,
        'limit': 5
    }
    if OPENFDA_API_KEY:
        params['api_key'] = OPENFDA_API_KEY

    try:
        response = requests.get(DRUG_SHORTAGE_ENDPOINT, params=params, timeout=15)
        response.raise_for_status()
        data = response.json()
        if data.get("results"):
            shortages: List[Dict[str, Any]] = []
            for item in data["results"]:
                shortages.append({
                    "drug_name_reported": item.get("drug_name", "N/A"),
                    "status": item.get("status", "N/A"),
                    "reason": item.get("reason_for_shortage", "N/A"),
                    "estimated_duration": item.get("estimated_shortage_duration", "N/A"),
                    "information_source": item.get("information_source", "N/A"),
                    "available_date": item.get("estimated_resupply_date", "N/A"),
                    "therapeutic_categories": item.get("therapeutic_category_terms", [])
                })
            return {"shortages": shortages} if shortages else {"status": f"No active shortage found for '{drug_identifier}' matching search: {search_term}"}
        else:
            print(f"openFDA Client: No shortage results found for '{drug_identifier}' with search: {search_term}")
            return {"status": f"No shortage information found or not in shortage for '{drug_identifier}' with search: {search_term}"}
    except requests.exceptions.Timeout:
        print(f"openFDA Client: Timeout fetching drug shortage info for {drug_identifier}")
        return {"error": "API request timed out"}
    except requests.exceptions.HTTPError as e:
        print(f"openFDA Client: HTTP Error fetching drug shortage info: {e.response.status_code} for URL: {e.request.url}")
        # Include response text for 404s to see if there's more info from openFDA
        return {"error": f"API request failed with status {e.response.status_code}: {e.response.text}"}
    except requests.exceptions.RequestException as e:
        print(f"openFDA Client: Error fetching drug shortage info: {e}")
        return {"error": f"API request failed: {e}"}
    except json.JSONDecodeError:
        print("openFDA Client: Error decoding JSON from drug shortage API")
        return {"error": "Failed to decode JSON response from shortage API"}

if __name__ == '__main__':
    from dotenv import load_dotenv
    load_dotenv()
    OPENFDA_API_KEY = os.environ.get("OPENFDA_API_KEY")
    if OPENFDA_API_KEY: print(f"openFDA Client Test: API Key loaded - {OPENFDA_API_KEY[:5]}...")
    else: print("openFDA Client Test: API Key NOT loaded.")

    print("\n--- Testing openFDA Client Directly ---")
    drug_to_test = "Lisinopril"
    identifier_for_label = "openfda.generic_name"

    print(f"\n--- Testing {drug_to_test} Label Info (using {identifier_for_label}) ---")
    label_data = fetch_drug_label_info(drug_to_test, identifier_type=identifier_for_label)
    if label_data and not label_data.get("error") and "openfda" in label_data:
        print(f"  Manufacturer: {label_data['openfda'].get('manufacturer_name', ['N/A'])[0]}")
        print(f"  Brand Names: {label_data['openfda'].get('brand_name', [])}")
        print(f"  Generic Name: {label_data['openfda'].get('generic_name', [])}")
    else:
        print(f"  Label info error or not found: {label_data.get('error', 'Unknown issue')}")

    print(f"\n--- Testing {drug_to_test} Shortage Info ---")
    shortage_data = fetch_drug_shortage_info(drug_to_test) # Lisinopril is an active ingredient
    print(json.dumps(shortage_data, indent=2))

    drug_possibly_in_shortage = "Amoxicillin" # Amoxicillin is an active ingredient
    print(f"\n--- Testing {drug_possibly_in_shortage} Shortage Info ---")
    shortage_data_amox = fetch_drug_shortage_info(drug_possibly_in_shortage)
    print(json.dumps(shortage_data_amox, indent=2))
