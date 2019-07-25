@echo off

for %%a in ("%~dp0\.") do set "parent=%%~nxa"

rem have to fix frida-compile path issue so this works directly.
.\node_modules\.bin\frida-compile.cmd %parent%.js -o %parent%.compiled.js