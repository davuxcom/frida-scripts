@echo off

for %%a in ("%~dp0\.") do set "parent=%%~nxa"

pushd %~dp0
frida-compile %parent%.js -o %parent%.compiled.js
popd