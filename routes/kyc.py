"""
KYC Routes
POST /api/kyc/start              - Start a KYC session
POST /api/kyc/upload             - Upload document (multipart) → VERIFIED immediately if OCR passes
GET  /api/kyc/status             - Get KYC status for identity
POST /api/kyc/admin/approve/:id  - Admin: approve KYC
POST /api/kyc/admin/reject/:id   - Admin: reject KYC
GET  /api/kyc/admin/pending      - Admin: list pending submissions
"""
import base64
import json
import logging
import os
from datetime import datetime

from flask import Blueprint, request, jsonify, g, current_app
from extensions import db
from models import KYC, Identity
from middleware.auth_required import auth_required
from services.document_validator import validate_document

bp     = Blueprint('kyc', __name__)
logger = logging.getLogger(__name__)

VALID_DOCUMENT_TYPES = {
    'PASSPORT', 'DRIVERS_LICENSE', 'NATIONAL_ID', 'RESIDENCE_PERMIT'
}
ALLOWED_EXTENSIONS = {'jpg', 'jpeg', 'png', 'pdf'}
MAX_FILE_BYTES     = 10 * 1024 * 1024   # 10 MB
ADMIN_KEY          = os.environ.get('ADMIN_KEY', 'hvid-admin-2024')
ADMIN_USERNAME     = os.environ.get('ADMIN_USERNAME', 'admin')
ADMIN_PASSWORD     = os.environ.get('ADMIN_PASSWORD', 'admin123')


def _allowed_file(filename: str) -> bool:
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def _admin_required():
    """Check admin key from header."""
    key = request.headers.get('X-Admin-Key', '')
    return key == ADMIN_KEY


@bp.route('/admin/login', methods=['POST'])
def admin_login():
    data = request.get_json(silent=True) or {}
    if data.get('username') != ADMIN_USERNAME or data.get('password') != ADMIN_PASSWORD:
        return jsonify({'error': 'Invalid admin username or password.'}), 401
    return jsonify({'success': True, 'admin_key': ADMIN_KEY}), 200


# ── Start KYC session ─────────────────────────────────────────────
@bp.route('/start', methods=['POST'])
@auth_required
def start_kyc():
    identity = Identity.query.get(g.identity_id)
    if not identity:
        return jsonify({'error': 'Identity not found.'}), 404

    if identity.identity_type == 'BUSINESS' and not identity.has_plan_entitlement('VERIFIED'):
        return jsonify({
            'error': 'Business KYC requires the Verified plan payment first.',
            'requires_payment': True,
            'plan_id': 'VERIFIED',
            'redirect_url': '/dashboard/upgrade?reason=kyc&return_to=%2Fdashboard%2Fverification',
        }), 402

    # Return existing pending/under-review session
    existing = (
        KYC.query
        .filter_by(identity_id=g.identity_id)
        .filter(KYC.status.in_(['PENDING', 'UNDER_REVIEW']))
        .first()
    )
    if existing:
        return jsonify({
            'kyc_id':       existing.id,
            'status':       existing.status,
            'redirect_url': f'/kyc/mock?id={existing.id}',
        }), 200

    kyc = KYC(identity_id=g.identity_id, status='PENDING')
    db.session.add(kyc)
    db.session.flush()
    kyc.redirect_url = f'/kyc/mock?id={kyc.id}'
    db.session.commit()

    return jsonify({
        'kyc_id':       kyc.id,
        'status':       kyc.status,
        'redirect_url': f'/kyc/mock?id={kyc.id}',
    }), 200


# ── Upload document (multipart form) ─────────────────────────────
@bp.route('/upload', methods=['POST'])
@auth_required
def upload_document():
    """
    Accepts multipart/form-data:
      - file:          the document image/PDF
      - kyc_id:        the KYC session UUID
      - document_type: PASSPORT | NATIONAL_ID | DRIVERS_LICENSE | RESIDENCE_PERMIT

    Validates via OCR and immediately marks the KYC as VERIFIED when the document
    passes. Rejected documents are saved with REJECTED status and a rejection reason.
    """
    kyc_id        = (request.form.get('kyc_id') or '').strip()
    document_type = (request.form.get('document_type') or '').strip().upper()
    personal_details_raw = (request.form.get('personal_details') or '').strip()

    identity = Identity.query.get(g.identity_id)
    if identity and identity.identity_type == 'BUSINESS' and not identity.has_plan_entitlement('VERIFIED'):
        return jsonify({
            'error': 'Business KYC requires the Verified plan payment first.',
            'requires_payment': True,
            'redirect_url': '/dashboard/upgrade?reason=kyc&return_to=%2Fdashboard%2Fverification',
        }), 402

    if document_type not in VALID_DOCUMENT_TYPES:
        return jsonify({'error': f'Invalid document_type. Must be one of: {", ".join(VALID_DOCUMENT_TYPES)}'}), 400

    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded.'}), 400

    file = request.files['file']
    if not file or not file.filename:
        return jsonify({'error': 'No file selected.'}), 400

    if not _allowed_file(file.filename):
        return jsonify({'error': 'Only JPG, PNG and PDF files are accepted.'}), 400

    file_bytes = file.read()
    if len(file_bytes) > MAX_FILE_BYTES:
        return jsonify({'error': 'File too large. Maximum size is 10 MB.'}), 400
    if len(file_bytes) < 5000:
        return jsonify({'error': 'File is too small to be a valid document. Please upload a clear photo or scan.'}), 400

    # Find KYC session
    kyc = KYC.query.filter_by(id=kyc_id, identity_id=g.identity_id).first()
    if not kyc:
        kyc = KYC.query.filter_by(identity_id=g.identity_id, status='PENDING').first()
    if not kyc:
        return jsonify({'error': 'KYC session not found. Please start verification again.'}), 404

    if kyc.status == 'VERIFIED':
        return jsonify({'error': 'This KYC session is already verified.'}), 400

    personal_details = {}
    if personal_details_raw:
        try:
            personal_details = json.loads(personal_details_raw)
        except json.JSONDecodeError:
            personal_details = {'raw': personal_details_raw}

    metadata = {
        'personal_details': personal_details,
    }

    if 'selfie_file' in request.files:
        selfie = request.files['selfie_file']
        if selfie and selfie.filename:
            selfie_bytes = selfie.read()
            if selfie_bytes:
                selfie_ext = selfie.filename.rsplit('.', 1)[1].lower() if '.' in selfie.filename else 'jpg'
                selfie_mime = f'image/{selfie_ext}'
                metadata['selfie_file_name'] = selfie.filename
                metadata['selfie_data'] = f'data:{selfie_mime};base64,' + base64.b64encode(selfie_bytes).decode('utf-8')

    # ── Run OCR document validation ────────────────────────────
    logger.info(f"Running OCR validation for {document_type}, file={file.filename}, size={len(file_bytes)}")
    validation = validate_document(file_bytes, file.filename, document_type)

    if not validation['valid']:
        reasons = validation['reasons']
        logger.warning(f"KYC doc rejected for identity {g.identity_id}: {reasons}")

        # Save rejection record so user can see why it failed
        kyc.document_type = document_type
        kyc.document_name = file.filename
        kyc.document_urls = json.dumps(metadata) if metadata else None
        kyc.status        = 'REJECTED'
        kyc.reject_reason = ' | '.join(reasons)
        kyc.reviewed_at   = datetime.utcnow()
        db.session.commit()

        return jsonify({
            'success':  False,
            'error':    'Document verification failed.',
            'reasons':  reasons,
            'hint':     _get_hint(document_type),
        }), 422

    # Keep the validated submission for an admin to review.
    ext      = file.filename.rsplit('.', 1)[1].lower()
    mime     = 'application/pdf' if ext == 'pdf' else f'image/{ext}'
    b64_data = f'data:{mime};base64,' + base64.b64encode(file_bytes).decode('utf-8')

    kyc.document_type = document_type
    kyc.document_data = b64_data
    kyc.document_name = file.filename
    kyc.document_urls = json.dumps(metadata) if metadata else None
    kyc.status        = 'UNDER_REVIEW'
    kyc.reviewed_at   = None
    kyc.reject_reason = None
    db.session.commit()

    logger.info(f"KYC document submitted for admin review: identity={g.identity_id}, type={document_type}")

    return jsonify({
        'success': True,
        'kyc_id':  kyc.id,
        'status':  kyc.status,
        'message': 'Document submitted for admin review.',
    }), 200


def _get_hint(document_type: str) -> str:
    hints = {
        'NATIONAL_ID':       'Upload a clear photo of your Aadhaar card showing the 12-digit number, name, and "Aadhaar" text.',
        'RESIDENCE_PERMIT':  'Upload a clear photo of your Aadhaar card showing the 12-digit number and address.',
        'DRIVERS_LICENSE':   'Upload a clear photo of your Driving Licence showing the DL number, name, DOB, and "Driving Licence" text.',
        'PASSPORT':          'Upload a clear scan of your Passport data page showing your name, passport number, "Republic of India", and the MRZ lines at the bottom.',
    }
    return hints.get(document_type, 'Please upload a clear, unobstructed photo of your document.')

# ── Status ────────────────────────────────────────────────────────
@bp.route('/status', methods=['GET'])
def kyc_status():
    identity_id = request.args.get('identityId', '').strip()
    if not identity_id:
        return jsonify({'error': 'identityId query parameter is required.'}), 400

    identity = Identity.query.get(identity_id)
    if not identity:
        return jsonify({'error': 'Identity not found.'}), 404

    verified_identity = identity.identity_state == 'VERIFIED' or identity.verification_level >= 2

    kyc = (
        KYC.query
        .filter_by(identity_id=identity_id)
        .order_by(KYC.created_at.desc())
        .first()
    )

    if verified_identity:
        verified_kyc = (
            KYC.query
            .filter_by(identity_id=identity_id, status='VERIFIED')
            .order_by(KYC.reviewed_at.desc(), KYC.created_at.desc())
            .first()
        )
        if verified_kyc:
            kyc = verified_kyc
        elif not kyc:
            return jsonify({'error': 'No KYC submission found.'}), 404

        return jsonify({
            'kyc_id':        kyc.id if kyc else None,
            'status':        'VERIFIED',
            'document_type': kyc.document_type if kyc else None,
            'reject_reason': kyc.reject_reason if kyc else None,
            'createdAt':     kyc.created_at.isoformat() if kyc and kyc.created_at else None,
            'updatedAt':     kyc.updated_at.isoformat() if kyc and kyc.updated_at else None,
        }), 200

    if not kyc:
        return jsonify({'error': 'No KYC submission found.'}), 404

    return jsonify({
        'kyc_id':        kyc.id,
        'status':        kyc.status,
        'document_type': kyc.document_type,
        'reject_reason': kyc.reject_reason,
        'createdAt':     kyc.created_at.isoformat() if kyc.created_at else None,
        'updatedAt':     kyc.updated_at.isoformat() if kyc.updated_at else None,
    }), 200


# ── Legacy submit (keep for backward compat) ──────────────────────
@bp.route('/submit', methods=['POST'])
def submit_kyc():
    data          = request.get_json(silent=True) or {}
    identity_id   = (data.get('identity_id') or '').strip()
    document_type = (data.get('document_type') or '').strip().upper()

    if not identity_id:
        return jsonify({'error': 'identity_id is required.'}), 400
    if document_type not in VALID_DOCUMENT_TYPES:
        return jsonify({'error': f'Invalid document_type.'}), 400

    identity = Identity.query.get(identity_id)
    if not identity:
        return jsonify({'error': 'Identity not found.'}), 404

    kyc = KYC(
        identity_id   = identity_id,
        document_type = document_type,
        status        = 'UNDER_REVIEW',
    )
    db.session.add(kyc)
    db.session.commit()

    return jsonify({'kyc_id': kyc.id, 'status': kyc.status}), 201


# ══════════════════════════════════════════════════════════════════
#  ADMIN ENDPOINTS — require X-Admin-Key header
# ══════════════════════════════════════════════════════════════════

@bp.route('/admin/pending', methods=['GET'])
def admin_pending():
    """List all KYC submissions pending review."""
    if not _admin_required():
        return jsonify({'error': 'Admin access required.'}), 403

    status_filter = request.args.get('status', 'UNDER_REVIEW')
    query = KYC.query
    if status_filter != 'ALL':
        query = query.filter(KYC.status == status_filter)
    submissions = query.order_by(KYC.created_at.asc()).all()

    result = []
    for k in submissions:
        identity = Identity.query.get(k.identity_id)
        result.append({
            'kyc_id':        k.id,
            'identity_id':   k.identity_id,
            'username':      identity.username if identity else None,
            'phone_last4':   identity.phone_last4 if identity else None,
            'document_type': k.document_type,
            'document_name': k.document_name,
            'status':        k.status,
            'reject_reason': k.reject_reason,
            'submitted_at':  k.created_at.isoformat() if k.created_at else None,
        })

    return jsonify({'submissions': result, 'total': len(result)}), 200


@bp.route('/admin/detail/<kyc_id>', methods=['GET'])
def admin_detail(kyc_id):
    """Get full KYC detail including document image for admin review."""
    if not _admin_required():
        return jsonify({'error': 'Admin access required.'}), 403

    kyc = KYC.query.get(kyc_id)
    if not kyc:
        return jsonify({'error': 'KYC submission not found.'}), 404

    identity = Identity.query.get(kyc.identity_id)
    metadata = {}
    if kyc.document_urls:
        try:
            metadata = json.loads(kyc.document_urls)
        except (TypeError, json.JSONDecodeError):
            metadata = {}

    return jsonify({
        'kyc_id':        kyc.id,
        'identity_id':   kyc.identity_id,
        'username':      identity.username if identity else None,
        'phone_last4':   identity.phone_last4 if identity else None,
        'document_type': kyc.document_type,
        'document_name': kyc.document_name,
        'document_data': kyc.document_data,   # base64 for display
        'personal_details': metadata.get('personal_details', {}),
        'selfie_data': metadata.get('selfie_data'),
        'status':        kyc.status,
        'reject_reason': kyc.reject_reason,
        'submitted_at':  kyc.created_at.isoformat() if kyc.created_at else None,
    }), 200


@bp.route('/admin/approve/<kyc_id>', methods=['POST'])
def admin_approve(kyc_id):
    """Approve a KYC submission and upgrade identity."""
    if not _admin_required():
        return jsonify({'error': 'Admin access required.'}), 403

    kyc = KYC.query.get(kyc_id)
    if not kyc:
        return jsonify({'error': 'KYC not found.'}), 404

    kyc.status      = 'VERIFIED'
    kyc.reviewed_at = datetime.utcnow()
    db.session.commit()

    identity = Identity.query.get(kyc.identity_id)
    if identity:
        identity.verification_level = max(identity.verification_level, 2)
        identity.identity_state     = 'VERIFIED'
        identity.trust_signal       = 'VERIFIED'
        db.session.commit()

    logger.info(f"Admin approved KYC {kyc_id} for identity {kyc.identity_id}")
    return jsonify({'success': True, 'status': 'VERIFIED'}), 200


@bp.route('/admin/reject/<kyc_id>', methods=['POST'])
def admin_reject(kyc_id):
    """Reject a KYC submission with a reason."""
    if not _admin_required():
        return jsonify({'error': 'Admin access required.'}), 403

    kyc = KYC.query.get(kyc_id)
    if not kyc:
        return jsonify({'error': 'KYC not found.'}), 404

    data   = request.get_json(silent=True) or {}
    reason = (data.get('reason') or 'Document could not be verified.').strip()

    kyc.status        = 'REJECTED'
    kyc.reject_reason = reason
    kyc.reviewed_at   = datetime.utcnow()
    db.session.commit()

    logger.info(f"Admin rejected KYC {kyc_id}: {reason}")
    return jsonify({'success': True, 'status': 'REJECTED', 'reason': reason}), 200
