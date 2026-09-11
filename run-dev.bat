@echo off
cd /d "%~dp0"
set "NODE_EXE=C:\Users\user2\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
set "PNPM_CLI=C:\Users\user2\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\pnpm\bin\pnpm.cjs"
set "VSWHERE=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"

for /f "usebackq tokens=*" %%i in (`"%VSWHERE%" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath`) do set "VS_PATH=%%i"
if not defined VS_PATH (
  echo Visual Studio C++ build tools not found.
  pause
  exit /b 1
)
call "%VS_PATH%\Common7\Tools\VsDevCmd.bat" -arch=x64 -host_arch=x64
if errorlevel 1 (
  pause
  exit /b 1
)

if not exist "node_modules\@tauri-apps\cli\tauri.js" (
  echo Installing Tauri CLI...
  "%NODE_EXE%" "%PNPM_CLI%" install
  if errorlevel 1 (
    pause
    exit /b 1
  )
)

"%NODE_EXE%" "%~dp0node_modules\@tauri-apps\cli\tauri.js" dev
if errorlevel 1 pause
