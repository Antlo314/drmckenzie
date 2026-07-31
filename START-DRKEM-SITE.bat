@echo off
REM Dr. Kem - Mind Your Mind, the public site. Static, no build step.
REM Served on 4980 (site only; no engine port for this galaxy yet).
REM Keep this file pure ASCII.
cd /d "%~dp0site"
echo.
echo  MIND YOUR MIND - Dr. Kemberly E. McKenzie
echo  http://127.0.0.1:4980
echo  Ctrl+C to stop
echo.
python -m http.server 4980
if errorlevel 1 pause
