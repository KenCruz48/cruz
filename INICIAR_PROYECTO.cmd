@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" set "PATH=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;%PATH%"
where node >nul 2>&1
if errorlevel 1 (
  echo Instala Node.js 22 o superior antes de iniciar.
  pause
  exit /b 1
)
if not exist "node_modules\express" (
  call npm ci
  if errorlevel 1 goto error
)
echo Abre http://localhost:3000 cuando el servidor confirme la conexion.
call npm run demo:start
if errorlevel 1 goto error
exit /b 0
:error
echo No se pudo iniciar. Consulta docs/GUIA_SUSTENTACION.md.
pause
exit /b 1
