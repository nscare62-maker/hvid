"""
Report Routes
POST /api/report/submit - Submit an identity report
"""
import json
import logging
from flask import Blueprint, request, jsonify, g
from extensions import db
from models import Report, Identity
from middleware.auth_required import optional_auth

bp = Blueprint('report', __name__)
logger = logging.getLogger(__name__)

VALID_REPORT_TYPES = {
    'IMPERSONATION', 'FRAUD', 'HARASSMENT', 'FAKE_IDENTITY',
    'SPAM', 'MISINFORMATION', 'OTHER',
}


@bp.route('/submit', methods=['POST'])
@optional_auth
def submit_report():
    """
    Submit a report about an identity.
    Body: {
        reporter_identity_id?: string,
        target_identity_id?:   string,
        target_asset_id?:      string,
        report_type:           string,
        description?:          string,
        evidence_urls?:        string[]
    }
    """
    data = request.get_json(silent=True) or {}

    report_type = (data.get('report_type') or '').strip().upper()
    if not report_type:
        return jsonify({'error': 'report_type is required.'}), 400
    if report_type not in VALID_REPORT_TYPES:
        return jsonify({
            'error': f'Invalid report type. Must be one of: {", ".join(VALID_REPORT_TYPES)}'
        }), 400

    target_identity_id = data.get('target_identity_id') or None
    if target_identity_id:
        target = Identity.query.get(target_identity_id)
        if not target:
            return jsonify({'error': 'Target identity not found.'}), 404

    evidence_urls = data.get('evidence_urls') or []
    if isinstance(evidence_urls, list):
        evidence_urls_json = json.dumps(evidence_urls)
    else:
        evidence_urls_json = '[]'

    reporter_id = g.identity_id or data.get('reporter_identity_id') or None

    report = Report(
        reporter_identity_id = reporter_id,
        target_identity_id   = target_identity_id,
        target_asset_id      = data.get('target_asset_id') or None,
        report_type          = report_type,
        description          = (data.get('description') or '').strip() or None,
        evidence_urls        = evidence_urls_json,
        status               = 'PENDING',
    )
    db.session.add(report)
    db.session.commit()

    logger.info(f"Report submitted: {report.id} type={report_type}")

    return jsonify({
        'success':   True,
        'report_id': report.id,
        'status':    report.status,
    }), 201


@bp.route('/target/<identity_id>', methods=['GET'])
@optional_auth
def reports_for_target(identity_id):
    """
    GET /api/report/target/:identityId
    Returns public-safe report summary for an identity (used by match-ui.js and profile.js).
    Never exposes reporter details or internal reasons.
    """
    identity = Identity.query.get(identity_id)
    if not identity:
        return jsonify({'reports': [], 'total': 0}), 200

    reports = (
        Report.query
        .filter_by(target_identity_id=identity_id)
        .order_by(Report.created_at.desc())
        .limit(20)
        .all()
    )

    public_reports = [
        {
            'id':          r.id,
            'report_type': r.report_type,
            'status':      r.status,
            'created_at':  r.created_at.isoformat() if r.created_at else None,
        }
        for r in reports
    ]

    return jsonify({
        'reports': public_reports,
        'total':   len(public_reports),
    }), 200


@bp.route('/<report_id>/resolve', methods=['PATCH'])
def resolve_report(report_id):
    """
    PATCH /api/report/:reportId/resolve
    Admin resolves report decision: VALID, INVALID, or UNDER_REVIEW
    """
    import os
    admin_key = os.environ.get('ADMIN_KEY', 'hvid-admin-2024')
    if request.headers.get('X-Admin-Key') != admin_key:
        return jsonify({'error': 'Admin access required.'}), 403

    report = Report.query.get(report_id)
    if not report:
        return jsonify({'error': 'Report not found.'}), 404

    data = request.get_json(silent=True) or {}
    decision = (data.get('decision') or '').strip().upper()

    if decision == 'VALID':
        report.status = 'RESOLVED'
        if report.target_identity_id:
            target = Identity.query.get(report.target_identity_id)
            if target:
                target.flag_count = (target.flag_count or 0) + 1
    elif decision == 'INVALID':
        report.status = 'REJECTED'
    elif decision == 'UNDER_REVIEW':
        report.status = 'UNDER_REVIEW'
    else:
        return jsonify({'error': f'Invalid decision: {decision}'}), 400

    db.session.commit()
    logger.info(f"Report {report_id} decision applied: {report.status}")

    return jsonify({
        'success': True,
        'report_id': report.id,
        'status': report.status,
    }), 200

