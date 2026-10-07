"""
Auth middleware / decorator
Protects routes that require a valid JWT Bearer token
"""
import functools
from flask import request, jsonify, g
from services.jwt_service import decode_token


def auth_required(f):
    """
    Decorator: requires a valid Bearer token in the Authorization header.
    Sets g.identity_id so the route handler can access the current user.
    """
    @functools.wraps(f)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Authentication required.', 'code': 'UNAUTHORIZED'}), 401

        token = auth_header.split(' ', 1)[1].strip()
        payload = decode_token(token)

        if not payload:
            return jsonify({'error': 'Token is invalid or expired.', 'code': 'UNAUTHORIZED'}), 401

        g.identity_id = payload.get('sub')
        g.token_payload = payload
        return f(*args, **kwargs)

    return wrapper


def optional_auth(f):
    """
    Decorator: loads identity from JWT if present, but doesn't block the request.
    Sets g.identity_id = None if not authenticated.
    """
    @functools.wraps(f)
    def wrapper(*args, **kwargs):
        g.identity_id = None
        g.token_payload = None
        auth_header = request.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            token = auth_header.split(' ', 1)[1].strip()
            payload = decode_token(token)
            if payload:
                g.identity_id = payload.get('sub')
                g.token_payload = payload
        return f(*args, **kwargs)

    return wrapper
