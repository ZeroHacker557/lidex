@echo off
chcp 65001 >nul
title Lidex bot (kompyuterda)
echo Lidex bot kompyuterda ishga tushmoqda... Oynani yopsangiz bot Vercel'ga qaytadi.
cd /d "%~dp0server"
node ..\node_modules\tsx\dist\cli.mjs src\index.ts
pause
