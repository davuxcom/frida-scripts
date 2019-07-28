@echo off

for /F "TOKENS=1,2,*" %%a in ('tasklist /FI "IMAGENAME eq xboxapp.exe"') do set PID=%%b

for %%a in ("%~dp0\.") do set "parent=%%~nxa"

frida --enable-jit -p %PID% -l %~dp0\%parent%.compiled.js