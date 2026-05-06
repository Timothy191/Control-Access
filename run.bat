@echo off
echo ==========================================
echo    Mine Management System
echo ==========================================
echo.
echo Starting application...
echo.
echo Database will be created at: %cd%\mine_management.db
echo.
echo Access the app at: http://localhost:5000
echo Default login: admin / admin
echo.
echo ==========================================
echo.
python app.py
pause