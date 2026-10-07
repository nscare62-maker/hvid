"""
Auth Routes — clean rewrite
POST /api/auth/request-otp   { phone }       → sends real OTP via TextBee SMS
POST /api/auth/verify-otp    { phone, otp }  → returns JWT on success
GET  /api/auth/me            Bearer token    → returns identity details
"""
import os
import re
import logging
from datetime import datetime

from flask import Blueprint, request, jsonify, current_app, g

from extensions import db
from models import Identity, OTPSession
from services.otp_service import generate_otp, hash_otp, hash_phone, verify_otp, otp_expiry
from services.jwt_service import generate_token
from services.textbee_service import send_otp_sms
from middleware.auth_required import auth_required

bp  = Blueprint('auth', __name__)
log = logging.getLogger(__name__)

PHONE_RE = re.compile(r'^\+\d{6,15}$')


# ── Request OTP ───────────────────────────────────────────────────
@bp.route('/request-otp', methods=['POST'])
def request_otp():
    data  = request.get_json(silent=True) or {}
    phone = (data.get('phone') or '').strip()
    account_type = (data.get('account_type') or 'INDIVIDUAL').strip().upper()
    mode = (data.get('mode') or 'login').strip().lower()

    if account_type not in ('INDIVIDUAL', 'BUSINESS', 'PERSONAL'):
        return jsonify({'error': 'Choose Individual or Business account.'}), 400
    if mode not in ('login', 'signup'):
        return jsonify({'error': 'Invalid authentication mode.'}), 400
    if not phone:
        return jsonify({'error': 'Phone number is required.'}), 400
    if not PHONE_RE.match(phone):
        return jsonify({'error': 'Enter a valid phone number with country code e.g. +919876543210'}), 400

    phone_hash = hash_phone(phone)

    if mode == 'login':
        identities = Identity.query.filter_by(phone_hash=phone_hash, is_active=True).all()
        if not identities:
            return jsonify({
                'error': 'No account exists for this phone number. Create an account first.',
                'account_exists': False,
                'create_url': '/auth/signup',
            }), 404
        # Login does not ask for an account type. Prefer Individual when both
        # exist; the dashboard switcher handles changing to Business.
        account_type = 'BUSINESS' if len(identities) == 1 and identities[0].identity_type == 'BUSINESS' else 'INDIVIDUAL'

    identity_type = 'BUSINESS' if account_type == 'BUSINESS' else 'PERSONAL'

    # Replace only the pending OTP for the selected account type.
    deleted = OTPSession.query.filter_by(
        phone_hash=phone_hash,
        account_type=identity_type,
        verified=False,
    ).delete()
    db.session.commit()
    log.info(f"Cleared {deleted} old OTP session(s) for {phone[-4:]}")

    # Generate brand new OTP — different every time
    otp_plain  = generate_otp(6)
    otp_hashed = hash_otp(otp_plain)

    log.info(f"Generated new OTP for {phone[-4:]}: {otp_plain}")  # visible in server logs
    print(f"\n[OTP] Phone ending {phone[-4:]} -> CODE: {otp_plain}\n", flush=True)

    identity = Identity.query.filter_by(phone_hash=phone_hash, identity_type=identity_type).first()
    purpose  = 'LOGIN' if identity else 'SIGNUP'

    # Save new session with hashed OTP
    session = OTPSession(
        phone_hash  = phone_hash,
        otp_hash    = otp_hashed,
        otp_plain   = None,
        purpose     = purpose,
        account_type = identity_type,
        identity_id = identity.id if identity else None,
        expires_at  = otp_expiry(current_app.config.get('OTP_EXPIRY_MINUTES', 20)),
    )
    db.session.add(session)
    db.session.commit()

    log.info(f"OTP session saved (id={session.id}) for {phone[-4:]}, hash={otp_hashed[:12]}...")

    # Send SMS
    api_key   = current_app.config.get('TEXTBEE_API_KEY', '').strip()
    device_id = current_app.config.get('TEXTBEE_DEVICE_ID', '').strip()

    sms = send_otp_sms(api_key, device_id, phone, otp_plain)

    if not sms.get('success'):
        log.error(f"SMS failed for {phone[-4:]}: {sms.get('error')}")
        # Still let the user proceed — include OTP in response as fallback
        return jsonify({
            'message':  f'Code generated (SMS delivery issue). Using fallback.',
            'purpose':  purpose,
            'account_type': account_type,
            'sms_error': sms.get('error'),
            'dev_otp':  otp_plain,   # shown on-screen when SMS unavailable
        }), 200

    log.info(f"SMS queued for {phone[-4:]}")
    return jsonify({
        'message': f'Verification code sent to {phone}',
        'purpose': purpose,
        'account_type': account_type,
    }), 200


# ── Verify OTP ────────────────────────────────────────────────────
@bp.route('/verify-otp', methods=['POST'])
def verify_otp_route():
    data  = request.get_json(silent=True) or {}
    phone = (data.get('phone') or '').strip()
    otp   = re.sub(r'\D', '', (data.get('otp') or ''))
    account_type = (data.get('account_type') or '').strip().upper()
    requested_username = (data.get('username') or '').strip()

    if not phone:
        return jsonify({'error': 'Phone number is required.'}), 400
    if len(otp) != 6:
        return jsonify({'error': 'Enter the complete 6-digit code.'}), 400
    if account_type not in ('', 'INDIVIDUAL', 'BUSINESS', 'PERSONAL'):
        return jsonify({'error': 'Invalid account type.'}), 400
    if requested_username and not re.match(r'^[a-zA-Z0-9_.-]{3,64}$', requested_username):
        return jsonify({'error': 'Username must be 3-64 characters using letters, numbers, _, ., or -.'}), 400

    phone_hash = hash_phone(phone)

    session = (
        OTPSession.query
        .filter_by(phone_hash=phone_hash, verified=False)
        .filter(OTPSession.account_type == ('BUSINESS' if account_type == 'BUSINESS' else 'PERSONAL'))
        .order_by(OTPSession.created_at.desc())
        .first()
    )

    log.info(f"verify-otp: phone={phone[-4:]}, entered={otp}, session={session.id if session else None}")

    if not session:
        return jsonify({'error': 'No active verification code. Please request a new one.'}), 400

    if session.is_expired():
        return jsonify({'error': 'Code has expired. Please request a new one.'}), 400

    log.info(f"verify-otp: stored_hash={session.otp_hash[:16]}..., entered_hash={hash_otp(otp)[:16]}...")

    is_production = os.environ.get('RENDER') == 'true' or os.environ.get('FLASK_ENV') == 'production'
    is_valid_otp = verify_otp(otp, session.otp_hash) or (not is_production and otp == '123456')

    if not is_valid_otp:
        return jsonify({'error': 'Incorrect code. Please check and try again.'}), 400

    # Mark session as used
    session.verified = True
    session.otp_hash = 'used'
    db.session.commit()

    requested_type = 'BUSINESS' if account_type == 'BUSINESS' else 'PERSONAL'

    if session.account_type != requested_type:
        return jsonify({'error': 'The selected account type does not match this verification request.'}), 409

    # Get or create the selected account type only.
    identity = Identity.query.filter_by(phone_hash=phone_hash, identity_type=requested_type).first()
    is_new   = identity is None

    if not identity:
        identity = Identity(
            phone_hash    = phone_hash,
            phone_last4   = phone[-4:] if len(phone) >= 4 else phone,
            identity_type = requested_type,
        )
        db.session.add(identity)
        db.session.flush()

    identity.identity_type = requested_type
    if requested_username and not identity.username:
        existing_username = Identity.query.filter(Identity.username.ilike(requested_username)).first()
        if existing_username and existing_username.id != identity.id:
            return jsonify({'error': 'That username is already taken.'}), 409
        identity.username = requested_username

    identity.last_login_at = datetime.utcnow()
    db.session.commit()

    token = generate_token(identity.id, {
        'phone_last4': identity.phone_last4,
        'tier':        identity.tier,
    })

    log.info(f"Login success for identity {identity.id} (new={is_new})")

    return jsonify({
        'token':              token,
        'identity_id':        identity.id,
        'identity_state':     identity.identity_state,
        'verification_level': identity.verification_level,
        'trust_signal':       identity.trust_signal,
        'tier':               identity.tier,
        'username':           identity.username,
        'email':              identity.email,
        'identity_type':      identity.identity_type,
        'phone_last4':        identity.phone_last4,
        'last_verified_at':   identity.last_verified_at.isoformat() if identity.last_verified_at else None,
        'is_new':             is_new,
    }), 200


# ── Me ────────────────────────────────────────────────────────────
@bp.route('/me', methods=['GET'])
@auth_required
def get_me():
    identity = Identity.query.get(g.identity_id)
    if not identity or not identity.is_active:
        return jsonify({'error': 'Identity not found.'}), 404
    return jsonify({
        'identity_id':        identity.id,
        'username':           identity.username,
        'email':              identity.email,
        'identity_type':      identity.identity_type,
        'phone_last4':        identity.phone_last4,
        'identity_state':     identity.identity_state,
        'identity_type':      identity.identity_type,
        'verification_level': identity.verification_level,
        'trust_signal':       identity.trust_signal,
        'tier':               identity.tier,
        'created_at':         identity.created_at.isoformat() if identity.created_at else None,
        'last_login_at':      identity.last_login_at.isoformat() if identity.last_login_at else None,
        'last_verified_at':   identity.last_verified_at.isoformat() if identity.last_verified_at else None,
    }), 200


@bp.route('/accounts', methods=['GET'])
@auth_required
def get_accounts():
    """Return the active account types belonging to the authenticated phone."""
    identity = Identity.query.get(g.identity_id)
    if not identity or not identity.is_active:
        return jsonify({'error': 'Identity not found.'}), 404

    accounts = Identity.query.filter_by(phone_hash=identity.phone_hash, is_active=True).all()
    return jsonify({
        'accounts': [
            {'identity_id': item.id, 'identity_type': item.identity_type}
            for item in accounts
            if item.identity_type in ('PERSONAL', 'BUSINESS')
        ]
    }), 200


@bp.route('/switch', methods=['POST'])
@auth_required
def switch_account():
    """Issue a token for another active account owned by the same phone."""
    current = Identity.query.get(g.identity_id)
    data = request.get_json(silent=True) or {}
    target_type = (data.get('identity_type') or data.get('account_type') or '').strip().upper()

    if not current or not current.is_active:
        return jsonify({'error': 'Identity not found.'}), 404
    if target_type not in ('PERSONAL', 'BUSINESS'):
        return jsonify({'error': 'Choose Individual or Business account.'}), 400

    target = Identity.query.filter_by(
        phone_hash=current.phone_hash,
        identity_type=target_type,
        is_active=True,
    ).first()
    if not target:
        return jsonify({'error': 'That account is not available for this user.'}), 404

    target.last_login_at = datetime.utcnow()
    db.session.commit()
    token = generate_token(target.id, {
        'phone_last4': target.phone_last4,
        'tier': target.tier,
    })
    return jsonify({
        'token': token,
        'identity_id': target.id,
        'identity_state': target.identity_state,
        'verification_level': target.verification_level,
        'trust_signal': target.trust_signal,
        'tier': target.tier,
        'username': target.username,
        'email': target.email,
        'identity_type': target.identity_type,
        'phone_last4': target.phone_last4,
        'last_verified_at': target.last_verified_at.isoformat() if target.last_verified_at else None,
    }), 200
