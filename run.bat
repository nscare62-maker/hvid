@echo off
echo ============================================================
echo   HVID App — Unified Flask Server
echo   URL:   http://localhost:3000
echo   Login: +919962106567  /  OTP: 123456
echo ============================================================
echo.
cd /d %~dp0
pip install -r requirements.txt --quiet
python app.py
pause
