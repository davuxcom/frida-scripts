@echo off

for %%a in ("%~dp0\.") do set "parent=%%~nxa"

rem compile the .net component
"%WinDir%\Microsoft.NET\Framework64\v4.0.30319\csc.exe" /nologo /t:library *.cs

set "scriptRoot=%~dp0"
set "scriptRoot=%scriptRoot:\=/%"

rem add our path so we can locate the library at runtime
echo var scriptRoot = "%scriptRoot%"; > %parent%.compiled.js

rem combine common files
type %~dp0\..\common\win32.js %~dp0\..\common\dotnet.js %parent%.js >> %parent%.compiled.js