@echo off

for %%a in ("%~dp0\.") do set "parent=%%~nxa"

rem have to fix frida-compile path issue so this works directly.
frida-compile %~dp0\%parent%.js -o %~dp0\%parent%.compiled.js