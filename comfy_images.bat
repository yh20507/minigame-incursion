@echo off
chcp 65001 > nul
setlocal EnableDelayedExpansion
cd /d "%~dp0"
set "PY="

rem 1) ComfyUI desktop: read install path from its config
if exist "%APPDATA%\ComfyUI\config.json" (
  for /f "usebackq delims=" %%B in (`powershell -NoProfile -Command "try{(Get-Content -Raw (Join-Path $env:APPDATA 'ComfyUI\config.json') | ConvertFrom-Json).basePath}catch{}"`) do (
    if exist "%%B\.venv\Scripts\python.exe" set "PY=%%B\.venv\Scripts\python.exe"
  )
)
rem 2) ComfyUI desktop default location
if not defined PY if exist "%USERPROFILE%\Documents\ComfyUI\.venv\Scripts\python.exe" set "PY=%USERPROFILE%\Documents\ComfyUI\.venv\Scripts\python.exe"
rem 3) ComfyUI portable next to this folder
if not defined PY if exist "%~dp0..\python_embeded\python.exe" set "PY=%~dp0..\python_embeded\python.exe"
if not defined PY if exist "%~dp0..\ComfyUI_windows_portable\python_embeded\python.exe" set "PY=%~dp0..\ComfyUI_windows_portable\python_embeded\python.exe"
rem 4) installed Python (skips the Microsoft Store stub)
if not defined PY (
  py -3 -c "import sys" >nul 2>nul && set "PY=py -3"
)
if not defined PY (
  python -c "import sys" >nul 2>nul && set "PY=python"
)
if not defined PY goto nopy

if "!PY!"=="py -3" (set "PYQ=py -3") else if "!PY!"=="python" (set "PYQ=python") else (set PYQ="!PY!")
echo Python: !PY!
!PYQ! -c "import PIL" >nul 2>nul || !PYQ! -m pip install pillow
!PYQ! tools\comfy_gen.py %*
pause
exit /b

:nopy
echo [!] 쓸 수 있는 Python 을 못 찾았어요.
echo     ComfyUI 설치 폴더 안의 .venv\Scripts\python.exe 위치를 알려주거나,
echo     https://www.python.org/downloads/ 에서 설치할 때 "Add python.exe to PATH" 를 체크하세요.
pause
