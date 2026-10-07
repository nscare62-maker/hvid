"""
JWT Service
Token generation and verification for authenticated sessions
"""
import jwt
import logging
from datetime import datetime, timedelta
from flask import current_app

logger = logging.getLogger(__name__)


def generate_token(identity_id: str, extra_claims: dict = None) -> str:
    """
    Generate a signed JWT for the given identity.

    Payload includes:
        sub        - identity_id
        iat        - issued at
        exp        - expiry (7 days by default)
        + any extra_claims provided
    """
    secret   = current_app.config['JWT_SECRET_KEY']
    expires  = current_app.config.get('JWT_ACCESS_TOKEN_EXPIRES', timedelta(days=7))
    exp_time = datetime.utcnow() + expires

    payload = {
        'sub': identity_id,
        'iat': datetime.utcnow(),
        'exp': exp_time,
    }

    if extra_claims:
        payload.update(extra_claims)

    token = jwt.encode(payload, secret, algorithm='HS256')
    return token


def decode_token(token: str) -> dict | None:
    """
    Decode and verify a JWT.

    Returns the payload dict on success, None if invalid/expired.
    """
    secret = current_app.config['JWT_SECRET_KEY']
    try:
        payload = jwt.decode(token, secret, algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        logger.debug("JWT expired")
        return None
    except jwt.InvalidTokenError as e:
        logger.debug(f"Invalid JWT: {e}")
        return None


def get_identity_id_from_token(token: str) -> str | None:
    """Extract identity_id (sub claim) from a valid JWT."""
    payload = decode_token(token)
    if payload:
        return payload.get('sub')
    return None
