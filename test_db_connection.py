"""
Test Database Connection
Verifies connectivity to the configured database (SQLite / MySQL / PostgreSQL)
"""
import os
import sys

# Ensure UTF-8 output on Windows consoles
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

from dotenv import load_dotenv
load_dotenv()

DATABASE_URL = os.environ.get('DATABASE_URL', 'sqlite:///hvid.db').strip()

def test_connection():
    """Test database connection and display server info"""
    print("=" * 60)
    print("  Database Connection Test")
    print("=" * 60)
    print(f"\nConfigured DATABASE_URL: {DATABASE_URL}")

    if DATABASE_URL.startswith('sqlite:'):
        import sqlite3
        db_path = DATABASE_URL.replace('sqlite:///', '').replace('sqlite://', '')
        if not os.path.exists(db_path) or os.path.getsize(db_path) == 0:
            instance_path = os.path.join('instance', db_path)
            if os.path.exists(instance_path):
                db_path = instance_path
        print(f"Testing SQLite database file: {db_path}\n")
        try:
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT sqlite_version();")
            ver = cursor.fetchone()[0]
            print(f"[OK] SQLite Version: {ver}")

            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")
            tables = cursor.fetchall()
            if tables:
                print(f"[OK] Tables in database ({len(tables)}):")
                for (tbl,) in tables:
                    cursor.execute(f"SELECT COUNT(*) FROM {tbl};")
                    cnt = cursor.fetchone()[0]
                    print(f"  - {tbl}: {cnt} rows")
            else:
                print("[WARN] No tables found in SQLite database.")
            cursor.close()
            conn.close()
            print("\n" + "=" * 60)
            print("  [OK] Database connection test passed!")
            print("=" * 60)
            return True
        except Exception as e:
            print(f"\n[FAIL] SQLite connection error: {e}")
            print("=" * 60)
            return False

    elif 'postgres' in DATABASE_URL:
        try:
            import psycopg2
            conn = psycopg2.connect(DATABASE_URL)
            cursor = conn.cursor()
            cursor.execute("SELECT version();")
            ver = cursor.fetchone()[0]
            print(f"[OK] PostgreSQL Version: {ver}")
            cursor.close()
            conn.close()
            print("  [OK] Database connection test passed!")
            return True
        except Exception as e:
            print(f"\n[FAIL] PostgreSQL connection error: {e}")
            return False

    else:
        import pymysql
        db_config = {
            'host': os.environ.get('DB_HOST', 'localhost'),
            'port': int(os.environ.get('DB_PORT', '3306')),
            'user': os.environ.get('DB_USER', 'root'),
            'password': os.environ.get('DB_PASSWORD', ''),
            'database': os.environ.get('DB_NAME', 'flask_db'),
            'charset': 'utf8mb4',
        }
        try:
            connection = pymysql.connect(**db_config)
            print("[OK] MySQL connection successful!")
            cursor = connection.cursor()
            cursor.execute("SELECT VERSION();")
            version = cursor.fetchone()
            print(f"[OK] MySQL Server Version: {version[0]}")
            cursor.close()
            connection.close()
            print("  [OK] Database connection test passed!")
            return True
        except Exception as e:
            print(f"\n[FAIL] MySQL connection error: {e}")
            return False

if __name__ == '__main__':
    success = test_connection()
    sys.exit(0 if success else 1)
