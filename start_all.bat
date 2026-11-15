@echo off
title GeoAnalog AI Launcher
color 0B
echo =====================================================================
echo              GEOANALOG AI - DIGITAL TWIN MATRIX LAUNCHER
echo    Atlas Planetario, NASA PDS Diviner/LOLA y Motor de Analogos
echo =====================================================================
echo.
echo [1/2] Iniciando Backend FastAPI en http://127.0.0.1:8000 ...
start "GeoAnalog AI - Backend (FastAPI)" cmd /k "cd /d %~dp0backend && .venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

echo [2/2] Iniciando Frontend React + Three.js en http://localhost:5173 ...
start "GeoAnalog AI - Frontend (Vite)" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo =====================================================================
echo  Ambos servicios estan iniciando en ventanas independientes.
echo  Backend:  http://127.0.0.1:8000 (API REST + Docs en /docs)
echo  Frontend: http://localhost:5173 (Control de Mision + Visor Dual)
echo =====================================================================
timeout /t 5
