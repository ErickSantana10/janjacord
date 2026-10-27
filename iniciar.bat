@echo off
title Janjacord Launcher
echo ===================================================
echo           INICIANDO JANJACORD (DISCORD 2)
echo ===================================================
echo.

start "Janjacord - Backend Server" cmd /k "cd server && npm run dev"
timeout /t 2 /nobreak >nul

start "Janjacord - Frontend Web" cmd /k "cd client && npm run dev"
timeout /t 2 /nobreak >nul

echo Abrindo Janjacord no seu navegador...
start http://localhost:5173

echo.
echo Tudo pronto! O Janjacord esta rodando.
echo Para fechar, basta fechar as duas janelas de comando abertas.
pause
