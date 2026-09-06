@echo off
cd /d "%~dp0"
set "NODE_EXE=C:\Users\user2\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
set "PNPM_CLI=C:\Users\user2\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\pnpm\bin\pnpm.cjs"

if not exist "node_modules\electron\cli.js" (
  echo Installing Electron...
  "%NODE_EXE%" "%PNPM_CLI%" install
  if errorlevel 1 (
    pause
    exit /b 1
  )
)

"%NODE_EXE%" "node_modules\electron\cli.js" . || pause
