@echo off
rem GB-Quest REALM SERVER (the multiplayer world). Double-click this file.
rem This is the simple JSON-file realm server (no database). For the PostgreSQL MMO service use start-mmo-server.bat;
rem docs\adr\0001-backend-modes.md explains which one to run.
rem It updates from GitHub, then runs backend\server.cjs on port 8787 for this PC and your local network:
rem accounts, cloud saves, 3 regions x 3 realms (each realm is its own world), live players, chat, party battles.
rem Copy this file to the top of your GB-Quest folder (next to package.json) and run it from there.
cd /d "%~dp0"
if not exist package.json cd /d "%~dp0..\.."
title GB-Quest realm server

rem Update from GitHub only inside a git checkout (a downloaded zip has no .git folder).
where git >nul 2>nul
if %errorlevel%==0 if exist .git (
  echo Getting the latest version from GitHub...
  git pull --ff-only
  if errorlevel 1 (
    echo Local file changes are blocking the update. Setting them aside with git stash...
    git stash push -m "realm-server auto-stash"
    git pull --ff-only
    if errorlevel 1 (echo Could not update - starting the version already in this folder.) else (echo Updated. Your set-aside changes are kept: run "git stash list" to see them.)
  )
)

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js is not installed. Get it from https://nodejs.org then run this file again.
  pause
  exit /b 1
)

set HOST=0.0.0.0
set PORT=8787
echo.
echo ============================================================
echo  GB-Quest realm server
echo  On this PC:        http://127.0.0.1:%PORT%
echo  Friends on your network can join at one of these addresses:
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do for /f "tokens=*" %%b in ("%%a") do echo                     http://%%b:%PORT%
echo  If Windows asks about the firewall, allow Node.js on private networks.
echo  Close this window to stop the server. Realm data: server\data\realm.json
echo ============================================================
echo.
start "" /min cmd /c "timeout /t 2 >nul & start http://127.0.0.1:%PORT%"
node backend\server.cjs
pause
