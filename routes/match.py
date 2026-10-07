"""
Match Routes
POST /api/match/check - Check if a phone/identity matches a known HVID
"""
import logging
import re
import traceback
from re import match as re_match, sub as re_sub
from flask import Blueprint, request, jsonify
from sqlalchemy import or_
from extensions import db
from models import Identity
from services.otp_service import hash_phone, normalize_phone

bp = Blueprint('match', __name__)
logger = logging.getLogger(__name__)


def _lookup_identity_by_ref(value):
    if not value:
        return None
    value = value.strip()
    if re.match(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', value, re.I):
        return Identity.query.get(value)
    hvid_match = re.match(r'^(?:hvid-)?([0-9a-f]{6,12})$', value, re.I)
    if hvid_match:
        part = hvid_match.group(1).lower()
        return Identity.query.filter(
            or_(Identity.id.ilike(f'{part}%'), Identity.id.ilike(f'%{part}'))
        ).first()
    return None

_PUBLIC_TRUST_SIGNALS = {
    'HIGH': 'STABLE',
    'VERIFIED': 'STABLE',
    'BASIC': 'STABLE',
    'UNVERIFIED': 'STABLE',
    'FLAGGED': 'UNDER_REVIEW',
    'SUSPENDED': 'SUSPENDED',
    'LIMITED': 'LIMITED',
}


def _public_trust_signal(identity):
    if identity.identity_state == 'SUSPENDED':
        return 'SUSPENDED'
    if identity.identity_state in ('LIMITED', 'REVERIFY_REQUIRED'):
        return 'REQUIRES_REVALIDATION'
    return _PUBLIC_TRUST_SIGNALS.get(identity.trust_signal or 'UNVERIFIED', 'STABLE')


def _public_trust_label(identity):
    if _public_trust_signal(identity) != 'STABLE':
        return 'LOW'
    if identity.tier == 'PREMIUM' or identity.trust_signal == 'HIGH' or identity.verification_level >= 3:
        return 'HIGH'
    if identity.tier in ('VERIFIED', 'PROFESSIONAL') or identity.trust_signal == 'VERIFIED' or identity.verification_level >= 2:
        return 'MEDIUM'
    return 'LOW'


@bp.route('/check', methods=['POST'])
def check_match():
    """
    Check identity against HVID registry.
    Body: { type?: string, value?: string, query?: string }
    Returns match result with signal and verification level.
    """
    try:
        from models import Asset

        data = request.get_json(silent=True) or {}
        query      = (data.get('query')  or '').strip()
        value      = (data.get('value')  or query).strip()
        match_type = (data.get('type')   or '').strip().lower()
        requested_account_type = (data.get('account_type') or '').strip().upper()
        account_type_provided = bool(requested_account_type)
        account_type = requested_account_type or 'INDIVIDUAL'

        if account_type not in ('INDIVIDUAL', 'BUSINESS', 'PERSONAL'):
            return jsonify({'error': 'Choose Individual or Business account.'}), 400
        identity_type = 'BUSINESS' if account_type == 'BUSINESS' else 'PERSONAL'

        if not value:
            return jsonify({'error': 'A search value or query is required.'}), 400

        # Auto-detect type if not provided
        if not match_type:
            # Check if it looks like a phone number (starts with + or contains only digits)
            if value.startswith('+') or re_match(r'^\d+$', value):
                match_type = 'phone'
            # Check if it looks like a UUID (identity_id)
            elif re_match(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', value, re.I):
                match_type = 'identity_id'
            # Check if it looks like an HVID code (HVID-xxxxxx)
            elif re_match(r'^(?:hvid-)[0-9a-f]{6,12}$', value, re.I):
                match_type = 'identity_id'
            # Check if it starts with @ (Instagram/Twitter handle)
            elif value.startswith('@'):
                match_type = 'instagram'
            # Check if it's an email format
            elif '@' in value:
                match_type = 'email'
            # Otherwise assume it's a username
            else:
                match_type = 'username'
    
        identity = None

        if match_type == 'phone':
            # Normalize and hash for lookup across formats like +91..., 919..., 1223344556
            normalized_phone = normalize_phone(value)
            phone_digits = re.sub(r'\D', '', normalized_phone)
            if len(phone_digits) < 10 or len(phone_digits) > 15:
                return jsonify({
                    'error': 'Invalid phone number. Enter a valid 10-15 digit phone number.'
                }), 400

            phone_hash = hash_phone(normalized_phone)
            identity = Identity.query.filter_by(
                phone_hash=phone_hash,
                identity_type=identity_type,
            ).first()

        elif match_type == 'identity_id' or match_type == 'id':
            identity = _lookup_identity_by_ref(value)

        elif match_type in ('instagram', 'twitter', 'linkedin'):
            handle = value.lstrip('@').strip().lower()
            asset = Asset.query.filter(
                Asset.verification_status == 'VERIFIED',
                Asset.display_value.ilike(f'%{handle}%')
            ).first()
            if asset:
                identity = Identity.query.get(asset.identity_id)

        elif match_type == 'username':
            username = value.strip().lower()
            identity = Identity.query.filter(
                Identity.username.ilike(username),
                Identity.identity_type == identity_type,
            ).first()
            if not identity:
                handle = value.lstrip('@').strip()
                asset = Asset.query.filter(
                    Asset.verification_status == 'VERIFIED',
                    Asset.display_value.ilike(f'%{handle}%')
                ).first()
                if asset:
                    identity = Identity.query.get(asset.identity_id)
                if not identity:
                    normalized_phone = normalize_phone(value)
                    if normalized_phone:
                        phone_hash = hash_phone(normalized_phone)
                        identity = Identity.query.filter_by(
                            phone_hash=phone_hash,
                            identity_type=identity_type,
                        ).first()
    
        elif match_type == 'email':
            email = value.strip()
            identity = Identity.query.filter(
                Identity.email.ilike(email),
                Identity.identity_type == identity_type,
            ).first()
            if not identity:
                normalized_phone = normalize_phone(value)
                if normalized_phone:
                    phone_hash = hash_phone(normalized_phone)
                    identity = Identity.query.filter_by(
                        phone_hash=phone_hash,
                        identity_type=identity_type,
                    ).first()

        if identity and account_type_provided and identity.identity_type != identity_type:
            identity = None

        if not identity and not account_type_provided and match_type == 'phone':
            identity = Identity.query.filter_by(phone_hash=phone_hash, is_active=True).first()
        elif not identity and not account_type_provided and match_type == 'username':
            identity = Identity.query.filter(
                Identity.username.ilike(value.strip()),
                Identity.is_active.is_(True),
            ).first()
        elif not identity and not account_type_provided and match_type == 'email':
            identity = Identity.query.filter(
                Identity.email.ilike(value.strip()),
                Identity.is_active.is_(True),
            ).first()

        available_account_types = []
        if identity and identity.is_active:
            available_account_types = [
                'BUSINESS' if item.identity_type == 'BUSINESS' else 'INDIVIDUAL'
                for item in Identity.query.filter_by(phone_hash=identity.phone_hash, is_active=True).all()
            ]
            available_account_types = list(dict.fromkeys(available_account_types))

        if not identity or not identity.is_active:
            return jsonify({
                'result_type':        'NO_MATCH',
                'signal':             'NOT_FOUND',
                'verification_level': 0,
                'identity_type':      None,
                'account_types':      available_account_types,
            }), 200

        # Determine result quality
        if identity.verification_level >= 3:
            result_type = 'MATCH_CONFIRMED'
        elif identity.verification_level >= 1:
            result_type = 'PARTIAL_MATCH'
        elif identity.identity_state == 'SUSPENDED':
            result_type = 'UNDER_REVIEW'
        else:
            result_type = 'PARTIAL_MATCH'

        return jsonify({
            'result_type':        result_type,
            'signal':             _public_trust_signal(identity),
            'trust_label':        _public_trust_label(identity),
            'verification_level': identity.verification_level,
            'identity_type':      identity.identity_type,
            'identity_id':        identity.id,
            'username':           identity.username,
            'created_at':         identity.created_at.isoformat() if identity.created_at else None,
            'account_type':       'BUSINESS' if identity.identity_type == 'BUSINESS' else 'INDIVIDUAL',
            'account_types':      available_account_types,
        }), 200

    except Exception as exc:
        logger.exception('Match check failed')
        return jsonify({
            'error': 'Internal server error',
            'details': traceback.format_exc(),
        }), 500


@bp.route('/multi-check', methods=['POST'])
def multi_check():
    """
    Multi-claim cross-verification check.
    Body: { claims: ["type:value", ...] }
    """
    from models import Asset

    data = request.get_json(silent=True) or {}
    claims = data.get('claims') or []

    if not isinstance(claims, list) or len(claims) < 2:
        return jsonify({'error': 'Please provide at least 2 claims to cross-verify.'}), 400

    matched_identities = {}
    explanations = []

    for item in claims:
        if not isinstance(item, str) or ':' not in item:
            continue
        c_type, c_val = item.split(':', 1)
        c_type = c_type.strip().lower()
        c_val = c_val.strip()
        if not c_val:
            continue

        matched_id = None
        if c_type == 'phone':
            norm_phone = normalize_phone(c_val)
            if norm_phone:
                p_hash = hash_phone(norm_phone)
                user = Identity.query.filter_by(phone_hash=p_hash).first()
                if user:
                    matched_id = user
                    explanations.append(f"Phone claim (+...{norm_phone[-4:]}) matches registered account.")
        elif c_type == 'username':
            user = Identity.query.filter(Identity.username.ilike(c_val)).first()
            if user:
                matched_id = user
                explanations.append(f"Username '{c_val}' matches registered account.")
        elif c_type == 'email':
            user = Identity.query.filter(Identity.email.ilike(c_val)).first()
            if user:
                matched_id = user
                explanations.append(f"Email '{c_val}' matches registered account.")
        elif c_type in ('instagram', 'twitter', 'linkedin'):
            handle = c_val.lstrip('@').strip().lower()
            asset = Asset.query.filter(
                Asset.verification_status == 'VERIFIED',
                Asset.display_value.ilike(f'%{handle}%')
            ).first()
            if asset:
                user = Identity.query.get(asset.identity_id)
                if user:
                    matched_id = user
                    explanations.append(f"{c_type.title()} handle '{c_val}' is verified.")

        if matched_id:
            matched_identities[matched_id.id] = matched_id

    distinct_users = list(matched_identities.values())

    if len(distinct_users) == 0:
        return jsonify({
            'risk_level': 'UNKNOWN',
            'recommended_action': 'VERIFY',
            'certainty': 'UNCERTAIN',
            'summary': 'No Records Found',
            'explanation': ['None of the submitted claims match any verified record in the HVID registry.'],
        }), 200

    if len(distinct_users) > 1:
        return jsonify({
            'risk_level': 'HIGH',
            'recommended_action': 'DO_NOT_PROCEED',
            'certainty': 'HIGH',
            'summary': 'Conflicting Identity Claims',
            'explanation': [
                'Submitted claims belong to multiple distinct identities.',
                'High probability of identity impersonation or shared credential spoofing.',
            ],
        }), 200

    user = distinct_users[0]
    if user.identity_state in ('SUSPENDED', 'REVOKED') or (user.flag_count and user.flag_count > 0):
        return jsonify({
            'risk_level': 'HIGH',
            'recommended_action': 'DO_NOT_PROCEED',
            'certainty': 'HIGH',
            'summary': 'Account Under Safety Review',
            'explanation': [
                f'The matching identity status is currently {user.identity_state}.',
                'This account has active safety flags. Do not proceed with transactions.',
            ],
        }), 200

    if user.verification_level >= 2:
        return jsonify({
            'risk_level': 'LOW',
            'recommended_action': 'PROCEED',
            'certainty': 'HIGH',
            'summary': 'Claims Match Single Verified Identity',
            'explanation': explanations + [
                f'Identity verified (Level {user.verification_level}).',
                f'Trust signal: {user.trust_signal}.',
            ],
        }), 200

    return jsonify({
        'risk_level': 'MEDIUM',
        'recommended_action': 'VERIFY',
        'certainty': 'MEDIUM',
        'summary': 'Basic Identity Match',
        'explanation': explanations + [
            'Identity has basic verification only. Request official document verification.',
        ],
    }), 200

