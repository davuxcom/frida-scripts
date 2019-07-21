@echo off

for %%a in ("%~dp0\.") do set "parent=%%~nxa"

rem embed the xaml
echo var windowXaml = '' + > %parent%.compiled.js
for /f "delims=" %%a in ('Type "window.xaml"') do (
    echo '%%a' + >> %parent%.compiled.js
)
echo ''; >> %parent%.compiled.js

rem merge the rest
type %~dp0\..\common\win32.js %~dp0\..\common\dotnet.js %parent%.js >> %parent%.compiled.js