"""
HVID Setup Script
Installs dependencies and initializes the database
"""
import subprocess
import sys
import os

def run_command(command, description):
    """Run a shell command and handle errors"""
    print(f"\n{'='*60}")
    print(f"  {description}")
    print(f"{'='*60}")
    try:
        result = subprocess.run(command, shell=True, check=True, text=True, capture_output=True)
        print(result.stdout)
        if result.stderr:
            print("STDERR:", result.stderr)
        print(f"✓ {description} completed successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"✗ Error during {description}:")
        print(f"  Command: {e.cmd}")
        print(f"  Return code: {e.returncode}")
        print(f"  Output: {e.output}")
        if e.stderr:
            print(f"  Error: {e.stderr}")
        return False

def main():
    print("=" * 60)
    print("  HVID Application Setup")
    print("=" * 60)
    
    # Step 1: Install Python dependencies
    if not run_command("pip install -r requirements.txt", "Installing Python dependencies"):
        print("\n⚠ Warning: Some dependencies might not have installed correctly.")
        print("You may need to run: pip install -r requirements.txt manually")
    
    # Step 2: Initialize database
    print("\n" + "=" * 60)
    print("  Database Initialization")
    print("=" * 60)
    
    try:
        # Import and run the database initialization
        import init_database
        init_database.init_database()
    except Exception as e:
        print(f"\n✗ Database initialization failed: {e}")
        print("\nYou can try running manually:")
        print("  python init_database.py")
        sys.exit(1)
    
    # Success message
    print("\n" + "=" * 60)
    print("  ✓ HVID Setup Complete!")
    print("=" * 60)
    print("\nYou can now start the application:")
    print("  python app.py")
    print("\nOr use the batch file:")
    print("  run.bat")
    print("\nDefault login credentials:")
    print("  Phone: +919962106567")
    print("  OTP: 123456")
    print("=" * 60)

if __name__ == '__main__':
    main()
