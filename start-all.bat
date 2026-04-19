@echo off
chcp 65001 >nul 2>&1

echo ============================================
echo   OnePage - Service Manager
echo ============================================
echo.

call "%~dp0start-backend.bat"
echo.
call "%~dp0start-frontend.bat"

echo.
echo ============================================
echo   Done.
echo ============================================
pause
