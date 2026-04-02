@echo off
title nichtskoenner v2

:: edgy
echo ========================================
echo   nichtskoenner v2 - DEBUG MODE
echo ========================================
echo.

:: Check if Node.js is installed
echo [1/3] Checking for Node.js...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo     ERROR: Node.js not found in PATH!
    echo     Please install Node.js or add it to your PATH.
    pause
    exit /b 1
)
echo     ✓ Node.js found

:: Show current directory
echo [2/3] Current directory: %CD%
echo.

:: Check if launcher.js exists
if not exist "launcher.js" (
    echo     ERROR: launcher.js not found in %CD%!
    pause
    exit /b 1
)
echo     ✓ launcher.js found

:: Run the launcher
echo [3/3] Starting launcher...
echo.
node launcher.js

:: only show if err exit
if %errorlevel% neq 0 (
    echo.
    echo ========================================
    echo   LAUNCHER EXITED WITH ERROR CODE: %ERRORLEVEL%
    echo ========================================
    pause
)