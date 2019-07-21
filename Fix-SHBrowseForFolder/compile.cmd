@echo off

for %%a in ("%~dp0\.") do set "parent=%%~nxa"

type %~dp0\..\common\win32.js %parent%.js > %parent%.compiled.js