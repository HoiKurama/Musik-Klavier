@echo off
setlocal EnableExtensions DisableDelayedExpansion
cd /d "%~dp0" || goto path_error

set "PROJECT_DIR=%CD%"
set "PROJECT_LOG=%TEMP%\start_project_%RANDOM%_%RANDOM%.log"
set "CHROME_EXE=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME_EXE%" set "CHROME_EXE=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME_EXE%" set "CHROME_EXE=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME_EXE%" goto chrome_error

if exist "package.json" goto node_project
if exist "index.html" goto html_project
echo Keine package.json und keine index.html in diesem Ordner gefunden.
goto error

:node_project
where node.exe >nul 2>nul || goto node_error
where npm.cmd >nul 2>nul || goto node_error
rem Aktuelle Vite-Konfiguration aus package.json: 127.0.0.1:5173.
node -e "fetch('http://127.0.0.1:5173',{signal:AbortSignal.timeout(1000)}).then(r=>r.text()).then(t=>process.exit(t.includes('<title>Klavierzeit')?0:1)).catch(()=>process.exit(1))"
if not errorlevel 1 (
  echo Klavierzeit laeuft bereits. Oeffne Chrome...
  start "" "%CHROME_EXE%" "http://127.0.0.1:5173"
  exit /b 0
)
set "RUN_SCRIPT="
node -e "const s=require('./package.json').scripts||{};process.exit(s.dev?0:1)"
if not errorlevel 1 set "RUN_SCRIPT=dev"
if not defined RUN_SCRIPT (
  node -e "const s=require('./package.json').scripts||{};process.exit(s.start?0:1)"
  if not errorlevel 1 set "RUN_SCRIPT=start"
)
if not defined RUN_SCRIPT (
  echo In package.json fehlt ein dev- oder start-Skript.
  goto error
)
node -e "const p=require('./package.json');process.exit(Object.keys(p.dependencies||{}).length+Object.keys(p.devDependencies||{}).length+Object.keys(p.optionalDependencies||{}).length?0:1)"
if errorlevel 1 goto start_node
if not exist "node_modules" goto install_dependencies
call npm.cmd ls --depth=0 --omit=optional >nul 2>nul
if errorlevel 1 goto install_dependencies
goto start_node

:install_dependencies
echo Installiere fehlende Abhaengigkeiten...
if exist "package-lock.json" (
  call npm.cmd ci
) else (
  call npm.cmd install
)
if errorlevel 1 goto error

:start_node
echo Starte npm run %RUN_SCRIPT%...
start "Projektserver" powershell.exe -NoProfile -NoExit -Command "$Host.UI.RawUI.WindowTitle='Projektserver'; Set-Location -LiteralPath $env:PROJECT_DIR; npm.cmd run $env:RUN_SCRIPT 2>&1 | Tee-Object -FilePath $env:PROJECT_LOG; Write-Host 'Server beendet. Dieses Fenster kann geschlossen werden.'"
goto open_browser

:html_project
where python.exe >nul 2>nul || goto python_error
echo Starte lokalen HTTP-Server...
start "Projektserver" powershell.exe -NoProfile -NoExit -Command "$Host.UI.RawUI.WindowTitle='Projektserver'; Set-Location -LiteralPath $env:PROJECT_DIR; cmd.exe /d /c 'python.exe -u -m http.server 0 --bind 127.0.0.1 2>&1' | Tee-Object -FilePath $env:PROJECT_LOG; Write-Host 'Server beendet. Dieses Fenster kann geschlossen werden.'"

:open_browser
echo Warte auf die lokale Projektadresse...
powershell.exe -NoProfile -Command "$deadline=(Get-Date).AddSeconds(45); do { $log=Get-Content -LiteralPath $env:PROJECT_LOG -Raw -ErrorAction SilentlyContinue; if($null -eq $log){$log=''}; $match=[regex]::Match($log,'https?://(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|\[::\]):\d+'); if($match.Success) { $url=$match.Value.Replace('0.0.0.0','127.0.0.1').Replace('[::]','127.0.0.1'); try { $response=Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 2; if($response.StatusCode -lt 500) { Start-Process -FilePath $env:CHROME_EXE -ArgumentList $url; Write-Host ('Chrome: '+$url); exit 0 } } catch { } }; Start-Sleep -Milliseconds 350 } while ((Get-Date) -lt $deadline); Write-Error 'Der Server hat innerhalb von 45 Sekunden keine erreichbare lokale Adresse ausgegeben. Bitte das Serverfenster pruefen.'; exit 1"
if errorlevel 1 goto error
exit /b 0

:path_error
echo Projektordner konnte nicht geoeffnet werden.
goto error
:chrome_error
echo Google Chrome wurde nicht gefunden.
goto error
:node_error
echo Node.js und npm fehlen. Bitte zuerst Node.js installieren.
goto error
:python_error
echo Python fehlt. Bitte zuerst Python installieren.
:error
echo.
pause
exit /b 1
