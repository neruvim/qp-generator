@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js is missing. Install Node.js 22.12+ from https://nodejs.org/
  goto :failed
)
where npm.cmd >nul 2>&1
if errorlevel 1 (
  echo npm is missing. Reinstall Node.js with npm included.
  goto :failed
)

if not exist "node_modules\.bin\vite.cmd" (
  echo Installing dependencies...
  call npm.cmd ci
  if errorlevel 1 goto :failed
)

echo Building qp generator with offline support...
call npm.cmd run build
if errorlevel 1 goto :failed

echo.
echo Starting qp generator. The Local link will appear below when ready.
echo Keep this window open. Press Ctrl+C to stop.
echo Port 4173 is fixed so your saved draw stays at the same address.
echo.
call npm.cmd run preview -- --host localhost --port 4173 --strictPort
if errorlevel 1 (
  echo.
  echo Could not start. If port 4173 is busy, close the previous local server and retry.
  goto :failed
)
exit /b 0

:failed
echo.
echo Startup failed. See the error above.
pause
exit /b 1
