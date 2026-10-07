@echo off
REM ============================================================
REM   HVID Application - Master Setup Script
REM   This script will guide you through the complete setup
REM ============================================================

:MENU
cls
echo ============================================================
echo   HVID Application - Setup Menu
echo ============================================================
echo.
echo   1. Test Database Connection
echo   2. Initialize Database (Create Tables)
echo   3. Install Dependencies
echo   4. Complete Setup (All Steps)
echo   5. Run Application
echo   6. Test API Endpoints
echo   7. Exit
echo.
echo ============================================================
echo.

set /p choice="Enter your choice (1-7): "

if "%choice%"=="1" goto TEST_DB
if "%choice%"=="2" goto INIT_DB
if "%choice%"=="3" goto INSTALL_DEPS
if "%choice%"=="4" goto FULL_SETUP
if "%choice%"=="5" goto RUN_APP
if "%choice%"=="6" goto TEST_API
if "%choice%"=="7" goto END

echo Invalid choice. Please try again.
pause
goto MENU

:TEST_DB
cls
echo ============================================================
echo   Testing Database Connection
echo ============================================================
echo.
python test_db_connection.py
echo.
pause
goto MENU

:INIT_DB
cls
echo ============================================================
echo   Initializing Database
echo ============================================================
echo.
python init_database.py
echo.
pause
goto MENU

:INSTALL_DEPS
cls
echo ============================================================
echo   Installing Dependencies
echo ============================================================
echo.
pip install -r requirements.txt
echo.
echo Dependencies installed successfully!
pause
goto MENU

:FULL_SETUP
cls
echo ============================================================
echo   Complete Setup
echo ============================================================
echo.
echo Step 1/3: Installing dependencies...
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Failed to install dependencies
    pause
    goto MENU
)

echo.
echo Step 2/3: Testing database connection...
python test_db_connection.py
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Database connection failed
    pause
    goto MENU
)

echo.
echo Step 3/3: Initializing database...
python init_database.py
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Database initialization failed
    pause
    goto MENU
)

echo.
echo ============================================================
echo   Setup Complete!
echo ============================================================
echo.
echo You can now:
echo   - Run the application (Option 5)
echo   - Test the API (Option 6)
echo.
pause
goto MENU

:RUN_APP
cls
echo ============================================================
echo   Starting HVID Application
echo ============================================================
echo.
echo Server will start at: http://localhost:3000
echo.
echo Default Login:
echo   Phone: +919962106567
echo   OTP: 123456
echo.
echo Press Ctrl+C to stop the server
echo ============================================================
echo.
python app.py
pause
goto MENU

:TEST_API
cls
echo ============================================================
echo   Testing API Endpoints
echo ============================================================
echo.
echo Make sure the application is running first!
echo.
pause
python test_api.py
echo.
pause
goto MENU

:END
cls
echo.
echo Thank you for using HVID Application Setup!
echo.
exit /b 0
