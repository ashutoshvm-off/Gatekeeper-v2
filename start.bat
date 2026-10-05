@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%ProgramFiles%\ASIET-Gatekeeper\windows\start.ps1"
if errorlevel 1 pause
