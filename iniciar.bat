@echo off
title Gabi Content OS
cd /d "%~dp0"

set "PATH=C:\Program Files\nodejs;%PATH%"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Nao encontrei o Node.js nesta maquina.
  echo  Instale em https://nodejs.org e rode este arquivo de novo.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo.
  echo  Primeira vez: instalando as dependencias. Isso demora alguns minutos.
  echo.
  call npm install
)

echo.
echo  ================================================
echo   Gabi Content OS
echo.
echo   Abra no navegador:  http://localhost:3000
echo.
echo   Para desligar: feche esta janela ou tecle Ctrl+C
echo  ================================================
echo.

start "" http://localhost:3000
call npm run dev

echo.
echo  O servidor parou.
pause
