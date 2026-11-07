@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "PY=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
if exist "%PY%" goto launch
where py >nul 2>nul
if errorlevel 1 goto python
set "PY=py"
goto launch
:python
set "PY=python"
:launch
"%PY%" launch.py
if errorlevel 1 pause
