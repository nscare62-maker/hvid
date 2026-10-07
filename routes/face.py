"""
Face Verification Routes
Uses real webcam capture — backend validates image is a real face
(not blank/solid colour) and requires KYC (level 2) before face (level 3).
"""
import logging
import base64
import io
import os
from datetime import datetime
from flask import Blueprint, request, jsonify, g
from extensions import db
from models import Identity, KYC
from middleware.auth_required import auth_required

bp     = Blueprint('face', __name__)
logger = logging.getLogger(__name__)
ADMIN_KEY = os.environ.get('ADMIN_KEY', 'hvid-admin-2024')


def _admin_required():
    return request.headers.get('X-Admin-Key', '') == ADMIN_KEY


def _is_real_face_image(image_bytes: bytes) -> tuple[bool, str]:
    """
    Basic image validation:
    - Must be a valid JPEG/PNG (decodable)
    - Must have reasonable dimensions (not tiny)
    - Must have colour variance (not a blank/solid image)
    Returns (is_valid, reason)
    """
    try:
        from PIL import Image, ImageStat
        img = Image.open(io.BytesIO(image_bytes)).convert('RGB')
        w, h = img.size

        if w < 100 or h < 100:
            return False, 'Image too small. Please capture a clear face photo.'

        if w < 200 or h < 200:
            return False, 'Image resolution too low. Move closer to the camera.'

        # Check colour variance — blank/solid images have near-zero std dev
        stat = ImageStat.Stat(img)
        avg_std = sum(stat.stddev) / 3
        if avg_std < 8:
            return False, 'Image appears blank or solid colour. Please ensure good lighting.'

        return True, ''
    except Exception as e:
        logger.error(f"Image validation error: {e}")
        return False, 'Could not process image. Please try again.'


@bp.route('/status', methods=['GET'])
def face_status():
    """Get face verification status. Face = level 3."""
    identity_id = request.args.get('identityId', '').strip()
    if not identity_id:
        return jsonify({'error': 'identityId required'}), 400

    identity = Identity.query.get(identity_id)
    if not identity:
        return jsonify({'error': 'Identity not found'}), 404

    # Face verification = level 3
    has_face = identity.face_review_status == 'VERIFIED' or identity.verification_level >= 3

    return jsonify({
        'status':  'VERIFIED' if has_face else (identity.face_review_status or 'NOT_STARTED'),
        'verified': has_face,
        'message': 'Face verified' if has_face else 'Face not yet verified',
    }), 200


@bp.route('/start', methods=['POST'])
@auth_required
def face_start():
    """Check prerequisites and return ready status."""
    identity = Identity.query.get(g.identity_id)
    if not identity:
        return jsonify({'error': 'Identity not found'}), 404

    # Require KYC (level 2) before face (level 3)
    if identity.verification_level < 2:
        return jsonify({
            'error': 'KYC verification required before face verification. Please complete document verification first.',
            'requires_kyc': True,
        }), 403

    if identity.verification_level >= 3:
        return jsonify({
            'status':    'ALREADY_VERIFIED',
            'message':   'Face already verified.',
            'sessionId': g.identity_id,
        }), 200

    return jsonify({
        'status':    'READY',
        'message':   'Camera ready. Position your face clearly in the frame.',
        'sessionId': g.identity_id,
    }), 200


@bp.route('/capture', methods=['POST'])
@auth_required
def face_capture():
    """
    Process captured face image.
    Validates image quality before upgrading identity level.
    Requires KYC (level 2) first.
    """
    data       = request.get_json(silent=True) or {}
    image_data = data.get('image', '')

    if not image_data:
        return jsonify({'error': 'Image data required'}), 400

    identity = Identity.query.get(g.identity_id)
    if not identity:
        return jsonify({'error': 'Identity not found'}), 404

    # Enforce KYC prerequisite
    if identity.verification_level < 2:
        return jsonify({
            'error': 'Complete KYC document verification before face verification.',
            'requires_kyc': True,
        }), 403

    # Already face verified
    if identity.verification_level >= 3:
        return jsonify({
            'success':            True,
            'status':             'ALREADY_VERIFIED',
            'message':            'Face already verified.',
            'verification_level': identity.verification_level,
            'trust_signal':       identity.trust_signal,
        }), 200

    # Decode base64 image
    try:
        if image_data.startswith('data:image'):
            image_data = image_data.split(',', 1)[1]
        image_bytes = base64.b64decode(image_data)
    except Exception:
        return jsonify({'error': 'Invalid image data. Please retake the photo.'}), 400

    # Validate image quality
    is_valid, reason = _is_real_face_image(image_bytes)
    if not is_valid:
        return jsonify({'error': reason, 'success': False}), 422

    # Keep the image for admin review; approval performs the level upgrade.
    identity.face_image_data   = 'data:image/jpeg;base64,' + base64.b64encode(image_bytes).decode('utf-8')
    identity.face_review_status = 'UNDER_REVIEW'
    identity.face_submitted_at = datetime.utcnow()
    db.session.commit()

    logger.info(f"Face submitted for admin review for identity {g.identity_id}")

    return jsonify({
        'success':            True,
        'status':             'UNDER_REVIEW',
        'message':            'Face submitted for admin review.',
        'verification_level': identity.verification_level,
        'trust_signal':       identity.trust_signal,
    }), 200


@bp.route('/verify', methods=['POST'])
@auth_required
def face_verify():
    """Alias for face_capture for compatibility."""
    return face_capture()


@bp.route('/admin/pending', methods=['GET'])
def admin_pending_face():
    if not _admin_required():
        return jsonify({'error': 'Admin access required.'}), 403
    status = request.args.get('status', 'UNDER_REVIEW')
    query = Identity.query
    if status != 'ALL':
        query = query.filter(Identity.face_review_status == status)
    else:
        query = query.filter(Identity.face_review_status != 'NOT_STARTED')
    identities = query.order_by(Identity.face_submitted_at.asc()).all()
    return jsonify({'submissions': [{
        'identity_id': i.id,
        'username': i.username,
        'phone_last4': i.phone_last4,
        'status': i.face_review_status,
        'submitted_at': i.face_submitted_at.isoformat() if i.face_submitted_at else None,
    } for i in identities]}), 200


@bp.route('/admin/detail/<identity_id>', methods=['GET'])
def admin_face_detail(identity_id):
    if not _admin_required():
        return jsonify({'error': 'Admin access required.'}), 403
    identity = Identity.query.get(identity_id)
    if not identity:
        return jsonify({'error': 'Identity not found.'}), 404
    return jsonify({
        'identity_id': identity.id,
        'username': identity.username,
        'phone_last4': identity.phone_last4,
        'status': identity.face_review_status,
        'image_data': identity.face_image_data,
        'submitted_at': identity.face_submitted_at.isoformat() if identity.face_submitted_at else None,
    }), 200


@bp.route('/admin/approve/<identity_id>', methods=['POST'])
def admin_approve_face(identity_id):
    if not _admin_required():
        return jsonify({'error': 'Admin access required.'}), 403
    identity = Identity.query.get(identity_id)
    if not identity:
        return jsonify({'error': 'Identity not found.'}), 404
    identity.face_review_status = 'VERIFIED'
    identity.verification_level = max(identity.verification_level, 3)
    identity.identity_state = 'VERIFIED'
    identity.trust_signal = 'HIGH'
    identity.last_verified_at = datetime.utcnow()
    db.session.commit()
    return jsonify({'success': True, 'status': 'VERIFIED'}), 200


@bp.route('/admin/reject/<identity_id>', methods=['POST'])
def admin_reject_face(identity_id):
    if not _admin_required():
        return jsonify({'error': 'Admin access required.'}), 403
    identity = Identity.query.get(identity_id)
    if not identity:
        return jsonify({'error': 'Identity not found.'}), 404
    identity.face_review_status = 'REJECTED'
    db.session.commit()
    return jsonify({'success': True, 'status': 'REJECTED'}), 200
