@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo NO WAY OUT wird gestartet...
echo.

set PORT=8000

REM 1. Versuch: "py" Launcher (haeufigster echter Python-Befehl auf Windows)
where py >nul 2>nul
if %errorlevel%==0 (
    echo Starte lokalen Server mit "py"...
    start "" http://localhost:%PORT%
    py -m http.server %PORT%
    goto :end
)

REM 2. Versuch: "python", aber nur wenn es NICHT der leere Microsoft-Store-Alias ist
python --version >nul 2>nul
if %errorlevel%==0 (
    echo Starte lokalen Server mit "python"...
    start "" http://localhost:%PORT%
    python -m http.server %PORT%
    goto :end
)

REM 3. Versuch: Node.js ist da -> npx serve
where node >nul 2>nul
if %errorlevel%==0 (
    echo Kein Python gefunden, starte mit Node.js "serve" stattdessen...
    start "" http://localhost:3000
    npx serve .
    goto :end
)

echo.
echo Weder Python noch Node.js wurden gefunden.
echo Bitte installiere eines von beiden:
echo   Python:  https://www.python.org/downloads/  (bei der Installation "Add to PATH" ankreuzen!)
echo   Node.js: https://nodejs.org
echo.
pause

:end
