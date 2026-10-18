@echo off
rem Ouvre le HUD Expresso Trainer maintenant (options possibles a la suite, voir LISEZMOI.txt)
powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0hud-betclic.ps1" %*
