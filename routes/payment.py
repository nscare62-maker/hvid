"""
Payment Routes — Razorpay integration
POST /api/payment/create-order   → create Razorpay order for tier upgrade
POST /api/payment/verify         → verify payment signature & upgrade tier
GET  /api/payment/plans          → list available plans
"""
import os
import hmac
import hashlib
import logging
from flask import Blueprint, request, jsonify, g, current_app
from extensions import db
from models import Identity, KYC, PlanPurchase
from middleware.auth_required import auth_required

bp     = Blueprint('payment', __name__)
logger = logging.getLogger(__name__)

# ── Plans ─────────────────────────────────────────────────────────
PLANS = {
    'VERIFIED': {
        'name':        'Verified Plan',
        'description': 'Unlock KYC document verification and Verified tier badge',
        'amount':      49900,   # ₹499 in paise
        'currency':    'INR',
        'tier':        'VERIFIED',
    },
    'PREMIUM': {
        'name':        'Premium Plan',
        'description': 'Unlock face biometric verification and Premium tier badge',
        'amount':      99900,   # ₹999 in paise
        'currency':    'INR',
        'tier':        'PREMIUM',
    },
}


def _razorpay_client():
    import razorpay
    key_id     = os.environ.get('RAZORPAY_KEY_ID', '')
    key_secret = os.environ.get('RAZORPAY_KEY_SECRET', '')
    if not key_id or not key_secret or 'YourKey' in key_id:
        return None, 'Razorpay keys not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to .env'
    return razorpay.Client(auth=(key_id, key_secret)), None


# ── List plans ────────────────────────────────────────────────────
@bp.route('/plans', methods=['GET'])
def list_plans():
    return jsonify({
        'plans': [
            {
                'id':          plan_id,
                'name':        plan['name'],
                'description': plan['description'],
                'amount':      plan['amount'],
                'amount_display': f"₹{plan['amount'] // 100}",
                'currency':    plan['currency'],
                'tier':        plan['tier'],
            }
            for plan_id, plan in PLANS.items()
        ]
    }), 200


@bp.route('/purchases', methods=['GET'])
@auth_required
def list_purchases():
    identity = Identity.query.get(g.identity_id)
    plan_ids = [
        plan_id for plan_id in PLANS
        if identity and identity.has_plan_entitlement(plan_id)
    ]
    return jsonify({'plan_ids': plan_ids}), 200


# ── Create order ──────────────────────────────────────────────────
@bp.route('/create-order', methods=['POST'])
@auth_required
def create_order():
    """
    POST /api/payment/create-order
    Body: { plan_id: "VERIFIED" | "PREMIUM" }
    Returns Razorpay order details for checkout.
    """
    data    = request.get_json(silent=True) or {}
    plan_id = (data.get('plan_id') or '').strip().upper()
    purpose = (data.get('purpose') or 'UPGRADE').strip().upper()

    if plan_id not in PLANS:
        return jsonify({'error': f'Invalid plan. Choose from: {", ".join(PLANS)}'}), 400

    identity = Identity.query.get(g.identity_id)
    if not identity:
        return jsonify({'error': 'Identity not found.'}), 404
    if purpose not in ('UPGRADE', 'KYC', 'PREMIUM'):
        return jsonify({'error': 'Invalid payment purpose.'}), 400
    if purpose in ('UPGRADE', 'KYC') and identity.identity_type != 'BUSINESS':
        return jsonify({'error': 'Payments and business verification plans are available only for Business accounts.'}), 403
    if purpose == 'KYC' and plan_id != 'VERIFIED':
        return jsonify({'error': 'Government ID verification requires the Verified plan.'}), 400
    if purpose == 'PREMIUM' and plan_id != 'PREMIUM':
        return jsonify({'error': 'Premium payments require the Premium plan.'}), 400

    if identity.has_plan_entitlement(plan_id):
        return jsonify({'error': 'This plan has already been purchased.'}), 409

    plan = PLANS[plan_id]

    client, err = _razorpay_client()
    if err:
        return jsonify({'error': err}), 503

    try:
        order = client.order.create({
            'amount':   plan['amount'],
            'currency': plan['currency'],
            'receipt':  f'hvid_{g.identity_id[:8]}_{plan_id.lower()}',
            'notes': {
                'identity_id': g.identity_id,
                'plan_id':     plan_id,
                'tier':        plan['tier'],
                'purpose':     purpose,
            }
        })

        logger.info(f"Razorpay order created: {order['id']} for identity {g.identity_id}, plan={plan_id}")

        return jsonify({
            'order_id':    order['id'],
            'amount':      order['amount'],
            'currency':    order['currency'],
            'key_id':      os.environ.get('RAZORPAY_KEY_ID', ''),
            'plan_id':     plan_id,
            'plan_name':   plan['name'],
            'description': plan['description'],
            'purpose':     purpose,
            'prefill': {
                'name':    identity.username or 'HVID User',
                'contact': f'+91{identity.phone_last4}' if identity.phone_last4 else '',
            },
        }), 200

    except Exception as e:
        logger.error(f"Razorpay order creation failed: {e}")
        return jsonify({'error': 'Payment service error. Please try again.'}), 503


# ── Verify payment ────────────────────────────────────────────────
@bp.route('/verify', methods=['POST'])
@auth_required
def verify_payment():
    """
    POST /api/payment/verify
    Body: {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        plan_id
    }
    Verifies HMAC signature and upgrades tier.
    """
    data = request.get_json(silent=True) or {}

    order_id   = (data.get('razorpay_order_id')   or '').strip()
    payment_id = (data.get('razorpay_payment_id')  or '').strip()
    signature  = (data.get('razorpay_signature')   or '').strip()
    plan_id    = (data.get('plan_id')              or '').strip().upper()
    purpose    = (data.get('purpose')              or 'UPGRADE').strip().upper()

    if not all([order_id, payment_id, signature, plan_id]):
        return jsonify({'error': 'Missing payment fields.'}), 400

    if plan_id not in PLANS or purpose not in ('UPGRADE', 'KYC', 'PREMIUM'):
        return jsonify({'error': 'Invalid plan.'}), 400
    if purpose == 'KYC' and plan_id != 'VERIFIED':
        return jsonify({'error': 'Government ID verification requires the Verified plan.'}), 400
    if purpose == 'PREMIUM' and plan_id != 'PREMIUM':
        return jsonify({'error': 'Premium payments require the Premium plan.'}), 400

    key_secret = os.environ.get('RAZORPAY_KEY_SECRET', '')
    if not key_secret or 'YourKey' in key_secret:
        return jsonify({'error': 'Payment not configured.'}), 503

    # Verify HMAC-SHA256 signature
    expected_sig = hmac.new(
        key_secret.encode('utf-8'),
        f'{order_id}|{payment_id}'.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(expected_sig, signature):
        logger.warning(f"Invalid Razorpay signature for order {order_id}")
        return jsonify({'error': 'Payment verification failed. Invalid signature.'}), 400

    client, err = _razorpay_client()
    if err:
        return jsonify({'error': err}), 503

    try:
        order = client.order.fetch(order_id)
        payment = client.payment.fetch(payment_id)
    except Exception as exc:
        logger.warning(f'Razorpay verification lookup failed for order {order_id}: {exc}')
        return jsonify({'error': 'Could not confirm this payment with Razorpay.'}), 400

    plan = PLANS[plan_id]
    if (
        str(order.get('id')) != order_id
        or order.get('amount') != plan['amount']
        or order.get('currency') != plan['currency']
        or order.get('notes', {}).get('identity_id') != g.identity_id
        or order.get('notes', {}).get('plan_id') != plan_id
        or order.get('notes', {}).get('purpose', 'UPGRADE') != purpose
        or str(payment.get('order_id')) != order_id
        or payment.get('amount') != plan['amount']
        or payment.get('status') != 'captured'
    ):
        logger.warning(f'Razorpay payment mismatch for identity {g.identity_id}, order={order_id}')
        return jsonify({'error': 'Payment could not be matched to this Business account and plan.'}), 400

    # Signature and Razorpay order/payment data are valid — upgrade the identity.
    identity = Identity.query.get(g.identity_id)
    if not identity:
        return jsonify({'error': 'Identity not found.'}), 404
    if identity.identity_type != 'BUSINESS':
        return jsonify({'error': 'Payments and upgrade plans are available only for Business accounts.'}), 403

    if PlanPurchase.query.filter_by(identity_id=identity.id).first() is None:
        legacy_plan_ids = (
            ('VERIFIED', 'PREMIUM') if identity.tier == 'PREMIUM'
            else ('VERIFIED',) if identity.tier == 'VERIFIED'
            else ()
        )
        for legacy_plan_id in legacy_plan_ids:
            db.session.add(PlanPurchase(
                identity_id=identity.id,
                plan_id=legacy_plan_id,
                amount=0,
                currency='INR',
                purpose='LEGACY',
                source='LEGACY',
            ))

    new_tier = plan['tier']
    tier_order = {'FREE': 0, 'VERIFIED': 1, 'PREMIUM': 2}
    current_tier = identity.tier or 'FREE'
    effective_tier = max((current_tier, new_tier), key=lambda tier: tier_order.get(tier, 0))

    identity.tier = effective_tier
    if new_tier == 'VERIFIED' and identity.verification_level < 1:
        identity.verification_level = 1

    existing_purchase = PlanPurchase.query.filter_by(razorpay_payment_id=payment_id).first()
    if existing_purchase and (
        existing_purchase.identity_id != identity.id or existing_purchase.plan_id != plan_id
    ):
        return jsonify({'error': 'This payment has already been applied to a different plan.'}), 409
    if not existing_purchase:
        db.session.add(PlanPurchase(
            identity_id=identity.id,
            plan_id=plan_id,
            razorpay_order_id=order_id,
            razorpay_payment_id=payment_id,
            amount=plan['amount'],
            currency=plan['currency'],
            purpose=purpose,
        ))

    redirect_url = None
    if purpose == 'KYC':
        kyc = (
            KYC.query
            .filter_by(identity_id=g.identity_id)
            .filter(KYC.status.in_(['PENDING', 'UNDER_REVIEW']))
            .first()
        )
        if not kyc:
            kyc = KYC(identity_id=g.identity_id, status='PENDING')
            db.session.add(kyc)
            db.session.flush()
        kyc.redirect_url = f'/kyc/mock?id={kyc.id}'
        redirect_url = kyc.redirect_url
    db.session.commit()

    logger.info(f"Payment verified for identity {g.identity_id}, plan={plan_id}, order={order_id}")

    return jsonify({
        'success':  True,
        'tier':     effective_tier,
        'plan_id':  plan_id,
        'purpose':  purpose,
        'redirect_url': redirect_url,
        'message':  (
            f'Payment successful! Your account is on the {effective_tier} tier.'
            if effective_tier != new_tier
            else f'Payment successful! Your account has been upgraded to {new_tier} tier.'
        ),
    }), 200
