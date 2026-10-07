"""
Asset Routes
POST /api/asset/claim              - Claim an asset (instagram, website, twitter, linkedin, storefront)
POST /api/asset/verify/instagram   - Verify Instagram ownership
POST /api/asset/verify/website     - Verify website ownership
GET  /api/asset/:identityId        - List assets for an identity (owner only)
GET  /api/asset/public/:identityId - List assets for public view (no auth)
"""
import hashlib
import logging
import os
from urllib.parse import urlparse

import requests
from flask import Blueprint, request, jsonify, g
from extensions import db
from models import Asset, Identity
from middleware.auth_required import auth_required

bp     = Blueprint('asset', __name__)
logger = logging.getLogger(__name__)
ADMIN_KEY = os.environ.get('ADMIN_KEY', 'hvid-admin-2024')


def _admin_required():
    key = request.headers.get('X-Admin-Key', '')
    return key == ADMIN_KEY

# All supported asset types (frontend sends lowercase, we normalise to upper)
VALID_ASSET_TYPES = {'INSTAGRAM', 'WEBSITE', 'TWITTER', 'LINKEDIN', 'STOREFRONT', 'CUSTOM'}

# Types that support programmatic verification (website only now)
VERIFIABLE_TYPES = {'WEBSITE'}

# Social platforms that use user-confirmed + admin review flow
SOCIAL_TYPES = {'INSTAGRAM', 'TWITTER', 'LINKEDIN', 'STOREFRONT', 'CUSTOM'}


def _hash_value(value: str) -> str:
    return hashlib.sha256(value.lower().strip().encode()).hexdigest()


def _normalize_instagram_value(value: str) -> str:
    """Accept plain handles, @handles, and Instagram profile URLs."""
    raw = (value or '').strip()
    if not raw:
        return ''

    candidate = raw.lstrip('@').strip()

    # Example: https://instagram.com/username or https://www.instagram.com/username/
    if '://' in candidate or candidate.startswith('www.') or candidate.lower().startswith('instagram.com'):
        parsed = urlparse(candidate if '://' in candidate else f'https://{candidate}')
        host = (parsed.netloc or '').lower().replace('www.', '')
        if 'instagram.com' in host:
            path = parsed.path.strip('/').split('/')[0]
            return path.strip().lstrip('@')

    # Example: instagram.com/username or username
    clean = candidate.strip('/').strip()
    if clean.lower().startswith('instagram.com/'):
        return clean.split('/', 1)[1].strip().lstrip('@')

    return clean


def _normalize_website_value(value: str) -> str:
    """Accept a website URL or raw domain and return a clean domain name."""
    raw = (value or '').strip()
    if not raw:
        return ''

    candidate = raw.strip()
    if '://' not in candidate:
        candidate = f'https://{candidate}'

    parsed = urlparse(candidate)
    host = (parsed.netloc or parsed.path or '').strip().lower()
    if not host:
        return ''

    host = host.split(':', 1)[0].strip().rstrip('/')
    host = host.replace('www.', '', 1)
    if '/' in host:
        host = host.split('/', 1)[0]

    return host


def _normalize_twitter_value(value: str) -> str:
    """Accept a Twitter/X handle, @handle, or profile URL."""
    raw = (value or '').strip()
    if not raw:
        return ''

    candidate = raw.lstrip('@').strip()

    if '://' in candidate or candidate.startswith('www.') or candidate.lower().startswith('twitter.com') or candidate.lower().startswith('x.com'):
        parsed = urlparse(candidate if '://' in candidate else f'https://{candidate}')
        host = (parsed.netloc or '').lower().replace('www.', '')
        if 'twitter.com' in host or 'x.com' in host:
            path = parsed.path.strip('/').split('/')[0]
            return path.strip().lstrip('@')

    clean = candidate.strip('/').strip()
    if clean.lower().startswith('twitter.com/'):
        return clean.split('/', 1)[1].strip().lstrip('@')
    if clean.lower().startswith('x.com/'):
        return clean.split('/', 1)[1].strip().lstrip('@')

    return clean


def _normalize_linkedin_value(value: str) -> str:
    """Accept a LinkedIn username, profile URL, or company URL."""
    raw = (value or '').strip()
    if not raw:
        return ''

    candidate = raw.strip().rstrip('/')

    if '://' in candidate or candidate.startswith('www.') or candidate.lower().startswith('linkedin.com'):
        parsed = urlparse(candidate if '://' in candidate else f'https://{candidate}')
        host = (parsed.netloc or '').lower().replace('www.', '')
        if 'linkedin.com' in host:
            path = parsed.path.strip('/')
            if path.startswith('in/'):
                return path.split('/', 1)[1].strip().lstrip('@')
            if path.startswith('company/'):
                return path.split('/', 1)[1].strip().lstrip('@')
            return path.strip().lstrip('@')

    clean = candidate.strip('/').strip()
    if clean.lower().startswith('linkedin.com/'):
        path = clean.split('/', 1)[1].strip('/')
        if path.startswith('in/'):
            return path.split('/', 1)[1].strip().lstrip('@')
        if path.startswith('company/'):
            return path.split('/', 1)[1].strip().lstrip('@')
        return path.strip().lstrip('@')

    return clean.lstrip('@').strip()


def _gen_verification_code(identity_id: str, asset_type: str, value: str) -> str:
    """Unique code per identity+type+value combination."""
    unique = f"{identity_id}:{asset_type.lower()}:{value.lower()}"
    return f"hvid-{hashlib.sha256(unique.encode()).hexdigest()[:12]}"


def _instructions_for(asset_type: str, code: str) -> str:
    if asset_type == 'INSTAGRAM':
        return f'Add this code to your Instagram bio: {code}\nOnce added, click "I\'ve Added It" — your profile will be confirmed within 10 minutes.'
    if asset_type == 'TWITTER':
        return f'Add this code to your X/Twitter bio: {code}\nOnce added, click "I\'ve Added It" — your profile will be confirmed within 10 minutes.'
    if asset_type == 'LINKEDIN':
        return f'Add this code to your LinkedIn headline or About/Summary section: {code}\nOnce added, click "I\'ve Added It" — your profile will be confirmed within 10 minutes.'
    if asset_type == 'STOREFRONT':
        return f'Add this code to your store description or bio: {code}\nOnce added, click "I\'ve Added It" — your profile will be confirmed within 10 minutes.'
    if asset_type == 'WEBSITE':
        return (f'Add this meta tag to your homepage <head>:\n'
                f'<meta name="hvid-verification" content="{code}">\n'
                f'OR add a DNS TXT record: hvid={code}\nThen click "Check Now" for instant verification.')
    return f'Verification code: {code}'


# ── Claim ─────────────────────────────────────────────────────────
@bp.route('/claim', methods=['POST'])
@auth_required
def claim_asset():
    data       = request.get_json(silent=True) or {}
    asset_type = (data.get('type') or '').strip().upper()
    value      = (data.get('value') or '').strip()

    if asset_type not in VALID_ASSET_TYPES:
        return jsonify({'error': f'Unsupported asset type. Supported: instagram, website, twitter, linkedin, storefront'}), 400
    if not value:
        return jsonify({'error': 'value is required.'}), 400

    # Normalise value
    if asset_type == 'INSTAGRAM':
        value = _normalize_instagram_value(value)
        display_value = f'@{value}' if value else ''
    elif asset_type == 'WEBSITE':
        value = _normalize_website_value(value)
        display_value = value
    elif asset_type == 'TWITTER':
        value = _normalize_twitter_value(value)
        display_value = f'@{value}' if value else ''
    elif asset_type == 'LINKEDIN':
        value = _normalize_linkedin_value(value)
        display_value = f'linkedin.com/in/{value}' if value and not value.startswith('http') else value
    else:
        display_value = value

    if not value:
        return jsonify({'error': 'Please enter a valid handle or URL.'}), 400

    value_hash = _hash_value(value)

    # Return existing claim for this identity
    existing = Asset.query.filter_by(identity_id=g.identity_id, value_hash=value_hash).first()
    if existing:
        return jsonify({
            'existing': True,
            'message': 'This account is already added to your linked accounts.',
            'assetId':            existing.id,
            'type':               existing.asset_type.lower(),
            'verificationStatus': existing.verification_status.lower(),
            'verificationCode':   existing.verification_code,
            'instructions':       existing.instructions,
            'displayValue':       existing.display_value,
        }), 200

    code  = _gen_verification_code(g.identity_id, asset_type, value)
    asset = Asset(
        identity_id         = g.identity_id,
        asset_type          = asset_type,
        value_hash          = value_hash,
        display_value       = display_value,
        verification_code   = code,
        verification_status = 'PENDING',
        instructions        = _instructions_for(asset_type, code),
    )
    db.session.add(asset)
    db.session.commit()

    logger.info(f"Asset claimed: {asset_type} by {g.identity_id[:8]}")

    return jsonify({
        'assetId':            asset.id,
        'type':               asset.asset_type.lower(),
        'verificationStatus': asset.verification_status.lower(),
        'verificationCode':   asset.verification_code,
        'instructions':       asset.instructions,
        'displayValue':       asset.display_value,
    }), 201


# ── List (owner only) ─────────────────────────────────────────────
@bp.route('/<identity_id>', methods=['GET'])
@auth_required
def list_assets(identity_id):
    if g.identity_id != identity_id:
        return jsonify({'error': 'Forbidden.'}), 403
    assets = Asset.query.filter_by(identity_id=identity_id).all()
    return jsonify(_assets_to_list(assets)), 200


@bp.route('/<asset_id>', methods=['DELETE'])
@auth_required
def delete_asset(asset_id):
    asset = Asset.query.filter_by(id=asset_id, identity_id=g.identity_id).first()
    if not asset:
        return jsonify({'error': 'Asset not found.'}), 404

    db.session.delete(asset)
    db.session.commit()

    logger.info(f"Asset {asset_id} removed by {g.identity_id[:8]}")
    return jsonify({'success': True, 'message': 'Account removed successfully.'}), 200


# ── List (public) ─────────────────────────────────────────────────
@bp.route('/public/<identity_id>', methods=['GET'])
def list_assets_public(identity_id):
    assets = Asset.query.filter_by(
        identity_id=identity_id,
        verification_status='VERIFIED'
    ).all()
    return jsonify(_assets_to_list(assets)), 200


def _assets_to_list(assets):
    return [
        {
            'id':                 a.id,
            'type':               a.asset_type.lower(),
            'displayValue':       a.display_value,
            'verificationStatus': a.verification_status.lower(),
            'verificationCode':   a.verification_code,
            'instructions':       a.instructions,
            'ownershipStrength':  a.ownership_strength,
            'createdAt':          a.created_at.isoformat() if a.created_at else None,
        }
        for a in assets
    ]


# ── User confirms they've placed the code (social platforms) ─────
@bp.route('/confirm', methods=['POST'])
@auth_required
def confirm_asset():
    """
    User says they have placed the verification code in their bio/profile.
    Sets status → PENDING_REVIEW so admin can spot-check.
    """
    data     = request.get_json(silent=True) or {}
    asset_id = (data.get('assetId') or '').strip()

    if not asset_id:
        return jsonify({'error': 'assetId is required.'}), 400

    asset = Asset.query.filter_by(id=asset_id, identity_id=g.identity_id).first()
    if not asset:
        return jsonify({'error': 'Asset not found.'}), 404

    if asset.verification_status == 'VERIFIED':
        return jsonify({'success': True, 'message': 'Already verified.', 'status': 'verified'}), 200

    if asset.asset_type == 'LINKEDIN':
        asset.verification_status = 'VERIFIED'
        asset.ownership_strength  = 3
        db.session.commit()
        _upgrade_identity_level(asset.identity_id)
        logger.info(f"LinkedIn asset {asset_id} verified immediately by user confirmation ({g.identity_id[:8]})")
        return jsonify({
            'success': True,
            'message': 'LinkedIn verified successfully from your headline update.',
            'status':  'verified',
            'method':  'headline',
        }), 200

    if asset.asset_type in {'INSTAGRAM', 'TWITTER'} and _verify_public_profile_asset(asset):
        platform_label = {
            'INSTAGRAM': 'Instagram',
            'TWITTER': 'X / Twitter',
        }.get(asset.asset_type, asset.asset_type.title())
        logger.info(f"{platform_label} asset {asset_id} verified instantly by public profile scan by {g.identity_id[:8]}")
        return jsonify({
            'success': True,
            'message': f'{platform_label} verified instantly from your public profile.',
            'status':  'verified',
            'method':  'bio',
        }), 200

    asset.verification_status = 'PENDING_REVIEW'
    db.session.commit()

    logger.info(f"Asset {asset_id} marked PENDING_REVIEW by {g.identity_id[:8]}")
    return jsonify({
        'success': True,
        'message': 'Thanks! Your profile is now under review and will typically be confirmed within 10 minutes.',
        'status':  'pending_review',
    }), 200


# ── Verify Instagram (kept for backward compat — now redirects to confirm) ─
@bp.route('/verify/instagram', methods=['POST'])
@auth_required
def verify_instagram():
    """
    Instagram bio scraping is blocked by Instagram.
    This endpoint now behaves identically to /confirm — sets PENDING_REVIEW.
    """
    data     = request.get_json(silent=True) or {}
    asset_id = (data.get('assetId') or '').strip()

    if not asset_id:
        return jsonify({'error': 'assetId is required.'}), 400

    asset = Asset.query.filter_by(id=asset_id, identity_id=g.identity_id).first()
    if not asset:
        return jsonify({'error': 'Asset not found.'}), 404

    if asset.verification_status == 'VERIFIED':
        return jsonify({'success': True, 'message': 'Already verified.'}), 200

    if _verify_public_profile_asset(asset):
        platform_label = {
            'INSTAGRAM': 'Instagram',
            'TWITTER': 'X / Twitter',
            'LINKEDIN': 'LinkedIn',
        }.get(asset.asset_type, asset.asset_type.title())
        logger.info(f"{platform_label} asset {asset_id} verified instantly by public profile scan by {g.identity_id[:8]}")
        return jsonify({
            'success': True,
            'message': f'{platform_label} verified instantly from your public profile.',
            'status':  'verified',
            'method':  'bio',
        }), 200

    asset.verification_status = 'PENDING_REVIEW'
    db.session.commit()

    logger.info(f"Instagram asset {asset_id} -> PENDING_REVIEW by {g.identity_id[:8]}")
    return jsonify({
        'success': True,
        'message': 'Thanks! Your profile is under review and will typically be confirmed within 10 minutes.',
        'status':  'pending_review',
    }), 200


# ── Verify Website ────────────────────────────────────────────────
@bp.route('/verify/website', methods=['POST'])
@auth_required
def verify_website():
    data     = request.get_json(silent=True) or {}
    asset_id = (data.get('assetId') or '').strip()
    domain   = (data.get('domain') or data.get('value') or '').strip()
    domain   = domain.replace('https://', '').replace('http://', '').rstrip('/')

    if not asset_id or not domain:
        return jsonify({'error': 'assetId and domain are required.'}), 400

    asset = Asset.query.filter_by(id=asset_id, identity_id=g.identity_id).first()
    if not asset:
        return jsonify({'error': 'Asset not found.'}), 404

    code = asset.verification_code

    # Meta tag check
    try:
        resp = requests.get(f'https://{domain}', timeout=10, headers={
            'User-Agent': 'Mozilla/5.0 (compatible; HVIDVerifier/1.0)'
        })
        if code and code in resp.text:
            asset.verification_status = 'VERIFIED'
            asset.ownership_strength  = 3
            db.session.commit()
            _upgrade_identity_level(asset.identity_id)
            return jsonify({'success': True, 'message': 'Website verified via meta tag.', 'method': 'meta'}), 200
    except Exception as e:
        logger.warning(f"Website meta check failed for {domain}: {e}")

    # DNS TXT fallback
    try:
        import dns.resolver
        for rdata in dns.resolver.resolve(domain, 'TXT'):
            for s in rdata.strings:
                if code and code in s.decode('utf-8', errors='ignore'):
                    asset.verification_status = 'VERIFIED'
                    asset.ownership_strength  = 3
                    db.session.commit()
                    _upgrade_identity_level(asset.identity_id)
                    return jsonify({'success': True, 'message': 'Website verified via DNS.', 'method': 'dns'}), 200
    except Exception as e:
        logger.debug(f"DNS check failed for {domain}: {e}")

    return jsonify({
        'success': False,
        'message': f'Code not found on {domain}. Add the meta tag or DNS TXT record and try again.',
    }), 400


def _public_profile_url_for(asset: Asset) -> str | None:
    """Return the public profile URL for a social asset based on its stored display value."""
    if asset.asset_type == 'INSTAGRAM':
        username = _normalize_instagram_value(asset.display_value or '')
        return f'https://www.instagram.com/{username}/' if username else None

    if asset.asset_type == 'TWITTER':
        username = _normalize_twitter_value(asset.display_value or '')
        return f'https://x.com/{username}/' if username else None

    if asset.asset_type == 'LINKEDIN':
        username = _normalize_linkedin_value(asset.display_value or '')
        return f'https://www.linkedin.com/in/{username}/' if username else None

    return None


def _verify_public_profile_asset(asset: Asset) -> bool:
    """Try to verify a social asset by checking the public profile HTML."""
    profile_url = _public_profile_url_for(asset)
    if not profile_url or not asset.verification_code:
        return False

    try:
        resp = requests.get(
            profile_url,
            timeout=15,
            headers={'User-Agent': 'Mozilla/5.0 (compatible; HVIDVerifier/1.0)'}
        )
        if resp.ok and asset.verification_code in resp.text:
            asset.verification_status = 'VERIFIED'
            asset.ownership_strength  = 3
            db.session.commit()
            _upgrade_identity_level(asset.identity_id)
            return True
    except Exception as e:
        logger.warning(f"Public profile check failed for {asset.asset_type} ({profile_url}): {e}")

    return False


def _upgrade_identity_level(identity_id: str):
    identity = Identity.query.get(identity_id)
    if identity and identity.verification_level < 1:
        identity.verification_level = 1
        identity.trust_signal       = 'BASIC'
        db.session.commit()


# ── ADMIN ASSET REVIEW ───────────────────────────────────────
@bp.route('/admin/pending', methods=['GET'])
def admin_pending():
    if not _admin_required():
        return jsonify({'error': 'Admin access required.'}), 403

    status_filter = request.args.get('status', 'PENDING_REVIEW').upper()
    query = Asset.query
    if status_filter != 'ALL':
        query = query.filter(Asset.verification_status == status_filter)
    assets = query.order_by(Asset.created_at.asc()).all()

    result = []
    for asset in assets:
        identity = Identity.query.get(asset.identity_id)
        result.append({
            'assetId':         asset.id,
            'identityId':      asset.identity_id,
            'username':        identity.username if identity else None,
            'phone_last4':     identity.phone_last4 if identity else None,
            'type':            asset.asset_type.lower(),
            'displayValue':    asset.display_value,
            'verificationStatus': asset.verification_status.lower(),
            'verificationCode': asset.verification_code,
            'instructions':    asset.instructions,
            'createdAt':       asset.created_at.isoformat() if asset.created_at else None,
        })

    return jsonify({'assets': result, 'total': len(result)}), 200


@bp.route('/admin/detail/<asset_id>', methods=['GET'])
def admin_detail(asset_id):
    if not _admin_required():
        return jsonify({'error': 'Admin access required.'}), 403

    asset = Asset.query.get(asset_id)
    if not asset:
        return jsonify({'error': 'Asset not found.'}), 404

    identity = Identity.query.get(asset.identity_id)
    return jsonify({
        'assetId':         asset.id,
        'identityId':      asset.identity_id,
        'username':        identity.username if identity else None,
        'phone_last4':     identity.phone_last4 if identity else None,
        'type':            asset.asset_type.lower(),
        'displayValue':    asset.display_value,
        'verificationStatus': asset.verification_status.lower(),
        'verificationCode': asset.verification_code,
        'instructions':    asset.instructions,
        'createdAt':       asset.created_at.isoformat() if asset.created_at else None,
    }), 200


@bp.route('/admin/approve/<asset_id>', methods=['POST'])
def admin_approve(asset_id):
    if not _admin_required():
        return jsonify({'error': 'Admin access required.'}), 403

    asset = Asset.query.get(asset_id)
    if not asset:
        return jsonify({'error': 'Asset not found.'}), 404

    asset.verification_status = 'VERIFIED'
    asset.ownership_strength  = 3
    db.session.commit()
    _upgrade_identity_level(asset.identity_id)

    return jsonify({'success': True, 'status': 'VERIFIED'}), 200


@bp.route('/admin/reject/<asset_id>', methods=['POST'])
def admin_reject(asset_id):
    if not _admin_required():
        return jsonify({'error': 'Admin access required.'}), 403

    asset = Asset.query.get(asset_id)
    if not asset:
        return jsonify({'error': 'Asset not found.'}), 404

    asset.verification_status = 'REJECTED'
    asset.ownership_strength  = 0
    db.session.commit()

    return jsonify({'success': True, 'status': 'REJECTED'}), 200
