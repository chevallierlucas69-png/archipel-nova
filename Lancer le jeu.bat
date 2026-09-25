@echo off
setlocal
cd /d "%~dp0"
start "" wscript.exe //B "%~dp0launch-hidden.vbs"
endlocal
