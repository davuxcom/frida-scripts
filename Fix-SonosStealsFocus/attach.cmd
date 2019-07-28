@echo off

rem set AppCmdLine="%~dp0\WpfTestApp\WpfTestApp\bin\Debug\WpfTestApp.exe"
set AppCmdLine="C:\Program Files (x86)\Sonos\Sonos.exe"
set ProcessCmd=wmic process call create %AppCmdLine%
for /f "tokens=3 delims=; " %%a in ('%ProcessCmd% ^| find "ProcessId"') do set PID=%%a
for %%a in ("%~dp0\.") do set "parent=%%~nxa"

frida --enable-jit -p %PID% -l %~dp0\%parent%.compiled.js