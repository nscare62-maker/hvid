"""
Database Migration Script
Safely migrates existing SQLite database to MySQL or updates MySQL schema
"""
import pymysql
import sys
import os

# MySQL Configuration
MYSQL_CONFIG = {
    'host': os.environ.get('DB_HOST', 'localhost'),
    'port': int(os.environ.get('DB_PORT', '3306')),
    'user': os.environ.get('DB_USER', 'root'),
    'password': os.environ.get('DB_PASSWORD', ''),
    'database': os.environ.get('DB_NAME', 'flask_db'),
    'charset': 'utf8mb4',
}

def check_table_exists(cursor, table_name):
    """Check if a table exists in the database"""
    cursor.execute(f"SHOW TABLES LIKE '{table_name}';")
    return cursor.fetchone() is not None

def get_table_info(cursor, table_name):
    """Get information about table structure"""
    cursor.execute(f"DESCRIBE {table_name};")
    return cursor.fetchall()

def migrate_to_mysql():
    """Migrate database and ensure all tables are up to date"""
    connection = None
    try:
        print("=" * 60)
        print("  HVID Database Migration Tool")
        print("=" * 60)
        
        # Connect to MySQL
        print("\nConnecting to MySQL database...")
        connection = pymysql.connect(**MYSQL_CONFIG)
        cursor = connection.cursor()
        print(f"✓ Connected to {MYSQL_CONFIG['database']}")
        
        # Check each table
        tables = ['identities', 'otp_sessions', 'assets', 'reports', 'kyc_submissions']
        
        print("\nChecking database schema...")
        all_exist = True
        for table in tables:
            exists = check_table_exists(cursor, table)
            if exists:
                print(f"  ✓ Table '{table}' exists")
            else:
                print(f"  ✗ Table '{table}' missing")
                all_exist = False
        
        if not all_exist:
            print("\n⚠ Some tables are missing!")
            print("  Run 'python init_database.py' to create all tables.")
            cursor.close()
            connection.close()
            return False
        
        # Check for common migration needs
        print("\nChecking for required migrations...")
        
        # Example: Check if username has index
        cursor.execute("""
            SELECT COUNT(*) 
            FROM information_schema.statistics 
            WHERE table_schema = %s 
            AND table_name = 'identities' 
            AND index_name = 'username';
        """, (MYSQL_CONFIG['database'],))
        
        has_username_index = cursor.fetchone()[0] > 0
        
        if not has_username_index:
            print("  + Adding index to 'username' column...")
            try:
                cursor.execute("CREATE INDEX idx_username ON identities(username);")
                connection.commit()
                print("  ✓ Index added successfully")
            except pymysql.Error as e:
                if e.args[0] == 1061:  # Duplicate key name
                    print("  ✓ Index already exists")
                else:
                    print(f"  ⚠ Could not add index: {e}")
        else:
            print("  ✓ Username index already exists")

        cursor.execute("""
            SELECT COUNT(*)
            FROM information_schema.columns
            WHERE table_schema = %s
              AND table_name = 'otp_sessions'
              AND column_name = 'account_type';
        """, (MYSQL_CONFIG['database'],))
        if cursor.fetchone()[0] == 0:
            cursor.execute(
                "ALTER TABLE otp_sessions ADD COLUMN account_type VARCHAR(32) NOT NULL DEFAULT 'PERSONAL' AFTER purpose"
            )
            connection.commit()
            print("  ✓ Added otp_sessions.account_type")

        cursor.execute("""
            SELECT DISTINCT index_name
            FROM information_schema.statistics
            WHERE table_schema = %s
              AND table_name = 'identities'
              AND column_name = 'phone_hash'
              AND non_unique = 0
              AND index_name <> 'PRIMARY';
        """, (MYSQL_CONFIG['database'],))
        unique_phone_indexes = [row[0] for row in cursor.fetchall()]
        for index_name in unique_phone_indexes:
            cursor.execute(f"ALTER TABLE identities DROP INDEX `{index_name}`")
            print(f"  ✓ Removed unique phone index '{index_name}'")
        if unique_phone_indexes:
            connection.commit()
        
        # Add any other migrations here
        
        # Verify data integrity
        print("\nVerifying data integrity...")
        for table in tables:
            cursor.execute(f"SELECT COUNT(*) FROM {table};")
            count = cursor.fetchone()[0]
            print(f"  ✓ {table}: {count} rows")
        
        cursor.close()
        connection.close()
        
        print("\n" + "=" * 60)
        print("  ✓ Migration completed successfully!")
        print("=" * 60)
        return True
        
    except pymysql.Error as e:
        print(f"\n✗ Database error: {e}")
        if connection:
            connection.close()
        return False
    except Exception as e:
        print(f"\n✗ Unexpected error: {e}")
        if connection:
            connection.close()
        return False

if __name__ == '__main__':
    success = migrate_to_mysql()
    sys.exit(0 if success else 1)
