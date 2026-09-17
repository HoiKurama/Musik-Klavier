@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Bitte zuerst Node.js 22.12 oder neuer installieren: https://nodejs.org/
  pause
  exit /b 1
)
node -e "const [major,minor]=process.versions.node.split('.').map(Number);process.exit((major===20&&minor>=19)||(major===22&&minor>=12)||major>=24?0:1)"
if errorlevel 1 (
  echo Bitte Node.js 22.12 oder neuer installieren: https://nodejs.org/
  pause
  exit /b 1
)
if not exist "node_modules\.bin\vite.cmd" (
  echo Einmalige Installation. Hierfuer wird Internet benoetigt.
  call npm.cmd ci
  if errorlevel 1 (
    echo Installation fehlgeschlagen. Bitte Internetverbindung pruefen.
    pause
    exit /b 1
  )
)
echo Klavierzeit startet. Dieses Fenster zum Beenden schliessen.
call npm.cmd start
if errorlevel 1 pause
