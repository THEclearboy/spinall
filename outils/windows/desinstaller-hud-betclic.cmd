@echo off
rem Retire la veille du demarrage de Windows et l'arrete
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0hud-betclic.ps1" -Desinstaller
pause
