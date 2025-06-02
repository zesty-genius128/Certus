#!/usr/bin/env python3
# Standard library imports
import json
import sys
import base64
import os
import io
import argparse
import asyncio # For MCP client calls
import re # For more robust parsing

# Typing imports
from typing import Union, List, Dict, Any

# Third-party library imports
# OCR related - only import if method is selected
import easyocr
import cv2
import numpy as np
import openai
import google.generativeai as genai
from PIL import Image

from thefuzz import process, fuzz # For fuzzy matching
import requests # For BlueHive API calls
from dotenv import load_dotenv # For environment variables

# MCP Client import
from mcp.client.stdio import stdio_client
from mcp import StdioServerParameters # For stdio_client parameters
from mcp.client.session import ClientSession # For type hinting the session

# Load environment variables from .env file (expected in project root)
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))


# --- API Endpoints & Keys ---
BLUEHIVE_API_ENDPOINT = "https://ai.bluehive.com/api/v1/completion"
SECRET_KEY = os.environ.get("BLUEHIVE_API_KEY")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY")
# OPENFDA_API_KEY is used by the MCP server, not directly here

# --- Global Client Placeholders (initialized in main or if __name__ == "__main__") ---
openai_client_global = None
gemini_model_global = None
easyocr_reader_global = None # For potential EasyOCR pre-initialization


# --- Domain Specific Dictionary for Fuzzy Matching ---
DOMAIN_SPECIFIC_DICTIONARY = [
    "Patient Name", "Date of Birth", "DOB", "Address", "Medical Record Number", "MRN",
    "Prescription", "Medication", "Dosage", "Frequency", "Refills", "Signature",
    "Doctor", "Physician", "Clinic", "Hospital", "Diagnosis", "Symptoms",
    "Take", "tablet", "capsule", "daily", "twice", "three times", "as needed", "PRN",
    "mg", "ml", "Aspirin", "Lisinopril", "Metformin", "Simvastatin", "Amoxicillin",
    "Tr Belladonna", "Amphotgel" # Added from example
]
FUZZY_MATCH_THRESHOLD = 88


# === OCR and Preprocessing Functions ===
def preprocess_image_for_easyocr(image_path: str) -> Union[np.ndarray, None]:
    """loads and preprocesses an image for easyocr"""
    global cv2, np
    if 'cv2' not in globals() or 'np' not in globals():
        print("error: opencv (cv2) or numpy (np) not imported. cannot preprocess for easyocr.")
        return None
    try:
        img = cv2.imread(image_path)
        if img is None:
            print(f"error: unable to load image at '{image_path}' for easyocr")
            return None
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        alpha, beta = 1.3, 10
        contrast_enhanced = cv2.convertScaleAbs(gray, alpha=alpha, beta=beta)
        _, thresh = cv2.threshold(contrast_enhanced, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        print(f"easyocr preprocessing: applied to {image_path}")
        return thresh
    except Exception as e:
        print(f"error during easyocr preprocessing for '{image_path}': {e}")
        return None

def perform_ocr_easyocr(image_data: np.ndarray) -> Union[str, None]:
    """runs easyocr on preprocessed image data"""
    global easyocr_reader_global, easyocr # To handle conditional import
    if 'easyocr' not in globals():
        print("Error: EasyOCR library not imported.")
        return None
    if image_data is None:
        print("Error: No image data provided for EasyOCR.")
        return None
    try:
        if easyocr_reader_global is None:
            print("Initializing EasyOCR Reader...")
            easyocr_reader_global = easyocr.Reader(["en"], gpu=False)
        print("Performing EasyOCR...")
        results = easyocr_reader_global.readtext(image_data, detail=0)
        extracted_text = "\n".join(results) if results else ""
        print("EasyOCR successful.")
        return extracted_text
    except Exception as e:
        print(f"Error during EasyOCR processing: {e}")
        return None

def encode_image_to_base64(image_path: str) -> Union[str, None]:
    """encodes an image to base64 for api calls"""
    try:
        with open(image_path, "rb") as image_file:
            image_bytes = image_file.read()
            mime_type = "image/jpeg"  # Default
            if image_path.lower().endswith(".png"): mime_type = "image/png"
            elif image_path.lower().endswith((".jpg", ".jpeg")): mime_type = "image/jpeg"
            elif image_path.lower().endswith(".webp"): mime_type = "image/webp"
            else: print(f"Warning: Unknown image type for {image_path}, assuming JPEG.")
            base64_image = base64.b64encode(image_bytes).decode("utf-8")
            return f"data:{mime_type};base64,{base64_image}"
    except FileNotFoundError:
        print(f"Error: Image file not found at '{image_path}'")
        return None
    except Exception as e:
        print(f"Error encoding image '{image_path}': {e}")
        return None

def perform_ocr_openai(image_path: str) -> Union[str, None]:
    """performs ocr using openai's gpt-4 vision model"""
    global openai_client_global, openai
    if 'openai' not in globals():
        print("error: openai library not imported.")
        return None
    if not openai_client_global:
        print("error: openai client not initialized.")
        return None
    print(f"encoding image '{image_path}' for openai api...")
    base64_image_data = encode_image_to_base64(image_path)
    if not base64_image_data: return None
    ocr_prompt_text = (
        "perform ocr on this image. extract all text exactly as it appears, "
        "preserving line breaks and structure where possible."
    )
    print("sending request to openai gpt-4 vision for ocr...")
    try:
        response = openai_client_global.chat.completions.create(
            model="gpt-4-turbo",
            messages=[
                {"role": "user", "content": [
                    {"type": "text", "text": ocr_prompt_text},
                    {"type": "image_url", "image_url": {"url": base64_image_data, "detail": "high"}},
                ]}
            ],
            max_tokens=2000, temperature=0.1
        )
        if response.choices and response.choices[0].message and response.choices[0].message.content:
            extracted_text = response.choices[0].message.content
            print("openai ocr successful.")
            if extracted_text.startswith("```") and extracted_text.endswith("```"):
                extracted_text = re.sub(r'^```[a-zA-Z]*\n', '', extracted_text)
                extracted_text = re.sub(r'\n```$', '', extracted_text)
                extracted_text = extracted_text.strip()
            return extracted_text
        else:
            print("error: openai response did not contain expected text.")
            return None
    except Exception as e:
        print(f"an unexpected error occurred during openai ocr: {e}")
        return None

def get_image_parts_for_gemini(image_path: str) -> Union[Dict[str, Any], None]:
    """reads an image file and prepares it for the gemini api"""
    global Image, io # To handle conditional import
    if 'Image' not in globals() or 'io' not in globals():
        print("Error: PIL (Image) or io not imported. Cannot prepare for Gemini.")
        return None
    try:
        img = Image.open(image_path)
        mime_type = Image.MIME.get(img.format)
        if not mime_type:
            if img.format == "JPEG": mime_type = "image/jpeg"
            elif img.format == "PNG": mime_type = "image/png"
            elif img.format == "WEBP": mime_type = "image/webp"
            else: print(f"Error: Unsupported image format for Gemini: {img.format}"); return None
        img_byte_arr = io.BytesIO()
        img.save(img_byte_arr, format=img.format)
        img_bytes = img_byte_arr.getvalue()
        print(f"Image read successfully for Gemini ({mime_type}).")
        return {"mime_type": mime_type, "data": img_bytes}
    except FileNotFoundError:
        print(f"Error: Image file not found at '{image_path}'")
        return None
    except Exception as e:
        print(f"Error reading image for Gemini '{image_path}': {e}")
        return None

def perform_ocr_gemini(image_path: str) -> Union[str, None]:
    """performs ocr using google's gemini api"""
    global gemini_model_global, genai # To handle conditional import
    if 'genai' not in globals():
        print("Error: Google Generative AI library not imported.")
        return None
    if not gemini_model_global:
        print("Error: Gemini model not initialized.")
        return None

    print(f"Preparing image '{image_path}' for Gemini API...")
    image_parts = get_image_parts_for_gemini(image_path)
    if not image_parts: return None

    ocr_prompt_text = (
        "Perform OCR on this image. Extract all text exactly as it appears, "
        "preserving line breaks and structure where possible."
    )
    print("Sending request to Google Gemini Vision for OCR...")
    try:
        response = gemini_model_global.generate_content([ocr_prompt_text, image_parts])
        if not response.candidates:
            print("Error: Gemini response was blocked or empty.")
            return None
        extracted_text = "".join(part.text for part in response.parts)
        print("Gemini OCR successful.")
        return extracted_text.strip() if extracted_text else ""
    except Exception as e:
        print(f"An error occurred during Gemini OCR: {e}")
        return None
# === END OCR Functions ===


# === Shared Post-processing and API Call Logic ===
def apply_fuzzy_matching(text: str, dictionary: list, threshold: int) -> Union[str, None]:
    """applies fuzzy matching to correct common ocr errors"""
    if not text: return None
    print(f"applying fuzzy matching (threshold={threshold})...")
    corrected_lines = []
    lines = text.split("\n")
    corrections_made = 0
    for line in lines:
        words = line.split()
        corrected_words = []
        for word in words:
            if len(word) < 3 or word.isdigit():
                corrected_words.append(word)
                continue
            best_match, score = process.extractOne(word, dictionary, scorer=fuzz.ratio)
            if score >= threshold and word != best_match:
                if best_match.lower() in ["medication", "prescription"] and len(word) > 4:
                     corrected_words.append(word)
                else:
                    corrected_words.append(best_match)
                    corrections_made += 1
            else:
                corrected_words.append(word)
        corrected_lines.append(" ".join(corrected_words))
    print(f"fuzzy matching complete. made {corrections_made} potential corrections.")
    return "\n".join(corrected_lines)

def get_document_details_from_bluehive(ocr_text: str, user_question: str, bluehive_key: str) -> Union[dict, None]:
    """Sends OCR text and question to the BlueHive completion API."""
    if not ocr_text: print("Error: Cannot call BlueHive API with empty OCR text."); return None
    if not bluehive_key: print("Error: BlueHive API key is missing."); return None

    bh_headers = {"Authorization": f"Bearer {bluehive_key}", "Content-Type": "application/json"}
    prompt = (
        "Below is the OCR text extracted from a medical document "
        "(potentially with minor corrections applied):\n\n"
        f"{ocr_text}\n\n"
        "Based on the above text, please identify the type of document and "
        "extract details such as patient information, medications prescribed (list each medication clearly, if any are present, under a heading like '- Medications Prescribed:\n  - Drug A\n  - Drug B'), " 
        "prescription date, and any other relevant details.\n"
        f"User question: {user_question}"
    )
    payload = {"prompt": prompt, "systemMessage": "You are a helpful AI that analyzes medical documents."}

    print("Sending request to BlueHive API for document analysis...")
    try:
        response = requests.post(BLUEHIVE_API_ENDPOINT, headers=bh_headers, json=payload, timeout=90)
        response.raise_for_status()
        print("BlueHive API call successful.")
        return response.json()
    except requests.exceptions.Timeout:
        print("BlueHive API request timed out.")
        return {"error": "BlueHive API request timed out"}
    except requests.exceptions.HTTPError as e:
        print(f"BlueHive API HTTP Error: {e.response.status_code} for URL: {e.request.url}")
        return {"error": f"BlueHive API request failed with status {e.response.status_code}: {e.response.text}"}
    except requests.exceptions.RequestException as e:
        print(f"BlueHive API Request failed: {e}")
        return {"error": f"BlueHive API request failed: {e}"}
    except json.JSONDecodeError:
        print("Error parsing JSON response from BlueHive.")
        return {"error": "Failed to parse JSON response from BlueHive"}
# === END Shared Logic ===


# --- MCP Client Function ---
async def get_detailed_med_info_via_mcp(
    medication_names: List[str], 
    mcp_server_script_path: str 
) -> Dict[str, Any]:
    """
    Calls the MCP server's tool.
    """
    mcp_server_command_executable = "python3" 
    mcp_server_command_args = [mcp_server_script_path]
    all_med_profiles: Dict[str, Any] = {}
    
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    
    server_params = StdioServerParameters(
        command=mcp_server_command_executable,
        args=mcp_server_command_args,
        cwd=project_root 
    )

    print(f"\nMCP Client: Attempting to start MCP server with: {mcp_server_command_executable} {' '.join(mcp_server_command_args)} in CWD: {project_root}")

    actual_client_session: Union[ClientSession, None] = None 
    try:
        async with stdio_client(server_params) as yielded_value:
            # --- DEBUGGING: Print type and content of yielded_value ---
            print(f"MCP Client: stdio_client yielded type: {type(yielded_value)}")
            if isinstance(yielded_value, tuple):
                print(f"MCP Client: stdio_client yielded a tuple with {len(yielded_value)} elements.")
                for i, item in enumerate(yielded_value):
                    print(f"  Tuple item {i}: type={type(item)}, value={str(item)[:200]}...") # Print first 200 chars of str
                    if isinstance(item, ClientSession):
                        actual_client_session = item
                        print(f"  Tuple item {i} IS a ClientSession.")
            elif isinstance(yielded_value, ClientSession):
                actual_client_session = yielded_value
                print("MCP Client: stdio_client yielded ClientSession directly.")
            else:
                print(f"MCP Client: Error - stdio_client did not yield a ClientSession or a discoverable tuple. Got: {type(yielded_value)}")
                for drug_name in medication_names:
                    all_med_profiles[drug_name] = {"error": f"MCP session invalid type from stdio_client: {type(yielded_value)}", "details": "MCP server connection failed."}
                return all_med_profiles

            if not isinstance(actual_client_session, ClientSession):
                 print(f"MCP Client: Error - could not obtain a valid ClientSession. Last type checked: {type(actual_client_session)}")
                 for drug_name in medication_names:
                     all_med_profiles[drug_name] = {"error": f"MCP session not obtained. Last type: {type(actual_client_session)}", "details": "MCP server connection failed."}
                 return all_med_profiles
            # --- END DEBUGGING ---

            print("MCP Client: Connection established with ClientSession. Proceeding to call tool...")
            
            test_input_text = "Hello from MCP Client"
            if not medication_names: 
                medication_names_to_test_dummy = [test_input_text]
            else: 
                medication_names_to_test_dummy = medication_names 


            for test_name in medication_names_to_test_dummy: 
                print(f"MCP Client: Calling MCP tool 'simple_test_tool' with input: '{test_name}'...")
                try:
                    profile = await actual_client_session.use_tool( 
                        "simple_test_tool", 
                        parameters={
                            "input_text": test_name, 
                        }
                    )
                    all_med_profiles[test_name] = profile 
                except Exception as e_tool:
                    print(f"MCP Client: Error calling 'simple_test_tool' for '{test_name}': {e_tool}")
                    all_med_profiles[test_name] = {"error": str(e_tool), "details": "Failed to call simple_test_tool."}
    
    except Exception as e_connect:
        print(f"MCP Client: Critical error starting or connecting to MCP server: {e_connect}")
        error_payload = {"error": str(e_connect), "details": "MCP server connection/startup failed."}
        if not medication_names:
            all_med_profiles["dummy_tool_test_connection_error"] = error_payload
        else:
            for drug_name in medication_names:
                all_med_profiles[drug_name] = error_payload
            
    return all_med_profiles

def parse_meds_from_bluehive_response(bluehive_response_content: str) -> List[str]:
    """
    Extracts medication names from BlueHive's response content.
    """
    medications: List[str] = []
    print("\nParsing medications from BlueHive response...")

    no_meds_phrases = [
        "does not list any medications prescribed",
        "no medications listed",
        "no medication information provided",
        "document does not list any medications" 
    ]
    if any(phrase in bluehive_response_content.lower() for phrase in no_meds_phrases):
        print("BlueHive response indicates no medications prescribed.")
        return []

    try:
        med_section_regex = r"(?:\*\*|-)?[Mm]edications [Pp]rescribed(?:\*\*|:)?[^\n]*\n((?:[\s]*-\s*.+(?:\n|$))+)"
        match = re.search(med_section_regex, bluehive_response_content, re.IGNORECASE | re.MULTILINE)

        if match:
            meds_text_block = match.group(1) 
            print(f"Found medication block:\n{meds_text_block.strip()}")
            
            potential_med_lines = meds_text_block.strip().split('\n')
            for line in potential_med_lines:
                line_content = line.strip()
                item_match = re.match(r"^\s*-\s*(.+)", line_content)
                if item_match:
                    med_name_candidate = item_match.group(1).strip()
                    
                    med_name_parts = re.split(
                        r'\s+\(|\s+with\s|\s+\d+(\.\d+)?\s*(mg|ml|mcg|g|unit|tablets?|capsules?|puffs?|drops?|applications?)|'
                        r'\s+(once|twice|three times|four times|daily|every|as needed|q\.?d\.?|b\.?i\.?d\.?|t\.?i\.?d\.?|q\.?i\.?d\.?|p\.?r\.?n\.?)',
                        med_name_candidate, 
                        maxsplit=1, 
                        flags=re.IGNORECASE
                    )
                    cleaned_med_name = med_name_parts[0].strip().rstrip(',').rstrip('.')
                    
                    if cleaned_med_name and len(cleaned_med_name) > 2: 
                        generic_terms_to_avoid = ["medication", "prescription", "drug", "details", "name", "patient", "instructions", "dosage"]
                        if cleaned_med_name.lower() not in generic_terms_to_avoid:
                            is_likely_non_drug_header = any(
                                header.lower() in cleaned_med_name.lower() for header in 
                                ["Patient Name", "Date of Birth", "Address", "Doctor", "Clinic", "Hospital", "Diagnosis"]
                            )
                            if not is_likely_non_drug_header:
                                medications.append(cleaned_med_name)
                            else:
                                print(f"Skipping '{cleaned_med_name}' as it looks like a header/non-drug term from line: '{line_content}'")
                        else:
                            print(f"Skipping generic term: '{cleaned_med_name}' from line: '{line_content}'")
                    else:
                        print(f"Skipping short/empty candidate: '{cleaned_med_name}' from line: '{line_content}'")
        else:
            print("Medication section pattern not found in BlueHive response.")

    except Exception as e:
        print(f"Error during medication parsing: {e}")

    unique_medications = sorted(list(set(m.strip() for m in medications if m.strip())))
    print(f"Finished parsing. Extracted medications: {unique_medications}")
    return unique_medications
# --- END MCP Client Function ---


def main_pipeline(ocr_method_choice: str, image_file_path: str):
    """Main pipeline execution function."""
    global easyocr, cv2, np, openai, genai, Image, io 
    global openai_client_global, gemini_model_global, easyocr_reader_global

    if ocr_method_choice == "easyocr":
        if 'easyocr' not in globals(): import easyocr
        if 'cv2' not in globals(): import cv2
        if 'np' not in globals(): import numpy as np
        if easyocr_reader_global is None: 
            print("Initializing EasyOCR Reader for pipeline...")
            easyocr_reader_global = easyocr.Reader(["en"], gpu=False)
    elif ocr_method_choice == "openai":
        if 'openai' not in globals(): import openai
        if not openai_client_global and OPENAI_API_KEY:
            print("Initializing OpenAI client for pipeline...")
            try: openai_client_global = openai.OpenAI(api_key=OPENAI_API_KEY)
            except Exception as e: print(f"Failed to initialize OpenAI client: {e}"); sys.exit(1)
        elif not OPENAI_API_KEY: print("Error: OpenAI API Key missing."); sys.exit(1)
    elif ocr_method_choice == "gemini":
        if 'genai' not in globals(): import google.generativeai as genai
        if 'Image' not in globals(): from PIL import Image
        if 'io' not in globals(): import io
        if not gemini_model_global and GOOGLE_API_KEY:
            print("Initializing Google Gemini client for pipeline...")
            try:
                genai.configure(api_key=GOOGLE_API_KEY)
                gemini_model_global = genai.GenerativeModel("gemini-1.5-pro-latest")
                print(f"Using Gemini model: {gemini_model_global.model_name}")
            except Exception as e: print(f"Failed to initialize Google Gemini client: {e}"); sys.exit(1)
        elif not GOOGLE_API_KEY: print("Error: Google API Key missing."); sys.exit(1)

    user_question_for_bluehive = (
        "Can you provide the document type and extract details such as the "
        "patient's name, medications prescribed (list each medication clearly, if any are present, under a heading like '- Medications Prescribed:\n  - Drug A\n  - Drug B'), "
        "and the prescription date?" 
    )

    print(f"\n--- Starting Analysis for {image_file_path} ---")
    print(f"--- Using OCR Method: {ocr_method_choice} ---")

    raw_ocr_text = None

    print("\n--- Step 1: Performing OCR ---")
    if ocr_method_choice == "easyocr":
        preprocessed_data = preprocess_image_for_easyocr(image_file_path)
        if preprocessed_data is None: print("EasyOCR Preprocessing failed. Exiting."); sys.exit(1)
        raw_ocr_text = perform_ocr_easyocr(preprocessed_data)
    elif ocr_method_choice == "openai":
        raw_ocr_text = perform_ocr_openai(image_file_path)
    elif ocr_method_choice == "gemini":
        raw_ocr_text = perform_ocr_gemini(image_file_path)
    else: 
        print(f"Error: Invalid OCR_METHOD: '{ocr_method_choice}'")
        sys.exit(1)

    if raw_ocr_text is None: print("OCR failed or returned no result. Exiting."); sys.exit(1)
    if not raw_ocr_text: print("Warning: OCR returned empty text.")
    if raw_ocr_text.startswith("Here is the extracted text from the image:"):
        raw_ocr_text = raw_ocr_text.replace("Here is the extracted text from the image:", "").strip()
    
    print("\n--- Raw Extracted OCR text (Cleaned) ---")
    print(raw_ocr_text)
    print("-" * 30)

    print("\n--- Step 2: Applying Fuzzy Matching ---")
    corrected_ocr_text = apply_fuzzy_matching(
        raw_ocr_text, DOMAIN_SPECIFIC_DICTIONARY, FUZZY_MATCH_THRESHOLD
    )
    if corrected_ocr_text is None:
        print("Fuzzy matching returned None, using raw OCR text for BlueHive.")
        corrected_ocr_text = raw_ocr_text
    print("\n--- Corrected OCR text (after fuzzy matching) ---")
    print(corrected_ocr_text)
    print("-" * 30)

    text_to_send_to_bluehive = corrected_ocr_text
    print("\n--- Step 3: Sending to BlueHive API for Document Analysis ---")
    bluehive_result = get_document_details_from_bluehive(
        text_to_send_to_bluehive, user_question_for_bluehive, SECRET_KEY
    )

    extracted_medications: List[str] = []
    if bluehive_result:
        print("\n--- BlueHive AI API Response ---")
        if isinstance(bluehive_result, dict) and "error" in bluehive_result:
            print(f"BlueHive API Error: {bluehive_result['error']}")
            if "raw_response" in bluehive_result:
                print(f"Raw response snippet: {bluehive_result['raw_response'][:500]}...")
        else:
            print(json.dumps(bluehive_result, indent=2))
            if bluehive_result.get("choices") and bluehive_result["choices"][0].get("message"):
                bluehive_content = bluehive_result["choices"][0]["message"].get("content", "")
                extracted_medications = parse_meds_from_bluehive_response(bluehive_content)
    else:
        print("No valid result returned from BlueHive API.")
    
    print("\n--- Step 4: Fetching Info via MCP Server (using dummy tool for this test) ---")
    project_root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    mcp_server_script_name = "mcp_med_info_server.py" 
    mcp_server_full_path = os.path.join(project_root_dir, mcp_server_script_name)
    
    if not os.path.exists(mcp_server_full_path):
        print(f"MCP Client: ERROR - MCP server script not found at: {mcp_server_full_path}")
    else:
        dummy_tool_inputs = extracted_medications if extracted_medications else ["TestInput1_NoMedsFound", "TestInput2_NoMedsFound"]

        detailed_med_infos = asyncio.run(
            get_detailed_med_info_via_mcp(dummy_tool_inputs, mcp_server_full_path)
        )
        print("\n--- MCP Server - Tool Call Results ---")
        for input_val, profile_data in detailed_med_infos.items():
            print(f"\nResult for input '{input_val}':")
            print(json.dumps(profile_data, indent=2))
            print("-" * 20)
            
    print("\n--- Full Analysis Complete ---")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description=(
            "Perform OCR on an image, analyze with BlueHive API, "
            "and fetch detailed medication info via local MCP server."
        )
    )
    parser.add_argument("image_path", help="Path to the input image file.")
    parser.add_argument(
        "-m", "--method",
        choices=["easyocr", "openai", "gemini"],
        required=True,
        help="Select the OCR method to use.",
    )
    args = parser.parse_args()

    core_libraries_ok = True
    try:
        import requests; import json; import sys; import os; from typing import Union, List, Dict, Any
        from dotenv import load_dotenv; from thefuzz import fuzz; import argparse; import asyncio; import re
        from mcp.client.stdio import stdio_client 
        from mcp import StdioServerParameters     
        from mcp.client.session import ClientSession 
        print("Core libraries OK.")
    except ImportError as e:
        print(f"Error: Missing a core library: {e}")
        print("Please install: pip install requests python-levenshtein thefuzz python-dotenv mcp[cli] Pillow") 
        core_libraries_ok = False
        sys.exit(1)

    keys_ok = True
    if not SECRET_KEY:
        print("\nCRITICAL WARNING: BlueHive API Key (BLUEHIVE_API_KEY) not found in .env.")
        SECRET_KEY = "BHSK-sandbox-d6TDZyX2PAVq6qL3IdMX8n8sA7bXe8DM_RWOq-8j" 
        print(f"Using BlueHive sandbox key: {SECRET_KEY[:15]}...")
    else:
        print(f"BlueHive API Key found: {SECRET_KEY[:15]}...")

    if args.method == "openai" and not OPENAI_API_KEY:
        print("\nCRITICAL WARNING: OpenAI API Key (OPENAI_API_KEY) not found for selected method.")
        keys_ok = False
    elif args.method == "gemini" and not GOOGLE_API_KEY:
        print("\nCRITICAL WARNING: Google API Key (GOOGLE_API_KEY) not found for selected method.")
        keys_ok = False
    
    if not keys_ok and args.method in ["openai", "gemini"]:
        sys.exit("Exiting due to missing API key for the selected OCR method.")

    print(f"Proceeding with OCR method: {args.method}")
    main_pipeline(ocr_method_choice=args.method, image_file_path=args.image_path)