@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\update.ps1"
if errorlevel 1 (
    echo Update did not complete. Read the error above before retrying.
    pause
    exit /b 1
)
pause
