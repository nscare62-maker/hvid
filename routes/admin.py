"""
Admin API Routes
Provides endpoints for the admin console (reports, identity explorer, risk intelligence)
"""
import os
import json
import logging
from datetime import datetime
from flask import Blueprint, request, jsonify
from extensions import db
from models import Identity, Report, Asset

bp = Blueprint('admin', __name__)
logger = logging.getLogger(__name__)

ADMIN_KEY = os.environ.get('ADMIN_KEY', 'hvid-admin-2024')


def _admin_required():
    key = request.headers.get('X-Admin-Key', '')
    return key == ADMIN_KEY


# ── Reports Queue ────────────────────────────────────────────────
@bp.route('/reports', methods=['GET'])
def admin_list_reports():
    """GET /api/admin/reports - list reports with filtering and pagination"""
    if not _admin_required():
        return jsonify({'error': 'Admin access required.'}), 403

    status_filter = request.args.get('status', '').strip().upper()
    type_filter = request.args.get('report_type', '').strip().upper()
    limit = int(request.args.get('limit', 20))
    offset = int(request.args.get('offset', 0))

    query = Report.query
    if status_filter:
        query = query.filter(Report.status == status_filter)
    if type_filter:
        query = query.filter(Report.report_type == type_filter)

    total = query.count()
    reports = query.order_by(Report.created_at.desc()).offset(offset).limit(limit).all()

    items = []
    for r in reports:
        target_type = 'ASSET' if r.target_asset_id else 'IDENTITY'
        items.append({
            'report_id': r.id,
            'report_type': r.report_type,
            'target_type': target_type,
            'status': r.status,
            'created_at': r.created_at.isoformat() if r.created_at else None,
        })

    return jsonify({'data': items, 'total': total}), 200


@bp.route('/reports/<report_id>', methods=['GET'])
def admin_get_report(report_id):
    """GET /api/admin/reports/<id> - get single report detail"""
    if not _admin_required():
        return jsonify({'error': 'Admin access required.'}), 403

    r = Report.query.get(report_id)
    if not r:
        return jsonify({'error': 'Report not found.'}), 404

    evidence_urls = []
    if r.evidence_urls:
        try:
            evidence_urls = json.loads(r.evidence_urls)
            if not isinstance(evidence_urls, list):
                evidence_urls = [r.evidence_urls]
        except Exception:
            evidence_urls = [r.evidence_urls]

    target_type = 'ASSET' if r.target_asset_id else 'IDENTITY'
    return jsonify({
        'report_id': r.id,
        'report_type': r.report_type,
        'target_type': target_type,
        'status': r.status,
        'description': r.description or 'No description provided.',
        'evidence_urls': evidence_urls,
        'reporter_identity_id': r.reporter_identity_id,
        'target_identity_id': r.target_identity_id,
        'target_asset_id': r.target_asset_id,
        'created_at': r.created_at.isoformat() if r.created_at else None,
        'updated_at': r.updated_at.isoformat() if r.updated_at else None,
    }), 200


# ── Identity Explorer ────────────────────────────────────────────
@bp.route('/identity/<identity_id>', methods=['GET'])
def admin_get_identity(identity_id):
    """GET /api/admin/identity/<id> - get detailed identity info with flags and logs"""
    if not _admin_required():
        return jsonify({'error': 'Admin access required.'}), 403

    identity = Identity.query.get(identity_id)
    if not identity:
        return jsonify({'error': 'Identity not found.'}), 404

    # Fetch associated reports as flags
    reports = Report.query.filter_by(target_identity_id=identity_id).all()
    flags = []
    for rep in reports:
        flags.append({
            'flagType': rep.report_type,
            'reason': rep.description or '',
            'createdAt': rep.created_at.isoformat() if rep.created_at else '',
            'status': rep.status,
        })

    status_logs = [
        {
            'previousStatus': 'ACTIVE',
            'newStatus': identity.identity_state,
            'reason': f"admin:system|Initial registration ({identity.trust_signal})",
            'createdAt': identity.created_at.isoformat() if identity.created_at else '',
        }
    ]

    return jsonify({
        'identity': {
            'id': identity.id,
            'username': identity.username or 'unnamed',
            'email': identity.email,
            'phone_last4': identity.phone_last4,
            'identity_state': identity.identity_state,
            'identity_type': identity.identity_type,
            'verification_level': identity.verification_level,
            'trust_signal': identity.trust_signal,
            'tier': identity.tier,
            'flag_count': identity.flag_count,
            'created_at': identity.created_at.isoformat() if identity.created_at else None,
            'last_login_at': identity.last_login_at.isoformat() if identity.last_login_at else None,
        },
        'flags': flags,
        'status_logs': status_logs,
    }), 200


@bp.route('/identity/<identity_id>/action', methods=['POST'])
def admin_identity_action(identity_id):
    """POST /api/admin/identity/<id>/action - apply moderation action"""
    if not _admin_required():
        return jsonify({'error': 'Admin access required.'}), 403

    identity = Identity.query.get(identity_id)
    if not identity:
        return jsonify({'error': 'Identity not found.'}), 404

    data = request.get_json(silent=True) or {}
    new_status = (data.get('status') or '').strip().upper()
    reason = (data.get('reason') or '').strip()

    if not reason:
        return jsonify({'error': 'Reason is required for admin actions.'}), 400

    if new_status in ('SUSPENDED', 'REVOKED', 'LIMITED', 'VERIFIED', 'UNVERIFIED'):
        identity.identity_state = new_status
        if new_status == 'SUSPENDED':
            identity.trust_signal = 'SUSPENDED'
        elif new_status == 'VERIFIED':
            identity.trust_signal = 'VERIFIED'
            identity.verification_level = max(identity.verification_level, 2)
        elif new_status == 'UNVERIFIED':
            identity.trust_signal = 'UNVERIFIED'

    db.session.commit()
    logger.info(f"Admin action applied to {identity_id}: new_status={new_status}, reason={reason}")

    return jsonify({'success': True, 'identity_state': identity.identity_state}), 200
