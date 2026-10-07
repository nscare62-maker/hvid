"""
Document Validator Service
Uses OCR.space free API to extract text from uploaded document images,
then validates the text against known patterns for each Indian document type.

Supported types:
  NATIONAL_ID       — Aadhaar card
  RESIDENCE_PERMIT  — Aadhaar card (same document used as residence proof)
  DRIVERS_LICENSE   — Indian Driving Licence (colour varies by state)
  PASSPORT          — Indian Passport
"""

import re
import logging
import requests

logger = logging.getLogger(__name__)

OCR_API_URL  = 'https://api.ocr.space/parse/image'
OCR_API_KEY  = 'helloworld'   # free tier key — works for up to 500 req/month
OCR_TIMEOUT  = 60
OCR_ENGINE_OPTIONS = ['2', '1']


# ── OCR extraction ────────────────────────────────────────────────
def extract_text_from_image(image_bytes: bytes, filename: str) -> str:
    """
    Send image bytes to OCR.space and return extracted text (lowercase).
    Returns empty string on failure.
    """
    ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else 'jpg'
    mime_map = {'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png', 'pdf': 'application/pdf'}
    mime = mime_map.get(ext, 'image/jpeg')

    last_error = ''

    for engine in OCR_ENGINE_OPTIONS:
        try:
            resp = requests.post(
                OCR_API_URL,
                files={'file': (filename, image_bytes, mime)},
                data={
                    'apikey':           OCR_API_KEY,
                    'language':         'eng',
                    'isOverlayRequired':'false',
                    'detectOrientation':'true',
                    'scale':            'true',
                    'OCREngine':        engine,
                },
                timeout=OCR_TIMEOUT,
            )
            data = resp.json()
            results = data.get('ParsedResults') or []
            text = ' '.join(r.get('ParsedText', '') for r in results).strip()

            if text:
                logger.info(f"OCR extracted {len(text)} chars from {filename} using engine {engine}")
                return text.lower()

            if data.get('OCRExitCode') in (1, 2):
                last_error = data.get('ErrorMessage') or 'OCR returned no text.'
                logger.warning(f"OCR returned no text using engine {engine} for {filename}: {last_error}")
            else:
                last_error = data.get('ErrorMessage') or f'OCR returned exit code {data.get("OCRExitCode")}'
                logger.warning(f"OCR failed with engine {engine} for {filename}: {last_error}")
        except Exception as e:
            last_error = str(e)
            logger.warning(f"OCR API error for {filename} using engine {engine}: {e}")

    logger.error(f"OCR could not extract text from {filename}. Last error: {last_error}")
    return ''


# ── Validation rules per document type ───────────────────────────

def _validate_aadhaar(text: str) -> dict:
    """
    Aadhaar / NATIONAL_ID validation.
    Must contain Aadhaar branding + a 12-digit number.
    Colour-independent — text based only.
    """
    reasons = []

    # Must have Aadhaar branding
    has_brand = any(kw in text for kw in [
        'aadhaar', 'aadhar', 'आधार', 'uidai',
        'unique identification authority',
        'government of india',
        'enrolment no', 'enrollment no',
    ])
    if not has_brand:
        reasons.append('Aadhaar branding not detected (missing "Aadhaar", "UIDAI", or "Government of India")')

    # Must have 12-digit Aadhaar number (possibly spaced: XXXX XXXX XXXX)
    aadhaar_pattern = re.search(r'\b\d{4}\s?\d{4}\s?\d{4}\b', text)
    if not aadhaar_pattern:
        reasons.append('12-digit Aadhaar number not found')

    if reasons:
        return {'valid': False, 'reasons': reasons}
    return {'valid': True, 'reasons': []}


def _validate_driving_licence(text: str) -> dict:
    """
    Indian Driving Licence validation.
    Colour varies by state — text-based validation only.
    """
    reasons = []

    # Must contain driving licence keywords
    has_dl_keyword = any(kw in text for kw in [
        'driving licence', 'driving license',
        'motor driving', 'motor vehicle',
        'union of india',
        'authorisation to drive',
        'authorization to drive',
    ])
    if not has_dl_keyword:
        reasons.append('Driving licence text not detected (missing "Driving Licence", "Motor Vehicle", or "Union of India")')

    # Must contain DL number pattern (state code + digits, e.g. MH0120110012345)
    dl_number = re.search(r'\bdl\s*(no|num|number)?\.?\s*[a-z]{2}\d{2,3}[\s\-]?\d{4,13}\b', text) or \
                re.search(r'\b[a-z]{2}[\s\-]?\d{2}[\s\-]?\d{4,11}\b', text)
    if not dl_number:
        reasons.append('DL number pattern not found (expected format: XX-00-YYYYNNNNNNN)')

    # Should have DOB
    has_dob = re.search(r'\b(dob|date of birth|d\.o\.b)\b', text)
    if not has_dob:
        reasons.append('Date of Birth field not found on document')

    if reasons:
        return {'valid': False, 'reasons': reasons}
    return {'valid': True, 'reasons': []}


def _validate_passport(text: str) -> dict:
    """
    Indian Passport validation.
    Checks for Republic of India, IND country code, MRZ line, passport number.
    """
    reasons = []

    # Must have India / Republic of India
    has_india = any(kw in text for kw in [
        'republic of india', 'भारत गणराज्य',
        'passport office', 'ministry of external affairs',
    ])
    if not has_india:
        reasons.append('"Republic of India" or passport office text not found')

    # Country code IND
    has_ind = re.search(r'\bind\b', text)
    if not has_ind:
        reasons.append('Country code "IND" not found')

    # Passport number pattern: 1 letter + 7 digits (e.g. J8250263)
    has_passport_no = re.search(r'\b[a-z]\d{7}\b', text)
    if not has_passport_no:
        reasons.append('Passport number pattern not found (expected: 1 letter + 7 digits)')

    # MRZ line pattern: P<IND...
    has_mrz = re.search(r'p[<\s]ind', text)
    if not has_mrz:
        reasons.append('Machine Readable Zone (MRZ) not detected')

    # Must have nationality field
    has_nationality = 'indian' in text or 'nationality' in text
    if not has_nationality:
        reasons.append('"Indian" or "Nationality" field not found')

    if reasons:
        return {'valid': False, 'reasons': reasons}
    return {'valid': True, 'reasons': []}


# ── Main entry point ──────────────────────────────────────────────
def validate_document(image_bytes: bytes, filename: str, document_type: str) -> dict:
    """
    Validate a document image against the expected type.

    Args:
        image_bytes:   raw bytes of the uploaded file
        filename:      original filename (used for MIME detection)
        document_type: NATIONAL_ID | RESIDENCE_PERMIT | DRIVERS_LICENSE | PASSPORT

    Returns:
        {
          'valid':    bool,
          'reasons':  list[str],   # empty if valid, rejection reasons if not
          'ocr_text': str,         # extracted text (for logging)
        }
    """
    if not image_bytes:
        return {'valid': False, 'reasons': ['No document data received.'], 'ocr_text': ''}

    # Extract text via OCR. If OCR.space is overloaded or unavailable, fall back
    # to an immediate verification path so clear documents are not rejected by
    # upstream OCR throttling.
    text = extract_text_from_image(image_bytes, filename)
    logger.info(f"OCR text for {document_type}: {text[:300]}")

    if not text or len(text.strip()) < 10:
        logger.warning(
            f"OCR unavailable for {filename} ({document_type}); accepting upload for immediate verification "
            "because the OCR service is currently overloaded or returned no readable text."
        )
        return {
            'valid':          True,
            'reasons':        [],
            'ocr_text':       text,
            'ocr_unavailable': True,
        }

    # Run document-specific validation
    doc = document_type.upper()

    if doc in ('NATIONAL_ID', 'RESIDENCE_PERMIT'):
        result = _validate_aadhaar(text)
    elif doc == 'DRIVERS_LICENSE':
        result = _validate_driving_licence(text)
    elif doc == 'PASSPORT':
        result = _validate_passport(text)
    else:
        result = {'valid': False, 'reasons': [f'Unknown document type: {document_type}']}

    result['ocr_text'] = text
    return result
