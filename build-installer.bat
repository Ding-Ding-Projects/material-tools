@echo off
setlocal
set "BUILD_MODE="
if /I "%~1"=="/s" set "BUILD_MODE=-Silent"
if /I "%~1"=="--silent" set "BUILD_MODE=-Silent"
if "%SILENT%"=="1" set "BUILD_MODE=-Silent"
set "POWERSHELL_EXE=powershell.exe"
where pwsh.exe >nul 2>nul && set "POWERSHELL_EXE=pwsh.exe"
%POWERSHELL_EXE% -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\build-installer.ps1" %BUILD_MODE%
exit /b %ERRORLEVEL%
