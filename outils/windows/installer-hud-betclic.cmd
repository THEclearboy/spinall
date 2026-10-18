@echo off
rem Veille : le HUD s'ouvre a chaque lancement de Betclic, relancee a chaque demarrage de Windows
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0hud-betclic.ps1" -Installer %*
pause
