@echo off

for %%a in ("%~dp0\.") do set "parent=%%~nxa"

type %~dp0\..\common\win32.js %~dp0\..\common\dotnet.js %parent%.js > %parent%.compiled.js