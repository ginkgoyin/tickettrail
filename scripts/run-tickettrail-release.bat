@echo off
setlocal
cd /d "%~dp0.."
set "APP=%CD%\src-tauri\target\release\tickettrail.exe"

if exist "%APP%" (
  start "" "%APP%"
  exit /b 0
)

echo Release executable not found:
echo %APP%
echo.
echo Build it first with:
echo npm.cmd run release:windows
pause
