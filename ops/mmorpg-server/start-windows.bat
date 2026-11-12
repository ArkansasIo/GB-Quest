@echo off
setlocal
cd /d "%~dp0\..\.."
if not exist ".env" (
  echo Missing .env. Copy .env.example to .env and set both secrets first.
  exit /b 1
)
docker compose --env-file .env -f docker-compose.mmorpg.yml up -d --build
if errorlevel 1 exit /b %errorlevel%
docker compose --env-file .env -f docker-compose.mmorpg.yml ps
endlocal
