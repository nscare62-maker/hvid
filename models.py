"""
HVID Database Models
Imports db from extensions.py to break circular imports.
"""
import uuid
from datetime import datetime
from extensions import db


def gen_uuid():
    return str(uuid.uuid4())


# ── Identity ─────────────────────────────────────────────────────
class Identity(db.Model):
    __tablename__ = 'identities'

    id                 = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    phone_hash         = db.Column(db.String(256), nullable=False, index=True)
    phone_last4        = db.Column(db.String(4),  nullable=True)
    username           = db.Column(db.String(64), unique=True, nullable=True, index=True)
    email              = db.Column(db.String(255), nullable=True, index=True)
    identity_state     = db.Column(db.String(32), default='UNVERIFIED', nullable=False)
    identity_type      = db.Column(db.String(32), default='PERSONAL',   nullable=True)
    verification_level = db.Column(db.Integer,    default=0,            nullable=False)
    trust_signal       = db.Column(db.String(32), default='UNVERIFIED', nullable=False)
    tier               = db.Column(db.String(16), default='FREE',       nullable=False)
    flag_count         = db.Column(db.Integer,    default=0,            nullable=False)
    is_active          = db.Column(db.Boolean,    default=True,         nullable=False)
    last_login_at      = db.Column(db.DateTime,   nullable=True)
    last_verified_at   = db.Column(db.DateTime,   nullable=True)
    face_image_data    = db.Column(db.Text,       nullable=True)
    face_review_status = db.Column(db.String(32), default='NOT_STARTED', nullable=False)
    face_submitted_at  = db.Column(db.DateTime,   nullable=True)
    created_at         = db.Column(db.DateTime,   default=datetime.utcnow, nullable=False)
    updated_at         = db.Column(db.DateTime,   default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    otp_sessions      = db.relationship('OTPSession', back_populates='identity',
                                         lazy='dynamic', cascade='all, delete-orphan')
    assets            = db.relationship('Asset', back_populates='identity',
                                         lazy='dynamic', cascade='all, delete-orphan')
    reports_as_target = db.relationship('Report', back_populates='target_identity',
                                         foreign_keys='Report.target_identity_id',
                                         lazy='dynamic')
    plan_purchases    = db.relationship('PlanPurchase', back_populates='identity',
                                         lazy='dynamic', cascade='all, delete-orphan')

    def to_public_dict(self):
        return {
            'id':                 self.id,
            'username':           self.username,
            'email':              self.email,
            'identity_state':     self.identity_state,
            'identity_type':      self.identity_type,
            'verification_level': self.verification_level,
            'trust_signal':       self.trust_signal,
            'tier':               self.tier,
            'last_verified_at':   self.last_verified_at.isoformat() if self.last_verified_at else None,
            'created_at':         self.created_at.isoformat() if self.created_at else None,
        }

    def has_plan_entitlement(self, plan_id):
        if self.plan_purchases.filter_by(plan_id=plan_id).first() is not None:
            return True
        if self.plan_purchases.first() is not None:
            return False
        if self.tier == 'VERIFIED':
            return plan_id == 'VERIFIED'
        if self.tier == 'PREMIUM':
            return plan_id in ('VERIFIED', 'PREMIUM')
        return False

    def __repr__(self):
        return f'<Identity {self.id}>'


# ── Plan Purchase ────────────────────────────────────────────────
class PlanPurchase(db.Model):
    __tablename__ = 'plan_purchases'

    id                  = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    identity_id         = db.Column(db.String(36),
                                     db.ForeignKey('identities.id', ondelete='CASCADE'),
                                     nullable=False, index=True)
    plan_id             = db.Column(db.String(16), nullable=False, index=True)
    razorpay_order_id   = db.Column(db.String(64), nullable=True, unique=True)
    razorpay_payment_id = db.Column(db.String(64), nullable=True, unique=True)
    amount              = db.Column(db.Integer, nullable=False)
    currency            = db.Column(db.String(3), nullable=False)
    purpose             = db.Column(db.String(16), nullable=False)
    source              = db.Column(db.String(16), default='PAYMENT', nullable=False)
    created_at          = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    identity = db.relationship('Identity', back_populates='plan_purchases')


# ── OTP Session ──────────────────────────────────────────────────
class OTPSession(db.Model):
    __tablename__ = 'otp_sessions'

    id          = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    identity_id = db.Column(db.String(36),
                             db.ForeignKey('identities.id', ondelete='CASCADE'), nullable=True)
    phone_hash  = db.Column(db.String(256), nullable=False, index=True)
    otp_hash    = db.Column(db.String(256), nullable=True)    # hashed OTP, cleared after verify
    otp_plain   = db.Column(db.String(6),   nullable=True)    # not used (OTP never stored plain)
    purpose     = db.Column(db.String(16),  default='LOGIN', nullable=False)
    account_type = db.Column(db.String(32), default='PERSONAL', nullable=False)
    attempts    = db.Column(db.Integer,     default=0,       nullable=False)
    verified    = db.Column(db.Boolean,     default=False,   nullable=False)
    expires_at  = db.Column(db.DateTime,    nullable=False)
    created_at  = db.Column(db.DateTime,    default=datetime.utcnow, nullable=False)

    identity = db.relationship('Identity', back_populates='otp_sessions')

    def is_expired(self):
        return datetime.utcnow() > self.expires_at

    def __repr__(self):
        return f'<OTPSession {self.id} purpose={self.purpose}>'


# ── Asset ────────────────────────────────────────────────────────
class Asset(db.Model):
    __tablename__ = 'assets'

    id                  = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    identity_id         = db.Column(db.String(36),
                                     db.ForeignKey('identities.id', ondelete='CASCADE'), nullable=False)
    asset_type          = db.Column(db.String(32), nullable=False)
    value_hash          = db.Column(db.String(256), nullable=False)
    display_value       = db.Column(db.String(256), nullable=True)
    verification_code   = db.Column(db.String(64),  nullable=True)
    verification_status = db.Column(db.String(32),  default='PENDING', nullable=False)
    ownership_strength  = db.Column(db.Integer,     default=0,         nullable=False)
    instructions        = db.Column(db.Text,        nullable=True)
    created_at          = db.Column(db.DateTime,    default=datetime.utcnow, nullable=False)
    updated_at          = db.Column(db.DateTime,    default=datetime.utcnow, onupdate=datetime.utcnow)

    identity = db.relationship('Identity', back_populates='assets')

    def to_public_dict(self):
        return {
            'id':                 self.id,
            'type':               self.asset_type.lower() if self.asset_type else '',
            'value':              self.display_value,
            'status':              self.verification_status,
            'verificationStatus': self.verification_status,
            'ownershipStrength':  self.ownership_strength,
            'createdAt':          self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return f'<Asset {self.id} type={self.asset_type}>'


# ── Report ───────────────────────────────────────────────────────
class Report(db.Model):
    __tablename__ = 'reports'

    id                   = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    reporter_identity_id = db.Column(db.String(36),
                                      db.ForeignKey('identities.id'), nullable=True)
    target_identity_id   = db.Column(db.String(36),
                                      db.ForeignKey('identities.id', ondelete='SET NULL'), nullable=True)
    target_asset_id      = db.Column(db.String(36), nullable=True)
    report_type          = db.Column(db.String(64), nullable=False)
    description          = db.Column(db.Text,       nullable=True)
    evidence_urls        = db.Column(db.Text,        nullable=True)
    status               = db.Column(db.String(32), default='PENDING', nullable=False)
    created_at           = db.Column(db.DateTime,   default=datetime.utcnow, nullable=False)
    updated_at           = db.Column(db.DateTime,   default=datetime.utcnow, onupdate=datetime.utcnow)

    target_identity = db.relationship('Identity', back_populates='reports_as_target',
                                       foreign_keys=[target_identity_id])

    def __repr__(self):
        return f'<Report {self.id} type={self.report_type}>'


# ── KYC ──────────────────────────────────────────────────────────
class KYC(db.Model):
    __tablename__ = 'kyc_submissions'

    id            = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    identity_id   = db.Column(db.String(36),
                               db.ForeignKey('identities.id', ondelete='CASCADE'),
                               nullable=False, index=True)
    document_type  = db.Column(db.String(64), nullable=True)
    document_urls  = db.Column(db.Text,       nullable=True)
    document_data  = db.Column(db.Text,       nullable=True)   # base64 encoded image for admin review
    document_name  = db.Column(db.String(256),nullable=True)   # original filename
    status         = db.Column(db.String(32), default='PENDING', nullable=False)
    reject_reason  = db.Column(db.Text,       nullable=True)   # reason if REJECTED
    redirect_url   = db.Column(db.String(512), nullable=True)
    reviewed_at    = db.Column(db.DateTime,   nullable=True)
    created_at     = db.Column(db.DateTime,   default=datetime.utcnow, nullable=False)
    updated_at     = db.Column(db.DateTime,   default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f'<KYC {self.id} status={self.status}>'
