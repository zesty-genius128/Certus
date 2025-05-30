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
    print(f"openFDA Client: Fetching label info for: '{drug_identifier}' using field '{identifier_type}'")
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
            print(f"openFDA Client: No label results found for '{drug_identifier}' with type '{identifier_type}'.")
            return {"error": f"No label information found for '{drug_identifier}' using type '{identifier_type}'"}
    except requests.exceptions.Timeout:
        print(f"openFDA Client: Timeout fetching drug label info for '{drug_identifier}'.")
        return {"error": "API request timed out"}
    except requests.exceptions.HTTPError as e:
        print(f"openFDA Client: HTTP Error fetching drug label info: {e.response.status_code} for URL: {e.request.url}")
        return {"error": f"API request failed with status {e.response.status_code}: {e.response.text}"}
    except requests.exceptions.RequestException as e:
        print(f"openFDA Client: Error fetching drug label info: {e}")
        return {"error": f"API request failed: {e}"}
    except json.JSONDecodeError:
        print("openFDA Client: Error decoding JSON from drug label API.")
        return {"error": "Failed to decode JSON response from label API"}

def fetch_drug_shortage_info(drug_identifier_for_shortage: str) -> Dict[str, Any]:
    """
    Fetches drug shortage information from openFDA.
    Searches primarily by active_ingredient or a general term match in drug_name.
    """
    # Using a more general search that includes active_ingredient and drug_name
    # The openFDA shortage search can be sensitive.
    # Sometimes searching for the exact "drug_name" as listed in shortages, or "active_ingredient" works.
    print(f"openFDA Client: Fetching shortage info for search term: '{drug_identifier_for_shortage}'")
    search_term = f'(active_ingredient:"{drug_identifier_for_shortage}" OR drug_name:"{drug_identifier_for_shortage}")'

    params = {
        'search': search_term,
        'limit': 5 # Get a few results in case of multiple formulations
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
                    "reason": item.get("reason_for_shortage", "N/A"), # Corrected field name
                    "estimated_duration": item.get("estimated_shortage_duration", "N/A"),
                    "information_source": item.get("information_source", "N/A"),
                    "available_date": item.get("estimated_resupply_date", "N/A"), # Corrected field name
                    "therapeutic_categories": item.get("therapeutic_category_terms", [])
                })
            return {"shortages": shortages} if shortages else {"status": f"No active shortage entries found for '{drug_identifier_for_shortage}' with search: {search_term}"}
        else:
            # This means the API call was successful but returned no results for the search term
            print(f"openFDA Client: No shortage results returned by API for '{drug_identifier_for_shortage}' with search: {search_term}")
            return {"status": f"No shortage information found (or not currently in shortage) for '{drug_identifier_for_shortage}'"}
    except requests.exceptions.Timeout:
        print(f"openFDA Client: Timeout fetching drug shortage info for '{drug_identifier_for_shortage}'.")
        return {"error": "API request timed out"}
    except requests.exceptions.HTTPError as e:
        # This will now catch the 404 if the search term itself is malformed or endpoint issue
        print(f"openFDA Client: HTTP Error fetching drug shortage info: {e.response.status_code} for URL: {e.request.url}")
        return {"error": f"API request failed with status {e.response.status_code}: {e.response.text}"}
    except requests.exceptions.RequestException as e:
        print(f"openFDA Client: Error fetching drug shortage info: {e}")
        return {"error": f"API request failed: {e}"}
    except json.JSONDecodeError:
        print("openFDA Client: Error decoding JSON from drug shortage API.")
        return {"error": "Failed to decode JSON response from shortage API"}

if __name__ == '__main__':
    from dotenv import load_dotenv
    load_dotenv()
    OPENFDA_API_KEY = os.environ.get("OPENFDA_API_KEY")
    if OPENFDA_API_KEY: print(f"openFDA Client Test: API Key loaded - {OPENFDA_API_KEY[:5]}...")
    else: print("openFDA Client Test: API Key NOT loaded.")

    print("\n--- Testing openFDA Client Directly ---")
    drug_to_test_label = "Lisinopril"
    identifier_for_label_search = "openfda.generic_name" # More reliable for generic names

    print(f"\n--- Testing {drug_to_test_label} Label Info (using {identifier_for_label_search}) ---")
    label_data = fetch_drug_label_info(drug_to_test_label, identifier_type=identifier_for_label_search)
    if label_data and not label_data.get("error") and "openfda" in label_data:
        print(f"  Manufacturer: {label_data['openfda'].get('manufacturer_name', ['N/A'])[0]}")
        print(f"  Brand Names: {label_data['openfda'].get('brand_name', [])}")
        print(f"  Generic Name: {label_data['openfda'].get('generic_name', [])}")
    else:
        print(f"  Label info error or not found: {label_data.get('error', 'Unknown issue')}")

    # For shortage, we pass the name we want to search for.
    # The function will try searching it as active_ingredient or drug_name.
    drug_for_shortage_test_1 = "Lisinopril"
    print(f"\n--- Testing {drug_for_shortage_test_1} Shortage Info ---")
    shortage_data_1 = fetch_drug_shortage_info(drug_for_shortage_test_1)
    print(json.dumps(shortage_data_1, indent=2))

    drug_for_shortage_test_2 = "Amoxicillin"
    print(f"\n--- Testing {drug_for_shortage_test_2} Shortage Info ---")
    shortage_data_2 = fetch_drug_shortage_info(drug_for_shortage_test_2)
    print(json.dumps(shortage_data_2, indent=2))

    # You might want to find a drug currently listed on FDA's shortage page
    # and test with its exact active ingredient name to confirm the query.
    # e.g., if "DrugXyz (active ingredient: xyzamine)" is in shortage:
    # shortage_data_known = fetch_drug_shortage_info("xyzamine")
