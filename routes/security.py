"""
Security Routes
GET  /api/security/status/:identityId     - Get security status
POST /api/security/recover/start          - Start account recovery
POST /api/security/recover/complete       - Complete account recovery
"""
import logging
from flask import Blueprint, request, jsonify, g
from extensions import db
from models import Identity
from middleware.auth_required import auth_required

bp = Blueprint('security', __name__)
logger = logging.getLogger(__name__)


@bp.route('/freeze', methods=['POST'])
@auth_required
def freeze_identity():
    """
    Freeze/suspend an identity.
    Body: { identity_id?: string, reason?: string }
    """
    data = request.get_json(silent=True) or {}
    identity_id = (data.get('identity_id') or g.identity_id or '').strip()
    reason = (data.get('reason') or 'User initiated freeze').strip()

    if not identity_id:
        return jsonify({'error': 'identity_id is required.'}), 400

    if g.identity_id != identity_id:
        return jsonify({'error': 'Forbidden.'}), 403

    identity = Identity.query.get(identity_id)
    if not identity:
        return jsonify({'error': 'Identity not found.'}), 404

    identity.identity_state = 'SUSPENDED'
    identity.trust_signal = 'SUSPENDED'
    db.session.commit()

    logger.info(f"Identity {identity_id} frozen: {reason}")
    return jsonify({
        'success': True,
        'message': 'Identity frozen successfully.',
        'status': identity.identity_state,
    }), 200


@bp.route('/status/<identity_id>', methods=['GET'])
def get_security_status(identity_id):
    """Get security status for an identity."""
    identity = Identity.query.get(identity_id)
    if not identity:
        return jsonify({'error': 'Identity not found.'}), 404

    return jsonify({
        'status':       identity.identity_state,
        'lastActivity': identity.last_login_at.isoformat() if identity.last_login_at else None,
        'flagCount':    identity.flag_count,
    }), 200


@bp.route('/recover/start', methods=['POST'])
def start_recovery():
    """Initiate account recovery flow."""
    data = request.get_json(silent=True) or {}
    identity_id = (data.get('identity_id') or '').strip()

    if not identity_id:
        return jsonify({'error': 'identity_id is required.'}), 400

    identity = Identity.query.get(identity_id)
    if not identity:
        return jsonify({'error': 'Identity not found.'}), 404

    # In production: send a recovery SMS / email and set a recovery token
    logger.info(f"Recovery started for identity {identity_id}")

    return jsonify({
        'success': True,
        'message': 'Recovery process initiated. Follow the instructions sent to your phone.',
    }), 200


@bp.route('/recover/complete', methods=['POST'])
def complete_recovery():
    """Complete the account recovery and re-activate the identity."""
    data = request.get_json(silent=True) or {}
    identity_id = (data.get('identity_id') or '').strip()

    if not identity_id:
        return jsonify({'error': 'identity_id is required.'}), 400

    identity = Identity.query.get(identity_id)
    if not identity:
        return jsonify({'error': 'Identity not found.'}), 404

    if identity.identity_state not in ('SUSPENDED', 'REVERIFY_REQUIRED'):
        return jsonify({'error': 'Identity does not require recovery.'}), 400

    identity.identity_state = 'UNVERIFIED'
    db.session.commit()

    return jsonify({
        'success': True,
        'message': 'Account recovery completed. You can now log in.',
    }), 200
