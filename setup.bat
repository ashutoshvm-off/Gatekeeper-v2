@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\setup.ps1"
if errorlevel 1 (
  echo Setup did not complete. Review the error above.
  pause
  exit /b 1
)
pause
