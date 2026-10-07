from datetime import datetime

from app import app
from models import Identity


def test_identity_supports_email_and_last_verified_metadata():
    with app.app_context():
        identity = Identity(
            phone_hash='test-hash-1',
            username='alice',
            email='alice@example.com',
            last_verified_at=datetime.utcnow(),
        )

        assert identity.username == 'alice'
        assert identity.email == 'alice@example.com'
        assert identity.last_verified_at is not None
