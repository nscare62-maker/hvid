"""
import os
Database Initialization Script for HVID
Creates all required tables in MySQL database
"""
import pymysql
import sys
from datetime import datetime

# Database connection settings
DB_CONFIG = {
    'host': os.environ.get('DB_HOST', 'localhost'),
    'port': int(os.environ.get('DB_PORT', '3306')),
    'user': os.environ.get('DB_USER', 'root'),
    'password': os.environ.get('DB_PASSWORD', ''),
    'database': os.environ.get('DB_NAME', 'flask_db'),
    'charset': 'utf8mb4',
    'cursorclass': pymysql.cursors.DictCursor
}

# SQL statements for creating tables
CREATE_TABLES_SQL = [
    # Drop existing tables (in correct order to respect foreign keys)
    "SET FOREIGN_KEY_CHECKS = 0;",
    "DROP TABLE IF EXISTS kyc_submissions;",
    "DROP TABLE IF EXISTS reports;",
    "DROP TABLE IF EXISTS assets;",
    "DROP TABLE IF EXISTS otp_sessions;",
    "DROP TABLE IF EXISTS identities;",
    "SET FOREIGN_KEY_CHECKS = 1;",
    
    # Identities table
    """
    CREATE TABLE identities (
        id VARCHAR(36) PRIMARY KEY,
        phone_hash VARCHAR(256) NOT NULL,
        phone_last4 VARCHAR(4) DEFAULT NULL,
        username VARCHAR(64) DEFAULT NULL UNIQUE,
        identity_state VARCHAR(32) NOT NULL DEFAULT 'UNVERIFIED',
        identity_type VARCHAR(32) DEFAULT 'PERSONAL',
        verification_level INT NOT NULL DEFAULT 0,
        trust_signal VARCHAR(32) NOT NULL DEFAULT 'UNVERIFIED',
        tier VARCHAR(16) NOT NULL DEFAULT 'FREE',
        flag_count INT NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        last_login_at DATETIME DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_phone_hash (phone_hash),
        INDEX idx_username (username)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    """,
    
    # OTP Sessions table
    """
    CREATE TABLE otp_sessions (
        id VARCHAR(36) PRIMARY KEY,
        identity_id VARCHAR(36) DEFAULT NULL,
        phone_hash VARCHAR(256) NOT NULL,
        otp_hash VARCHAR(256) NOT NULL,
        otp_plain VARCHAR(6) DEFAULT NULL,
        purpose VARCHAR(16) NOT NULL DEFAULT 'LOGIN',
        account_type VARCHAR(32) NOT NULL DEFAULT 'PERSONAL',
        attempts INT NOT NULL DEFAULT 0,
        verified BOOLEAN NOT NULL DEFAULT FALSE,
        expires_at DATETIME NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_phone_hash (phone_hash),
        INDEX idx_identity_id (identity_id),
        FOREIGN KEY (identity_id) REFERENCES identities(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    """,
    
    # Assets table
    """
    CREATE TABLE assets (
        id VARCHAR(36) PRIMARY KEY,
        identity_id VARCHAR(36) NOT NULL,
        asset_type VARCHAR(32) NOT NULL,
        value_hash VARCHAR(256) NOT NULL,
        display_value VARCHAR(256) DEFAULT NULL,
        verification_code VARCHAR(64) DEFAULT NULL,
        verification_status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
        ownership_strength INT NOT NULL DEFAULT 0,
        instructions TEXT DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_identity_id (identity_id),
        INDEX idx_value_hash (value_hash),
        FOREIGN KEY (identity_id) REFERENCES identities(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    """,
    
    # Reports table
    """
    CREATE TABLE reports (
        id VARCHAR(36) PRIMARY KEY,
        reporter_identity_id VARCHAR(36) DEFAULT NULL,
        target_identity_id VARCHAR(36) DEFAULT NULL,
        target_asset_id VARCHAR(36) DEFAULT NULL,
        report_type VARCHAR(64) NOT NULL,
        description TEXT DEFAULT NULL,
        evidence_urls TEXT DEFAULT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_reporter (reporter_identity_id),
        INDEX idx_target (target_identity_id),
        INDEX idx_status (status),
        FOREIGN KEY (reporter_identity_id) REFERENCES identities(id) ON DELETE SET NULL,
        FOREIGN KEY (target_identity_id) REFERENCES identities(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    """,
    
    # KYC Submissions table
    """
    CREATE TABLE kyc_submissions (
        id VARCHAR(36) PRIMARY KEY,
        identity_id VARCHAR(36) NOT NULL,
        document_type VARCHAR(64) DEFAULT NULL,
        document_urls TEXT DEFAULT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
        redirect_url VARCHAR(512) DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_identity_id (identity_id),
        INDEX idx_status (status),
        FOREIGN KEY (identity_id) REFERENCES identities(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    """
]


def init_database():
    """Initialize the database with all required tables"""
    connection = None
    try:
        print("Connecting to MySQL database...")
        connection = pymysql.connect(**DB_CONFIG)
        print(f"✓ Connected to database: {DB_CONFIG['database']}")
        
        cursor = connection.cursor()
        
        print("\nCreating tables...")
        for i, sql in enumerate(CREATE_TABLES_SQL, 1):
            sql = sql.strip()
            if not sql:
                continue
                
            try:
                cursor.execute(sql)
                if sql.startswith('CREATE TABLE'):
                    table_name = sql.split('CREATE TABLE')[1].split('(')[0].strip()
                    print(f"  ✓ Created table: {table_name}")
                elif sql.startswith('DROP TABLE'):
                    table_name = sql.split('DROP TABLE IF EXISTS')[1].split(';')[0].strip()
                    print(f"  - Dropped table: {table_name}")
                elif 'FOREIGN_KEY_CHECKS' in sql:
                    print(f"  ⚙ {sql}")
            except pymysql.Error as e:
                print(f"  ✗ Error executing SQL statement {i}: {e}")
                print(f"    SQL: {sql[:100]}...")
                
        connection.commit()
        print("\n✓ All tables created successfully!")
        
        # Verify tables
        cursor.execute("SHOW TABLES;")
        tables = cursor.fetchall()
        print(f"\nTables in database '{DB_CONFIG['database']}':")
        for table in tables:
            table_name = list(table.values())[0]
            cursor.execute(f"SELECT COUNT(*) as count FROM {table_name};")
            count = cursor.fetchone()['count']
            print(f"  - {table_name} ({count} rows)")
        
        cursor.close()
        
    except pymysql.Error as e:
        print(f"\n✗ Database error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n✗ Unexpected error: {e}")
        sys.exit(1)
    finally:
        if connection:
            connection.close()
            print("\n✓ Database connection closed")


if __name__ == '__main__':
    print("=" * 60)
    print("  HVID Database Initialization")
    print("=" * 60)
    init_database()
    print("\n" + "=" * 60)
    print("  Database initialization complete!")
    print("  You can now run: python app.py")
    print("=" * 60)
