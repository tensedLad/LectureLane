@echo off
echo Starting LectureLane...
echo.

start cmd /k "npm start"

timeout /t 3 /nobreak

start http://localhost:3001/app

echo LectureLane is running!
echo You can close this window after you're done using the application.