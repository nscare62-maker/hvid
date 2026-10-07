"""
OTP Service — clean rewrite
Generates, stores and validates one-time passwords.
"""
import os
import hashlib
import hmac
import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

# Fixed salts — change these in production
_PHONE_SALT = b'hvid-phone-salt-2024'
_OTP_SALT   = b'hvid-otp-salt-2024'


def generate_otp(length: int = 6) -> str:
    """
    Generate a cryptographically secure numeric OTP using os.urandom.
    Avoids any seeding issues with random module.
    """
    # Generate random bytes and convert to a numeric string
    number = int.from_bytes(os.urandom(4), 'big') % (10 ** length)
    return str(number).zfill(length)


def normalize_phone(phone: str) -> str:
    """Normalize Indian mobile numbers to a single canonical format.
    Accepts values like 1223344556, +911223344556, 911223344556, 01223344556.
    Returns a canonical string like +911223344556.
    """
    import re

    if phone is None:
        return ''

    cleaned = re.sub(r'\s+', '', str(phone).strip())
    if not cleaned:
        return ''

    if cleaned.startswith('00'):
        cleaned = '+' + cleaned[2:]

    digits = re.sub(r'\D', '', cleaned)
    if not digits:
        return ''

    # Common Indian mobile normalization
    if len(digits) == 10:
        return f'+91{digits}'
    if len(digits) == 11 and digits.startswith('0'):
        return f'+91{digits[1:]}'
    if len(digits) == 12 and digits.startswith('91'):
        return f'+{digits}'
    if len(digits) > 10 and digits.startswith('91'):
        return f'+{digits}'

    return f'+{digits}'


def hash_phone(phone: str) -> str:
    """Normalize and HMAC-SHA256 hash a phone number."""
    normalized = normalize_phone(phone)
    return hmac.new(_PHONE_SALT, normalized.encode('utf-8'), hashlib.sha256).hexdigest()


def hash_otp(otp: str) -> str:
    """HMAC-SHA256 hash an OTP code."""
    return hmac.new(_OTP_SALT, otp.strip().encode('utf-8'), hashlib.sha256).hexdigest()


def verify_otp(entered: str, stored_hash: str) -> bool:
    """
    Constant-time comparison to prevent timing attacks.
    Returns True only if entered OTP matches the stored hash.
    """
    if not entered or not stored_hash:
        return False
    entered_hash = hash_otp(entered.strip())
    return hmac.compare_digest(entered_hash, stored_hash)


def otp_expiry(minutes: int = 20) -> datetime:
    """Return UTC expiry datetime from now."""
    return datetime.utcnow() + timedelta(minutes=minutes)
