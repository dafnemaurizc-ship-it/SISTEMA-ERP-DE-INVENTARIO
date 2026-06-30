@echo off
setlocal
cd /d "%~dp0"
docker compose ps
echo.
echo ===== Backend logs =====
docker compose logs --tail=120 backend
pause
