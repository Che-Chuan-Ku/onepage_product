@echo off
chcp 65001 >nul 2>&1

set PORT=3001
echo ============================================
echo   OnePage Frontend (Next.js :%PORT%)
echo ============================================

:: Get PID on port
set PID=
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":%PORT% " ^| findstr "LISTENING"') do (
    if not defined PID set PID=%%a
)

if defined PID goto :do_kill
goto :do_start

:do_kill
echo [RUNNING] PID: %PID%
echo [KILL] Stopping...
taskkill /PID %PID% /T /F >nul 2>&1
ping -n 3 127.0.0.1 >nul 2>&1
echo [OK] Stopped.
goto :done

:do_start
echo [START] Launching frontend...
cd /d "%~dp0frontend"
start "OnePage-Frontend" cmd /c "npx next dev -p %PORT%"
echo [WAIT] Waiting for port %PORT%...
set /a N=0

:wait_fe
set /a N+=1
if %N% gtr 15 (
    echo [FAIL] Timeout after 30s
    goto :done
)
ping -n 3 127.0.0.1 >nul 2>&1
netstat -ano 2>nul | findstr ":%PORT% " | findstr "LISTENING" >nul 2>&1
if errorlevel 1 goto :wait_fe
echo [OK] Frontend ready - http://localhost:%PORT%

:done
