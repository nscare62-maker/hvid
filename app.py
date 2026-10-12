"""
HVID — Unified Flask Application
Serves all HTML pages + REST API from a single server on port 3000.

Structure:
  hvid_app/
  ├── app.py              ← this file (entry point)
  ├── extensions.py       ← db, migrate
  ├── models.py           ← SQLAlchemy models
  ├── routes/             ← API blueprints (/api/*)
  ├── services/           ← otp, jwt helpers
  ├── middleware/         ← auth decorator
  ├── templates/          ← all HTML pages (Jinja2, served as-is)
  │   ├── index.html
  │   ├── auth/login.html
  │   ├── auth/signup.html
  │   ├── dashboard/*.html
  │   └── admin/*.html
  └── static/             ← css/, js/
"""
import os
from datetime import timedelta
from flask import Flask, render_template, send_from_directory, jsonify, redirect, request
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

IS_RENDER = os.environ.get('RENDER') == 'true'
IS_RAILWAY = os.environ.get('RAILWAY_ENVIRONMENT') is not None or os.environ.get('RAILWAY_SERVICE_ID') is not None
IS_PRODUCTION = IS_RENDER or IS_RAILWAY or os.environ.get('FLASK_ENV') == 'production'


def _database_url():
    url = os.environ.get('DATABASE_URL', 'sqlite:///hvid.db').strip()
    # Some older platforms expose postgres://; SQLAlchemy expects postgresql://.
    if url.startswith('postgres://'):
        url = 'postgresql://' + url[len('postgres://'):]
    # Accept plain mysql:// as well as the explicit PyMySQL dialect.
    elif url.startswith('mysql://'):
        url = 'mysql+pymysql://' + url[len('mysql://'):]
    return url


def _ensure_sqlite_schema():
    """Backfill newer columns on older SQLite databases created before recent model changes."""
    try:
        from sqlalchemy import inspect, text

        engine = db.engine
        if engine is None or engine.dialect.name != 'sqlite':
            return

        inspector = inspect(engine)
        if inspector.has_table('kyc_submissions'):
            existing_columns = {col['name'] for col in inspector.get_columns('kyc_submissions')}
            desired_columns = {
                'document_data': 'TEXT',
                'document_name': 'VARCHAR(256)',
                'reject_reason': 'TEXT',
                'redirect_url': 'VARCHAR(512)',
                'reviewed_at': 'DATETIME',
            }

            missing = [name for name in desired_columns if name not in existing_columns]
            if missing:
                with engine.begin() as conn:
                    for column_name in missing:
                        conn.execute(text(
                            f"ALTER TABLE kyc_submissions ADD COLUMN {column_name} {desired_columns[column_name]}"
                        ))
                print(f"✓ Backfilled SQLite kyc_submissions columns: {', '.join(missing)}")

        if inspector.has_table('identities'):
            with engine.connect() as connection:
                phone_indexes = connection.exec_driver_sql(
                    "PRAGMA index_list('identities')"
                ).fetchall()
                unique_phone_indexes = []
                for index in phone_indexes:
                    if not index[2]:
                        continue
                    columns = connection.exec_driver_sql(
                        f"PRAGMA index_info('{index[1]}')"
                    ).fetchall()
                    if [column[2] for column in columns] == ['phone_hash']:
                        unique_phone_indexes.append(index[1])
            has_unique_phone = bool(unique_phone_indexes) or any(
                constraint.get('column_names') == ['phone_hash']
                for constraint in inspector.get_unique_constraints('identities')
            )

            if has_unique_phone:
                with engine.begin() as conn:
                    conn.exec_driver_sql('PRAGMA foreign_keys=OFF')
                    conn.exec_driver_sql('''
                        CREATE TABLE identities_new (
                            id VARCHAR(36) PRIMARY KEY,
                            phone_hash VARCHAR(256) NOT NULL,
                            phone_last4 VARCHAR(4),
                            username VARCHAR(64) UNIQUE,
                            email VARCHAR(255),
                            identity_state VARCHAR(32) NOT NULL DEFAULT 'UNVERIFIED',
                            identity_type VARCHAR(32) DEFAULT 'PERSONAL',
                            verification_level INTEGER NOT NULL DEFAULT 0,
                            trust_signal VARCHAR(32) NOT NULL DEFAULT 'UNVERIFIED',
                            tier VARCHAR(16) NOT NULL DEFAULT 'FREE',
                            flag_count INTEGER NOT NULL DEFAULT 0,
                            is_active BOOLEAN NOT NULL DEFAULT 1,
                            last_login_at DATETIME,
                            last_verified_at DATETIME,
                            face_image_data TEXT,
                            face_review_status VARCHAR(32) NOT NULL DEFAULT 'NOT_STARTED',
                            face_submitted_at DATETIME,
                            created_at DATETIME NOT NULL,
                            updated_at DATETIME NOT NULL
                        )
                    ''')
                    conn.exec_driver_sql('''
                        INSERT INTO identities_new
                        SELECT id, phone_hash, phone_last4, username, email,
                               identity_state, identity_type, verification_level,
                               trust_signal, tier, flag_count, is_active,
                               last_login_at, last_verified_at, face_image_data,
                               face_review_status, face_submitted_at, created_at, updated_at
                        FROM identities
                    ''')
                    conn.exec_driver_sql('DROP TABLE identities')
                    conn.exec_driver_sql('ALTER TABLE identities_new RENAME TO identities')
                    conn.exec_driver_sql('CREATE INDEX IF NOT EXISTS ix_identities_phone_hash ON identities(phone_hash)')
                    conn.exec_driver_sql('CREATE INDEX IF NOT EXISTS ix_identities_username ON identities(username)')
                    conn.exec_driver_sql('CREATE INDEX IF NOT EXISTS ix_identities_email ON identities(email)')
                    conn.exec_driver_sql('PRAGMA foreign_keys=ON')
                print('✓ Removed SQLite unique phone constraint; Individual and Business accounts can share a phone')

            identity_columns = {col['name'] for col in inspector.get_columns('identities')}
            identity_desired = {
                'email': 'VARCHAR(255)',
                'last_verified_at': 'DATETIME',
                'face_image_data': 'TEXT',
                'face_review_status': "VARCHAR(32) DEFAULT 'NOT_STARTED'",
                'face_submitted_at': 'DATETIME',
            }
            missing_identity = [name for name in identity_desired if name not in identity_columns]
            if missing_identity:
                with engine.begin() as conn:
                    for column_name in missing_identity:
                        conn.execute(text(
                            f"ALTER TABLE identities ADD COLUMN {column_name} {identity_desired[column_name]}"
                        ))
                print(f"✓ Backfilled SQLite identities columns: {', '.join(missing_identity)}")

        if inspector.has_table('otp_sessions'):
            otp_columns = {col['name'] for col in inspector.get_columns('otp_sessions')}
            if 'account_type' not in otp_columns:
                with engine.begin() as conn:
                    conn.execute(text(
                        "ALTER TABLE otp_sessions ADD COLUMN account_type VARCHAR(32) NOT NULL DEFAULT 'PERSONAL'"
                    ))
                print('✓ Backfilled SQLite otp_sessions account_type column')
    except Exception as exc:
        print(f"⚠ Could not auto-backfill SQLite schema: {exc}")


from extensions import db, migrate  # noqa: E402

# ── App ───────────────────────────────────────────────────────────
app = Flask(
    __name__,
    template_folder='templates',
    static_folder='static',
    static_url_path='/static',
)

# ── Config ────────────────────────────────────────────────────────
app.config.update(
    SECRET_KEY                    = os.environ.get('SECRET_KEY',     'hvid-secret-dev'),
    SQLALCHEMY_DATABASE_URI       = _database_url(),
    SQLALCHEMY_TRACK_MODIFICATIONS= False,
    SQLALCHEMY_ENGINE_OPTIONS     = {
        'pool_pre_ping': True,
        'pool_recycle': 3600,
    },
    JWT_SECRET_KEY                = os.environ.get('JWT_SECRET_KEY', 'hvid-jwt-dev'),
    JWT_ACCESS_TOKEN_EXPIRES      = timedelta(days=7),
    TEXTBEE_API_KEY               = os.environ.get('TEXTBEE_API_KEY', ''),
    TEXTBEE_DEVICE_ID             = os.environ.get('TEXTBEE_DEVICE_ID', ''),
    OTP_EXPIRY_MINUTES            = int(os.environ.get('OTP_EXPIRY_MINUTES', 20)),
    MAX_OTP_ATTEMPTS              = int(os.environ.get('MAX_OTP_ATTEMPTS', 3)),
    RAZORPAY_KEY_ID               = os.environ.get('RAZORPAY_KEY_ID', ''),
    RAZORPAY_KEY_SECRET           = os.environ.get('RAZORPAY_KEY_SECRET', ''),
    ADMIN_KEY                     = os.environ.get('ADMIN_KEY', 'hvid-admin-2024' if not IS_PRODUCTION else ''),
    AUTO_CREATE_DB                = os.environ.get('AUTO_CREATE_DB', 'true').lower() in ('1', 'true', 'yes'),
    TEMPLATES_AUTO_RELOAD         = True,
)

# ── CORS (API only) ───────────────────────────────────────────────
CORS(app, resources={r'/api/*': {
    'origins': ['*'],
    'methods': ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    'allow_headers': ['Content-Type', 'Authorization'],
}})

# ── Extensions ────────────────────────────────────────────────────
db.init_app(app)
migrate.init_app(app, db)
import models  # noqa: F401 — registers all tables

# ── API blueprints ────────────────────────────────────────────────
from routes.auth      import bp as auth_bp
from routes.identity  import bp as identity_bp
from routes.match     import bp as match_bp
from routes.report    import bp as report_bp
from routes.kyc       import bp as kyc_bp
from routes.security  import bp as security_bp
from routes.asset     import bp as asset_bp
from routes.face      import bp as face_bp
from routes.payment   import bp as payment_bp
from routes.challenge import bp as challenge_bp
from routes.admin     import bp as admin_bp

app.register_blueprint(auth_bp,      url_prefix='/api/auth')
app.register_blueprint(identity_bp,  url_prefix='/api/identity')
app.register_blueprint(match_bp,     url_prefix='/api/match')
app.register_blueprint(report_bp,    url_prefix='/api/report')
app.register_blueprint(kyc_bp,       url_prefix='/api/kyc')
app.register_blueprint(security_bp,  url_prefix='/api/security')
app.register_blueprint(asset_bp,     url_prefix='/api/asset')
app.register_blueprint(face_bp,      url_prefix='/api/face')
app.register_blueprint(payment_bp,   url_prefix='/api/payment')
app.register_blueprint(challenge_bp, url_prefix='/api/challenge')
app.register_blueprint(admin_bp,     url_prefix='/api/admin')

# ── API health check ──────────────────────────────────────────────
@app.route('/api/health')
def health():
    # Keep this endpoint useful for Render health checks by verifying the DB too.
    try:
        from sqlalchemy import text
        db.session.execute(text('SELECT 1'))
        return {'status': 'ok', 'message': 'HVID is running', 'database': 'ok'}, 200
    except Exception:
        db.session.rollback()
        return {'status': 'degraded', 'message': 'HVID is running but the database is unavailable'}, 503


# ── Stub endpoints (referenced by frontend, not yet fully implemented) ──
@app.route('/api/internal/history/<identity_id>')
def internal_history(identity_id):
    """Activity history stub — returns empty list until event tracking is built."""
    return {'events': [], 'total': 0}, 200


def _resolve_identity_reference(ref):
    from models import Identity
    import re
    if not ref:
        return None
    ref = ref.strip()
    # Direct UUID lookup
    if re.match(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', ref, re.I):
        return Identity.query.get(ref)
    # Accept HVID codes like HVID-4A72F9 or hvid-4a72f9
    match = re.match(r'^(?:hvid-)?([0-9a-f]{6,12})$', ref, re.I)
    if match:
        part = match.group(1).lower()
        return Identity.query.filter(Identity.id.ilike(f'{part}%')).first()
    return None

@app.route('/api/profile/<identity_id>')
def public_profile(identity_id):
    """
    Public profile endpoint used by profile.js and match-ui.js.
    Returns a safe public view of the identity.
    """
    from models import Asset
    identity = _resolve_identity_reference(identity_id)
    if not identity:
        return {'error': 'Identity not found.'}, 404

    assets = [a.to_public_dict() for a in identity.assets.all()]

    level = identity.verification_level
    verification_summary = (
        'High Assurance' if level >= 3 else
        'Verified'       if level >= 2 else
        'Basic'          if level >= 1 else
        'Unverified'
    )

    return {
        'identity_id':          identity.id,
        'username':             identity.username,
        'tier':                 identity.tier,
        'trust_signal':         identity.trust_signal,
        'identity_type':        identity.identity_type,
        'verification_level':   identity.verification_level,
        'verification_summary': verification_summary,
        'stability_indicator':  'Stable' if identity.flag_count == 0 else 'Under Review',
        'identity_state':       identity.identity_state,
        'assets':               assets,
        'created_at':           identity.created_at.isoformat() if identity.created_at else None,
    }, 200


@app.route('/api/enforcement/state/<identity_id>')
def enforcement_state(identity_id):
    """
    Enforcement state stub used as fallback in signal-status.js.
    Returns safe signal derived from identity state.
    """
    from models import Identity
    identity = Identity.query.get(identity_id)
    if not identity:
        return {'signal': 'STABLE'}, 200

    signal = 'STABLE'
    if identity.identity_state == 'SUSPENDED':
        signal = 'SUSPENDED'
    elif identity.identity_state in ('LIMITED', 'REVERIFY_REQUIRED'):
        signal = 'REQUIRES_REVALIDATION'
    elif identity.flag_count and identity.flag_count > 0:
        signal = 'UNDER_REVIEW'

    return {'signal': signal}, 200


@app.route('/api/asset/identity/<identity_id>')
def asset_by_identity(identity_id):
    """Public asset list — returns only verified assets."""
    from models import Asset
    assets = Asset.query.filter_by(
        identity_id=identity_id,
        verification_status='VERIFIED'
    ).all()
    return jsonify([a.to_public_dict() for a in assets]), 200


# ══════════════════════════════════════════════════════════════════
#  FRONTEND ROUTES — serve every HTML template directly
# ══════════════════════════════════════════════════════════════════

# Root / public pages
@app.route('/assets/<path:filename>')
@app.route('/asset/<path:filename>')
def serve_assets(filename):
    return send_from_directory('assets', filename)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/how-it-works')
def how_it_works():
    return render_template('how-it-works.html')

@app.route('/for-businesses')
def for_businesses():
    return render_template('for-businesses.html')

@app.route('/for-individuals')
def for_individuals():
    return render_template('for-individuals.html')

@app.route('/legal')
def legal():
    return render_template('legal.html')

@app.route('/terms')
def terms():
    return render_template('terms.html')

@app.route('/trust-safety')
def trust_safety():
    return render_template('trust-safety.html')

@app.route('/result')
def result():
    return render_template('result.html')

@app.route('/identity-type')
def identity_type():
    return render_template('identity-type.html')

@app.route('/acceptable-use')
def acceptable_use():
    return render_template('acceptable-use.html')

@app.route('/challenge')
def challenge():
    return render_template('challenge.html')

@app.route('/reports')
def reports():
    return render_template('reports.html')

@app.route('/p')
def p():
    return render_template('p.html')

# Auth pages
@app.route('/auth/login')
@app.route('/auth/login.html')
def auth_login():
    return render_template('auth/login.html')

@app.route('/auth/signup')
@app.route('/auth/signup.html')
def auth_signup():
    return render_template('auth/signup.html')

# Dashboard pages
@app.route('/dashboard')
@app.route('/dashboard/')
def dashboard_index():
    return render_template('dashboard/index.html')

@app.route('/dashboard/identity')
def dashboard_identity():
    return render_template('dashboard/identity.html')

@app.route('/dashboard/linked-accounts')
def dashboard_linked_accounts():
    return render_template('dashboard/linked-accounts.html')

@app.route('/dashboard/upgrade')
def dashboard_upgrade():
    return render_template('dashboard/upgrade.html')

@app.route('/dashboard/reports')
def dashboard_reports():
    return render_template('dashboard/reports.html')

@app.route('/dashboard/timeline')
def dashboard_timeline():
    return render_template('dashboard/timeline.html')

@app.route('/dashboard/verification')
def dashboard_verification():
    return render_template('dashboard/verification.html')

@app.route('/dashboard/security')
def dashboard_security():
    return render_template('dashboard/security.html')

@app.route('/dashboard/settings')
def dashboard_settings():
    return render_template('dashboard/settings.html')

@app.route('/kyc/mock')
def kyc_mock():
    return render_template('kyc/mock.html')

@app.route('/face-capture')
def face_capture_page():
    return render_template('face-capture.html')

# Test pages
@app.route('/test-kyc-verification')
@app.route('/test_kyc_verification.html')
def test_kyc_verification():
    """Test page for KYC verification fix"""
    return send_from_directory('.', 'test_kyc_verification.html')

# Admin pages
@app.route('/admin/kyc-review')
def admin_kyc_review():
    return redirect('/admin/verification-review')

@app.route('/admin/verification-review')
def admin_verification_review():
    return render_template('admin/verification-review.html')

@app.route('/admin/asset-review')
def admin_asset_review():
    return redirect('/admin/verification-review')

@app.route('/admin/challenges')
def admin_challenges():
    return render_template('admin/challenges.html')

@app.route('/admin/challenge-detail')
def admin_challenge_detail():
    return render_template('admin/challenge-detail.html')

@app.route('/admin/reports')
def admin_reports():
    return render_template('admin/reports.html')

@app.route('/admin/report-detail')
def admin_report_detail():
    return render_template('admin/report-detail.html')

@app.route('/admin/identity-search')
def admin_identity_search():
    return render_template('admin/identity-search.html')

@app.route('/admin/identity-detail')
def admin_identity_detail():
    return render_template('admin/identity-detail.html')

@app.route('/admin/high-risk')
def admin_high_risk():
    return render_template('admin/high-risk.html')

# ── Catch-all: redirect old .html URLs → clean Flask URLs ────────
@app.route('/<path:filename>.html')
def legacy_html_redirect(filename):
    clean = '/' + filename
    query = request.query_string.decode('utf-8')
    if query:
        clean = f'{clean}?{query}'
    return redirect(clean, 301)

def seed_default_user():
    """Ensure deva / +919962106567 exists on every startup."""
    from models import Identity
    from services.otp_service import hash_phone
    phone_hash = hash_phone('+919962106567')
    user = Identity.query.filter_by(phone_hash=phone_hash).first()
    if not user:
        user = Identity(
            phone_hash  = phone_hash,
            phone_last4 = '6567',
            username    = 'deva',
        )
        db.session.add(user)
        db.session.commit()
        print('[OK] Default user created: deva (+919962106567)')
    else:
        if not user.username:
            user.username = 'deva'
            db.session.commit()
        print(f'[OK] Default user exists: {user.username} ({user.id})')

# ── Startup ───────────────────────────────────────────────────────
with app.app_context():
    if app.config['AUTO_CREATE_DB']:
        db.create_all()
        _ensure_sqlite_schema()
        seed_default_user()
        print('[OK] Database ready (auto-create enabled)')
    else:
        print('[OK] Database startup bootstrap disabled; using existing schema')

if __name__ == '__main__':
    print('=' * 52)
    print('  HVID App — http://localhost:3000')
    print('  OTP sent via TextBee SMS')
    print('=' * 52)
    app.run(
        host='0.0.0.0',
        port=int(os.environ.get('PORT', 3000)),
        debug=os.environ.get('FLASK_DEBUG', 'false').lower() == 'true',
        use_reloader=False,
    )
