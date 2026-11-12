@echo off
rem GB-Quest MMO SERVER (the PostgreSQL-backed authoritative MMO service, backend\mmorpg-server.cjs). Double-click.
rem This is NOT the simpler realm server: for that one, use start-realm-server.bat (see docs\adr\0001-backend-modes.md).
rem Needs Docker Desktop. The first run creates .env with random secrets, then starts PostgreSQL and the MMO service
rem with Docker Compose. Migrations run automatically when the service starts. The service listens on 127.0.0.1:8788.
rem Copy this file to the top of your GB-Quest folder (next to package.json) and run it from there.
setlocal
cd /d "%~dp0"
if not exist package.json cd /d "%~dp0..\.."
title GB-Quest MMO server

docker compose version >nul 2>nul
if errorlevel 1 (
  echo.
  echo Docker is not installed or not running. Install Docker Desktop from https://www.docker.com/products/docker-desktop
  echo then start it and run this file again.
  pause
  exit /b 1
)

if not exist .env (
  echo Creating .env with random secrets. Keep this file private: it is in .gitignore.
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$r=[Security.Cryptography.RandomNumberGenerator]::Create();" ^
    "function Hex($n){$b=New-Object byte[] $n;$r.GetBytes($b);-join($b|ForEach-Object{$_.ToString('x2')})}" ^
    "$t=Get-Content -Raw .env.example;" ^
    "$t=$t.Replace('REPLACE_WITH_A_LONG_RANDOM_DATABASE_PASSWORD',(Hex 32)).Replace('REPLACE_WITH_AT_LEAST_32_RANDOM_CHARACTERS',(Hex 48));" ^
    "$t=$t -replace '(?m)^GBQ_ALLOWED_ORIGINS=.*$','GBQ_ALLOWED_ORIGINS=https://html-classic.itch.zone';" ^
    "[IO.File]::WriteAllText((Join-Path (Get-Location) '.env'),$t)"
  if not exist .env (echo Could not create .env. & pause & exit /b 1)
  echo Edit GBQ_ALLOWED_ORIGINS in .env to add the https address of the page that hosts your game.
)

echo Starting PostgreSQL and the MMO service...
docker compose up -d --build
if errorlevel 1 (echo Docker Compose could not start the MMO server. & pause & exit /b 1)

echo Waiting for the MMO server to answer...
powershell -NoProfile -Command ^
  "for($i=0;$i -lt 60;$i++){try{$h=Invoke-RestMethod -TimeoutSec 2 http://127.0.0.1:8788/health;if($h.ok){exit 0}}catch{};Start-Sleep 2};exit 1"
if errorlevel 1 (
  echo The MMO server did not become healthy. Recent log lines:
  docker compose logs --tail 40 mmorpg
  pause
  exit /b 1
)

echo.
echo ============================================================
echo  GB-Quest MMO server is running
echo  Address:       http://127.0.0.1:8788   (health: /health, game socket: /ws)
echo  In the game:   open the MMO account panel and use that address as the MMO SERVER URL.
echo  For players on the internet, put it behind HTTPS (see backend\DEPLOYMENT.md).
echo  Logs:          docker compose logs -f mmorpg
echo  Stop:          docker compose down        (your data stays in the gbquest-postgres volume)
echo ============================================================
echo.
pause
