@echo off
echo ============================================================
echo   HVID Application - Complete Setup
echo ============================================================
echo.

echo [Step 1/3] Installing Python dependencies...
echo ------------------------------------------------------------
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)
echo.
echo SUCCESS: Dependencies installed
echo.

echo [Step 2/3] Testing database connection...
echo ------------------------------------------------------------
python test_db_connection.py
if %errorlevel% neq 0 (
    echo ERROR: Database connection failed
    echo Please check your MySQL server and credentials
    pause
    exit /b 1
)
echo.

echo [Step 3/3] Initializing database tables...
echo ------------------------------------------------------------
python init_database.py
if %errorlevel% neq 0 (
    echo ERROR: Database initialization failed
    pause
    exit /b 1
)
echo.

echo ============================================================
echo   Setup Complete!
echo ============================================================
echo.
echo You can now start the application with:
echo   python app.py
echo.
echo Or use the run script:
echo   run.bat
echo.
echo Default login:
echo   Phone: +919962106567
echo   OTP: 123456
echo.
echo Application will be available at:
echo   http://localhost:3000
echo.
echo ============================================================
pause
