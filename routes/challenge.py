"""
Challenge Routes
Handles identity/asset ownership challenges and admin resolution
"""
import os
import json
import logging
from datetime import datetime
from flask import Blueprint, request, jsonify, g
from extensions import db
from models import Report, Identity, Asset
from middleware.auth_required import optional_auth

bp = Blueprint('challenge', __name__)
logger = logging.getLogger(__name__)

ADMIN_KEY = os.environ.get('ADMIN_KEY', 'hvid-admin-2024')


def _admin_required():
    key = request.headers.get('X-Admin-Key', '')
    return key == ADMIN_KEY


@bp.route('/create', methods=['POST'])
@optional_auth
def create_challenge():
    """
    POST /api/challenge/create
    Body: {
        reporter_identity_id?: string,
        target_identity_id:   string,
        target_asset_id?:      string,
        description:          string,
        evidence_links?:       string[]
    }
    """
    data = request.get_json(silent=True) or {}
    target_identity_id = (data.get('target_identity_id') or '').strip()
    description = (data.get('description') or '').strip()
    evidence_links = data.get('evidence_links') or []

    if not description:
        return jsonify({'error': 'Evidence description is required.'}), 400

    reporter_id = g.identity_id or data.get('reporter_identity_id') or None
    target_id = target_identity_id or None

    report = Report(
        reporter_identity_id = reporter_id,
        target_identity_id   = target_id,
        target_asset_id      = data.get('target_asset_id') or None,
        report_type          = 'CHALLENGE',
        description          = description,
        evidence_urls        = json.dumps(evidence_links) if isinstance(evidence_links, list) else '[]',
        status               = 'UNDER_REVIEW',
    )
    db.session.add(report)
    db.session.commit()

    logger.info(f"Challenge created: {report.id} for target {target_id}")
    return jsonify({
        'success': True,
        'challenge_id': report.id,
        'status': report.status,
        'message': 'Challenge submitted successfully. It is now under review.',
    }), 201


@bp.route('/admin/all', methods=['GET'])
def admin_all_challenges():
    """GET /api/challenge/admin/all - list all challenges for admin"""
    if not _admin_required():
        return jsonify({'error': 'Admin access required.'}), 403

    challenges = Report.query.filter_by(report_type='CHALLENGE').order_by(Report.created_at.desc()).all()
    results = []
    for c in challenges:
        results.append({
            'id': c.id,
            'report_id': c.id,
            'status': c.status,
            'payment_status': 'COMPLETED',
            'created_at': c.created_at.isoformat() if c.created_at else None,
            'updated_at': c.updated_at.isoformat() if c.updated_at else None,
        })
    return jsonify(results), 200


@bp.route('/admin/<challenge_id>', methods=['GET'])
def admin_get_challenge(challenge_id):
    """GET /api/challenge/admin/<id> - get single challenge detail"""
    if not _admin_required():
        return jsonify({'error': 'Admin access required.'}), 403

    challenge = Report.query.get(challenge_id)
    if not challenge or challenge.report_type != 'CHALLENGE':
        return jsonify({'error': 'Challenge not found.'}), 404

    evidence_urls = []
    if challenge.evidence_urls:
        try:
            evidence_urls = json.loads(challenge.evidence_urls)
        except Exception:
            evidence_urls = [challenge.evidence_urls]

    return jsonify({
        'id': challenge.id,
        'report_id': challenge.id,
        'challenger_identity_id': challenge.reporter_identity_id,
        'target_identity_id': challenge.target_identity_id,
        'target_asset_id': challenge.target_asset_id,
        'status': challenge.status,
        'payment_status': 'COMPLETED',
        'payment_reference': 'AUTO_CREDIT_50',
        'challenge_reason': challenge.description,
        'evidence_urls': evidence_urls,
        'admin_notes': '',
        'created_at': challenge.created_at.isoformat() if challenge.created_at else None,
        'updated_at': challenge.updated_at.isoformat() if challenge.updated_at else None,
    }), 200


@bp.route('/admin/<challenge_id>/review', methods=['PATCH'])
def admin_review_challenge(challenge_id):
    """PATCH /api/challenge/admin/<id>/review - set challenge to UNDER_REVIEW"""
    if not _admin_required():
        return jsonify({'error': 'Admin access required.'}), 403

    challenge = Report.query.get(challenge_id)
    if not challenge or challenge.report_type != 'CHALLENGE':
        return jsonify({'error': 'Challenge not found.'}), 404

    data = request.get_json(silent=True) or {}
    challenge.status = 'UNDER_REVIEW'
    db.session.commit()

    return admin_get_challenge(challenge_id)


@bp.route('/admin/<challenge_id>/resolve', methods=['PATCH'])
def admin_resolve_challenge(challenge_id):
    """PATCH /api/challenge/admin/<id>/resolve - resolve challenge outcome"""
    if not _admin_required():
        return jsonify({'error': 'Admin access required.'}), 403

    challenge = Report.query.get(challenge_id)
    if not challenge or challenge.report_type != 'CHALLENGE':
        return jsonify({'error': 'Challenge not found.'}), 404

    data = request.get_json(silent=True) or {}
    outcome = (data.get('outcome') or 'RESOLVED_SUCCESS').strip()

    if outcome == 'RESOLVED_SUCCESS':
        challenge.status = 'RESOLVED_SUCCESS'
        if challenge.target_asset_id:
            asset = Asset.query.get(challenge.target_asset_id)
            if asset:
                asset.verification_status = 'REVOKED'
        if challenge.target_identity_id:
            target_user = Identity.query.get(challenge.target_identity_id)
            if target_user:
                target_user.flag_count = (target_user.flag_count or 0) + 1
    else:
        challenge.status = 'RESOLVED_FAILED'

    db.session.commit()
    logger.info(f"Challenge {challenge_id} resolved: {challenge.status}")
    return admin_get_challenge(challenge_id)
