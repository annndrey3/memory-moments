@echo off
REM ============================================
REM Memory Moments Marketplace - Startup Script
REM ============================================
REM This script starts both the API server and the client dev server

chcp 65001 > nul
cls

echo.
echo ========================================
echo 🚀 Memory Moments Marketplace Startup
echo ========================================
echo.

REM Get the directory where this script is located
cd /d "%~dp0"

REM Start API Server in a new window
echo 📡 Starting API Server (Port 3001)...
start "Memory Moments - API Server" cmd /k "cd t-shirt-designer-webapp-main\marketplace\server && node src/index.js"
timeout /t 2 /nobreak

REM Start Client Dev Server in a new window
echo 🌐 Starting Client Dev Server (Port 5174)...
start "Memory Moments - Client Dev Server" cmd /k "cd t-shirt-designer-webapp-main\marketplace\client && npm run dev -- --host"
timeout /t 2 /nobreak

REM Start Designer (constructor) in a new window
echo 🎨 Starting Designer / Constructor (Port 5173)...
start "Memory Moments - Designer" cmd /k "cd t-shirt-designer-webapp-main && npm run dev"

echo.
echo ========================================
echo ✅ Services Starting!
echo ========================================
echo.
echo 📍 Admin Panel:    http://localhost:5174/admin
echo 📍 Marketplace:    http://localhost:5174
echo 📍 Designer:       http://localhost:5173
echo 📍 API Server:     http://localhost:3001/api
echo.
echo 🔐 Admin Credentials:
echo    Email: admin@memory-moments.local
echo    Password: admin123
echo.
echo 💡 To stop services, close the terminal windows
echo.
echo ========================================
echo.

REM Keep this window open
cmd /k "echo Both servers are running in separate windows above."