"""
import os
Seed Sample Data for HVID Application
Creates realistic test data to verify all flows work correctly
"""
import uuid
import pymysql
from datetime import datetime, timedelta
import hashlib
import hmac

# Database Configuration
DB_CONFIG = {
    'host': os.environ.get('DB_HOST', 'localhost'),
    'port': int(os.environ.get('DB_PORT', '3306')),
    'user': os.environ.get('DB_USER', 'root'),
    'password': os.environ.get('DB_PASSWORD', ''),
    'database': os.environ.get('DB_NAME', 'flask_db'),
    'charset': 'utf8mb4',
}

def hash_value(value: str, salt: str = 'hvid-salt') -> str:
    """HMAC-SHA256 hash"""
    return hmac.new(
        salt.encode('utf-8'),
        value.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()

def hash_phone(phone: str) -> str:
    """Hash phone number"""
    import re
    normalized = re.sub(r'[^\d+]', '', phone)
    return hash_value(normalized, salt='hvid-phone-salt')

def gen_uuid():
    """Generate UUID"""
    return str(uuid.uuid4())

def gen_verification_code(identity_id: str) -> str:
    """Generate verification code"""
    return f"hvid-{hashlib.md5(identity_id.encode()).hexdigest()[:12]}"

def seed_data():
    """Seed comprehensive sample data"""
    connection = None
    try:
        print("=" * 60)
        print("  HVID Sample Data Seeding")
        print("=" * 60)
        
        connection = pymysql.connect(**DB_CONFIG)
        cursor = connection.cursor()
        print("✓ Connected to database\n")
        
        # Sample users with different verification levels
        sample_users = [
            {
                'phone': '+919962106567',
                'phone_last4': '6567',
                'username': 'deva',
                'identity_state': 'VERIFIED',
                'identity_type': 'PERSONAL',
                'verification_level': 2,
                'trust_signal': 'VERIFIED',
                'tier': 'FREE',
            },
            {
                'phone': '+919876543210',
                'phone_last4': '3210',
                'username': 'testuser',
                'identity_state': 'VERIFIED',
                'identity_type': 'PROFESSIONAL',
                'verification_level': 3,
                'trust_signal': 'HIGH',
                'tier': 'PREMIUM',
            },
            {
                'phone': '+919988776655',
                'phone_last4': '6655',
                'username': 'businessuser',
                'identity_state': 'VERIFIED',
                'identity_type': 'BUSINESS',
                'verification_level': 4,
                'trust_signal': 'HIGH',
                'tier': 'PREMIUM',
            },
            {
                'phone': '+919123456789',
                'phone_last4': '6789',
                'username': 'newuser',
                'identity_state': 'UNVERIFIED',
                'identity_type': 'PERSONAL',
                'verification_level': 0,
                'trust_signal': 'UNVERIFIED',
                'tier': 'FREE',
            },
            {
                'phone': '+919555666777',
                'phone_last4': '6777',
                'username': 'suspendeduser',
                'identity_state': 'SUSPENDED',
                'identity_type': 'PERSONAL',
                'verification_level': 1,
                'trust_signal': 'FLAGGED',
                'tier': 'FREE',
                'flag_count': 3,
            },
        ]
        
        print("Creating sample identities...")
        identity_ids = {}
        
        for user in sample_users:
            identity_id = gen_uuid()
            phone_hash = hash_phone(user['phone'])
            
            # Check if user already exists
            cursor.execute("SELECT id FROM identities WHERE phone_hash = %s", (phone_hash,))
            existing = cursor.fetchone()
            
            if existing:
                identity_id = existing[0]
                # Update existing user
                cursor.execute("""
                    UPDATE identities 
                    SET username = %s, identity_state = %s, identity_type = %s,
                        verification_level = %s, trust_signal = %s, tier = %s,
                        flag_count = %s, last_login_at = %s
                    WHERE id = %s
                """, (
                    user['username'], user['identity_state'], user['identity_type'],
                    user['verification_level'], user['trust_signal'], user['tier'],
                    user.get('flag_count', 0), datetime.utcnow(), identity_id
                ))
                print(f"  ✓ Updated: {user['username']} ({user['phone']})")
            else:
                # Insert new user
                cursor.execute("""
                    INSERT INTO identities 
                    (id, phone_hash, phone_last4, username, identity_state, identity_type,
                     verification_level, trust_signal, tier, flag_count, is_active, 
                     last_login_at, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    identity_id, phone_hash, user['phone_last4'], user['username'],
                    user['identity_state'], user['identity_type'], user['verification_level'],
                    user['trust_signal'], user['tier'], user.get('flag_count', 0), True,
                    datetime.utcnow(), datetime.utcnow(), datetime.utcnow()
                ))
                print(f"  ✓ Created: {user['username']} ({user['phone']})")
            
            identity_ids[user['username']] = identity_id
        
        connection.commit()
        
        # Create sample assets (Instagram & Website)
        print("\nCreating sample assets...")
        
        sample_assets = [
            {
                'identity': 'deva',
                'asset_type': 'INSTAGRAM',
                'value': '@deva_official',
                'display_value': '@deva_official',
                'verification_status': 'VERIFIED',
                'ownership_strength': 2,
            },
            {
                'identity': 'testuser',
                'asset_type': 'INSTAGRAM',
                'value': '@testuser_pro',
                'display_value': '@testuser_pro',
                'verification_status': 'VERIFIED',
                'ownership_strength': 3,
            },
            {
                'identity': 'testuser',
                'asset_type': 'WEBSITE',
                'value': 'testuser.com',
                'display_value': 'testuser.com',
                'verification_status': 'VERIFIED',
                'ownership_strength': 3,
            },
            {
                'identity': 'businessuser',
                'asset_type': 'INSTAGRAM',
                'value': '@businessofficial',
                'display_value': '@businessofficial',
                'verification_status': 'VERIFIED',
                'ownership_strength': 3,
            },
            {
                'identity': 'businessuser',
                'asset_type': 'WEBSITE',
                'value': 'mybusiness.com',
                'display_value': 'mybusiness.com',
                'verification_status': 'VERIFIED',
                'ownership_strength': 3,
            },
            {
                'identity': 'newuser',
                'asset_type': 'INSTAGRAM',
                'value': '@newuser_account',
                'display_value': '@newuser_account',
                'verification_status': 'PENDING',
                'ownership_strength': 0,
            },
        ]
        
        for asset in sample_assets:
            if asset['identity'] not in identity_ids:
                continue
                
            identity_id = identity_ids[asset['identity']]
            asset_id = gen_uuid()
            value_hash = hashlib.sha256(asset['value'].lower().encode()).hexdigest()
            verification_code = gen_verification_code(identity_id)
            
            instructions = ""
            if asset['asset_type'] == 'INSTAGRAM':
                instructions = f"Add the verification code {verification_code} to your Instagram bio, then click Verify."
            else:
                instructions = f"Add a <meta name='hvid-verification' content='{verification_code}'> tag to your homepage OR a DNS TXT record: hvid={verification_code}. Then click Verify."
            
            # Check if asset exists
            cursor.execute("""
                SELECT id FROM assets 
                WHERE identity_id = %s AND value_hash = %s
            """, (identity_id, value_hash))
            
            existing = cursor.fetchone()
            
            if existing:
                # Update existing asset
                cursor.execute("""
                    UPDATE assets 
                    SET verification_status = %s, ownership_strength = %s
                    WHERE id = %s
                """, (asset['verification_status'], asset['ownership_strength'], existing[0]))
                print(f"  ✓ Updated asset: {asset['display_value']} for {asset['identity']}")
            else:
                # Insert new asset
                cursor.execute("""
                    INSERT INTO assets 
                    (id, identity_id, asset_type, value_hash, display_value, 
                     verification_code, verification_status, ownership_strength, 
                     instructions, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    asset_id, identity_id, asset['asset_type'], value_hash,
                    asset['display_value'], verification_code, asset['verification_status'],
                    asset['ownership_strength'], instructions, datetime.utcnow(), datetime.utcnow()
                ))
                print(f"  ✓ Created asset: {asset['display_value']} for {asset['identity']}")
        
        connection.commit()
        
        # Create sample KYC submissions
        print("\nCreating sample KYC submissions...")
        
        sample_kyc = [
            {
                'identity': 'deva',
                'document_type': 'PASSPORT',
                'status': 'APPROVED',
                'document_urls': '["https://example.com/passport_front.jpg", "https://example.com/passport_back.jpg"]',
            },
            {
                'identity': 'testuser',
                'document_type': 'DRIVERS_LICENSE',
                'status': 'APPROVED',
                'document_urls': '["https://example.com/license_front.jpg", "https://example.com/license_back.jpg"]',
            },
            {
                'identity': 'businessuser',
                'document_type': 'NATIONAL_ID',
                'status': 'APPROVED',
                'document_urls': '["https://example.com/national_id.jpg"]',
            },
            {
                'identity': 'newuser',
                'document_type': None,
                'status': 'PENDING',
                'document_urls': None,
            },
        ]
        
        for kyc in sample_kyc:
            if kyc['identity'] not in identity_ids:
                continue
                
            identity_id = identity_ids[kyc['identity']]
            kyc_id = gen_uuid()
            
            # Check if KYC exists for this identity
            cursor.execute("""
                SELECT id FROM kyc_submissions 
                WHERE identity_id = %s 
                ORDER BY created_at DESC LIMIT 1
            """, (identity_id,))
            
            existing = cursor.fetchone()
            
            if existing:
                # Update existing KYC
                cursor.execute("""
                    UPDATE kyc_submissions 
                    SET document_type = %s, document_urls = %s, status = %s
                    WHERE id = %s
                """, (kyc['document_type'], kyc['document_urls'], kyc['status'], existing[0]))
                print(f"  ✓ Updated KYC: {kyc['identity']} - {kyc['status']}")
            else:
                # Insert new KYC
                cursor.execute("""
                    INSERT INTO kyc_submissions 
                    (id, identity_id, document_type, document_urls, status, 
                     redirect_url, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    kyc_id, identity_id, kyc['document_type'], kyc['document_urls'],
                    kyc['status'], f'/kyc/mock?id={kyc_id}',
                    datetime.utcnow(), datetime.utcnow()
                ))
                print(f"  ✓ Created KYC: {kyc['identity']} - {kyc['status']}")
        
        connection.commit()
        
        # Create sample reports
        print("\nCreating sample reports...")
        
        if 'suspendeduser' in identity_ids and 'testuser' in identity_ids:
            sample_reports = [
                {
                    'reporter': 'testuser',
                    'target': 'suspendeduser',
                    'report_type': 'IMPERSONATION',
                    'description': 'This account is impersonating a public figure.',
                    'status': 'UNDER_REVIEW',
                },
                {
                    'reporter': 'businessuser',
                    'target': 'suspendeduser',
                    'report_type': 'FRAUD',
                    'description': 'Suspicious activity detected. Possible fraud.',
                    'status': 'UNDER_REVIEW',
                },
                {
                    'reporter': 'deva',
                    'target': 'suspendeduser',
                    'report_type': 'SPAM',
                    'description': 'Sending spam messages.',
                    'status': 'RESOLVED',
                },
            ]
            
            for report in sample_reports:
                if report['reporter'] not in identity_ids or report['target'] not in identity_ids:
                    continue
                    
                report_id = gen_uuid()
                reporter_id = identity_ids[report['reporter']]
                target_id = identity_ids[report['target']]
                
                # Check if similar report exists
                cursor.execute("""
                    SELECT id FROM reports 
                    WHERE reporter_identity_id = %s 
                    AND target_identity_id = %s 
                    AND report_type = %s
                """, (reporter_id, target_id, report['report_type']))
                
                existing = cursor.fetchone()
                
                if not existing:
                    cursor.execute("""
                        INSERT INTO reports 
                        (id, reporter_identity_id, target_identity_id, report_type, 
                         description, evidence_urls, status, created_at, updated_at)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """, (
                        report_id, reporter_id, target_id, report['report_type'],
                        report['description'], '[]', report['status'],
                        datetime.utcnow(), datetime.utcnow()
                    ))
                    print(f"  ✓ Created report: {report['report_type']} by {report['reporter']}")
        
        connection.commit()
        
        # Display summary
        print("\n" + "=" * 60)
        print("  Data Summary")
        print("=" * 60)
        
        cursor.execute("SELECT COUNT(*) as count FROM identities")
        print(f"✓ Identities: {cursor.fetchone()[0]}")
        
        cursor.execute("SELECT COUNT(*) as count FROM assets")
        print(f"✓ Assets: {cursor.fetchone()[0]}")
        
        cursor.execute("SELECT COUNT(*) as count FROM kyc_submissions")
        print(f"✓ KYC Submissions: {cursor.fetchone()[0]}")
        
        cursor.execute("SELECT COUNT(*) as count FROM reports")
        print(f"✓ Reports: {cursor.fetchone()[0]}")
        
        cursor.execute("SELECT COUNT(*) as count FROM otp_sessions")
        print(f"✓ OTP Sessions: {cursor.fetchone()[0]}")
        
        print("\n" + "=" * 60)
        print("  Test Accounts Created")
        print("=" * 60)
        
        print("\n1. Default User (Verified)")
        print("   Phone: +919962106567")
        print("   OTP: 123456")
        print("   Username: deva")
        print("   Level: 2 (VERIFIED)")
        print("   Assets: 1 Instagram")
        
        print("\n2. Professional User (High Trust)")
        print("   Phone: +919876543210")
        print("   OTP: 123456")
        print("   Username: testuser")
        print("   Level: 3 (HIGH)")
        print("   Assets: 1 Instagram, 1 Website")
        
        print("\n3. Business User (High Trust)")
        print("   Phone: +919988776655")
        print("   OTP: 123456")
        print("   Username: businessuser")
        print("   Level: 4 (HIGH)")
        print("   Assets: 1 Instagram, 1 Website")
        
        print("\n4. New User (Unverified)")
        print("   Phone: +919123456789")
        print("   OTP: 123456")
        print("   Username: newuser")
        print("   Level: 0 (UNVERIFIED)")
        print("   Assets: 1 Instagram (pending)")
        
        print("\n5. Suspended User (Flagged)")
        print("   Phone: +919555666777")
        print("   OTP: 123456")
        print("   Username: suspendeduser")
        print("   Level: 1 (FLAGGED)")
        print("   Reports: 3 reports filed against")
        
        print("\n" + "=" * 60)
        print("  ✓ Sample data seeded successfully!")
        print("=" * 60)
        
        cursor.close()
        connection.close()
        
        return True
        
    except pymysql.Error as e:
        print(f"\n✗ Database error: {e}")
        if connection:
            connection.rollback()
            connection.close()
        return False
    except Exception as e:
        print(f"\n✗ Unexpected error: {e}")
        if connection:
            connection.rollback()
            connection.close()
        return False

if __name__ == '__main__':
    import sys
    success = seed_data()
    sys.exit(0 if success else 1)
