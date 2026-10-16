"""
Identity Routes
GET   /api/identity/:id        - Get identity details
PATCH /api/identity/:id/type   - Change identity type
"""
import logging
from flask import Blueprint, request, jsonify, g
from extensions import db
from models import Identity, Asset
from middleware.auth_required import auth_required, optional_auth

bp = Blueprint('identity', __name__)
logger = logging.getLogger(__name__)

VALID_TYPES = {'PERSONAL', 'PROFESSIONAL', 'BUSINESS'}


@bp.route('/<identity_id>', methods=['GET'])
@optional_auth
def get_identity(identity_id):
    """
    Get public identity details by ID.
    Returns assets list (without value hashes).
    """
    identity = Identity.query.get(identity_id)
    if not identity or not identity.is_active:
        return jsonify({'error': 'Identity not found.'}), 404

    assets = [a.to_public_dict() for a in identity.assets.all()]

    return jsonify({
        'id':                 identity.id,
        'username':           identity.username,
        'email':              identity.email,
        'phone_last4':        identity.phone_last4,
        'status':             identity.identity_state,
        'verificationLevel':  identity.verification_level,
        'identity_type':      identity.identity_type,
        'trust_signal':       identity.trust_signal,
        'tier':               identity.tier,
        'assets':             assets,
        'created_at':         identity.created_at.isoformat() if identity.created_at else None,
        'last_verified_at':   identity.last_verified_at.isoformat() if identity.last_verified_at else None,
    }), 200


@bp.route('/<identity_id>/type', methods=['PATCH'])
@auth_required
def update_identity_type(identity_id):
    """
    Update identity type. Only the identity owner can change their type.
    Body: { type: "PERSONAL" | "PROFESSIONAL" | "BUSINESS" }
    """
    # Only allow own identity
    if g.identity_id != identity_id:
        return jsonify({'error': 'Forbidden.'}), 403

    identity = Identity.query.get(identity_id)
    if not identity or not identity.is_active:
        return jsonify({'error': 'Identity not found.'}), 404

    data = request.get_json(silent=True) or {}
    new_type = (data.get('type') or '').strip().upper()

    if new_type not in VALID_TYPES:
        return jsonify({'error': f'Invalid identity type. Must be one of: {", ".join(VALID_TYPES)}'}), 400

    identity.identity_type = new_type

    # Recalculate trust signal based on type and verification level
    identity.trust_signal = _compute_trust_signal(identity)

    db.session.commit()

    return jsonify({
        'id':           identity.id,
        'identity_type': identity.identity_type,
        'trust_signal':  identity.trust_signal,
        'status':        identity.identity_state,
    }), 200


@bp.route('/<identity_id>/username', methods=['PATCH'])
@auth_required
def update_username(identity_id):
    """
    Set or update username for the identity.
    Body: { username: "myusername" }
    """
    if g.identity_id != identity_id:
        return jsonify({'error': 'Forbidden.'}), 403

    identity = Identity.query.get(identity_id)
    if not identity or not identity.is_active:
        return jsonify({'error': 'Identity not found.'}), 404

    data = request.get_json(silent=True) or {}
    username = (data.get('username') or '').strip()

    if not username:
        return jsonify({'error': 'Username is required.'}), 400

    if len(username) < 3 or len(username) > 32:
        return jsonify({'error': 'Username must be between 3 and 32 characters.'}), 400

    import re
    if not re.match(r'^[a-zA-Z0-9_.-]+$', username):
        return jsonify({'error': 'Username can only contain letters, numbers, _, ., and -.'}), 400

    # Check uniqueness
    existing = Identity.query.filter_by(username=username).first()
    if existing and existing.id != identity_id:
        return jsonify({'error': 'That username is already taken.'}), 409

    identity.username = username
    db.session.commit()

    return jsonify({
        'id':       identity.id,
        'username': identity.username,
    }), 200


def _compute_trust_signal(identity: Identity) -> str:
    """Derive trust signal from verification level and state."""
    if identity.identity_state in ('SUSPENDED', 'REVOKED'):
        return 'FLAGGED'
    level = identity.verification_level
    if level >= 3:
        return 'HIGH'
    if level >= 2:
        return 'VERIFIED'
    if level >= 1:
        return 'BASIC'
    return 'UNVERIFIED'


@bp.route('/<identity_id>/signal', methods=['GET'])
@optional_auth
def get_signal(identity_id):
    """
    GET /api/identity/:id/signal
    Returns the current trust signal for the identity.
    Used by signal-status.js on the dashboard.
    """
    identity = Identity.query.get(identity_id)
    if not identity or not identity.is_active:
        return jsonify({'trust_signal': 'UNVERIFIED', 'signal': 'STABLE'}), 200

    # Map internal trust_signal to signal-status.js expected values
    signal_map = {
        'HIGH':       'STABLE',
        'VERIFIED':   'STABLE',
        'BASIC':      'STABLE',
        'UNVERIFIED': 'STABLE',
        'FLAGGED':    'UNDER_REVIEW',
        'SUSPENDED':  'SUSPENDED',
        'LIMITED':    'LIMITED',
    }
    raw    = identity.trust_signal or 'UNVERIFIED'
    mapped = signal_map.get(raw, 'STABLE')

    if identity.identity_state == 'SUSPENDED':
        mapped = 'SUSPENDED'
    elif identity.identity_state in ('LIMITED', 'REVERIFY_REQUIRED'):
        mapped = 'REQUIRES_REVALIDATION'

    return jsonify({
        'trust_signal': raw,
        'signal':       mapped,
    }), 200


@bp.route('/<identity_id>/trust-signals', methods=['GET'])
@optional_auth
def get_trust_signals(identity_id):
    """
    GET /api/identity/:id/trust-signals
    Returns structured trust signals for the trust-badge.js component.
    """
    identity = Identity.query.get(identity_id)
    if not identity or not identity.is_active:
        return jsonify({
            'verification': 'UNVERIFIED',
            'status':       'UNVERIFIED',
            'stability':    'Stable',
        }), 200

    level = identity.verification_level
    state = identity.identity_state

    verification = 'UNVERIFIED'
    if level >= 2:
        verification = 'VERIFIED'
    elif level >= 1:
        verification = 'BASIC'

    status = 'UNVERIFIED'
    if state == 'SUSPENDED':
        status = 'SUSPENDED'
    elif state == 'LIMITED':
        status = 'LIMITED'
    elif state == 'VERIFIED':
        status = 'VERIFIED'

    stability = 'Stable'
    if identity.flag_count and identity.flag_count > 0:
        stability = 'Under Review'

    return jsonify({
        'verification': verification,
        'status':       status,
        'stability':    stability,
    }), 200
