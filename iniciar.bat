@echo off
:: Set working directory to the folder where this batch file is located
cd /d "%~dp0"

title CleanSweep Dev v2 - Servidor Local
color 0A
echo =======================================================
echo           INICIANDO CLEANSWEEP DEV V2
echo =======================================================
echo.
echo [1/3] Verificando dependencias locales de Node.js...
if not exist node_modules (
    echo [ALERTA] No se encontro la carpeta node_modules.
    echo Instalando express y dependencias...
    call npm install
) else (
    echo [INFO] Dependencias ya instaladas.
)
echo.
echo [2/3] Levantando el servidor local...
echo.
echo Para cerrar la aplicacion, cierra esta ventana de consola.
echo =======================================================
echo.
call npm start
if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Hubo un problema al iniciar el servidor con npm.
    echo Intentando iniciar con node directamente...
    node server.js
)
pause
