@echo off
cd /d "%~dp0"
where node >nul 2>nul
if %errorlevel%==0 (
  node --env-file-if-exists=.env server.mjs
) else (
  "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" --env-file-if-exists=.env server.mjs
)
pause
