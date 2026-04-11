@echo off
setlocal

set "ROOT_DIR=%~dp0"
set "APP_DIR=%ROOT_DIR%bodydouble"

if not exist "%APP_DIR%\package.json" (
  echo Could not find the BodyDouble app at:
  echo %APP_DIR%
  pause
  exit /b 1
)

if not exist "%APP_DIR%\node_modules" (
  echo Dependencies are missing for BodyDouble.
  echo Run "npm install" in:
  echo %APP_DIR%
  pause
  exit /b 1
)

cd /d "%APP_DIR%"
echo Launching BodyDouble from %APP_DIR%
call npm run dev

if errorlevel 1 (
  echo.
  echo Launch failed.
  pause
  exit /b 1
)

endlocal
