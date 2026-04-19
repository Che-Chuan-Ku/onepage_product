@echo off
chcp 65001 >nul 2>&1

set PORT=8080
echo ============================================
echo   OnePage Backend (Spring Boot :%PORT%)
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
ping -n 4 127.0.0.1 >nul 2>&1
echo [OK] Stopped.
goto :done

:do_start
echo [START] Launching backend...
cd /d "%~dp0backend"
start "OnePage-Backend" cmd /c "mvn spring-boot:run"
echo [WAIT] Waiting for port %PORT%...
set /a N=0

:wait_be
set /a N+=1
if %N% gtr 30 (
    echo [FAIL] Timeout after 60s
    goto :done
)
ping -n 3 127.0.0.1 >nul 2>&1
netstat -ano 2>nul | findstr ":%PORT% " | findstr "LISTENING" >nul 2>&1
if errorlevel 1 goto :wait_be
echo [OK] Backend ready - http://localhost:%PORT%

:done
