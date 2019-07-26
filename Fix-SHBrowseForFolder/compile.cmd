@echo off

for %%a in ("%~dp0\.") do set "parent=%%~nxa"

pushd %~dp0
rem have to fix frida-compile path issue so this works directly.
frida-compile %parent%.js -o %parent%.compiled.js
popd