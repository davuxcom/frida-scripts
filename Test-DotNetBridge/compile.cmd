@echo off

for %%a in ("%~dp0\.") do set "parent=%%~nxa"

rem compile the .net component
pushd %~dp0
"%WinDir%\Microsoft.NET\Framework64\v4.0.30319\csc.exe" /nologo /t:library *.cs

set "scriptRoot=%~dp0"
set "scriptRoot=%scriptRoot:\=/%"

rem add our path so we can locate the library at runtime
echo {ScriptRoot: "%scriptRoot%"} > local_settings.json

rem have to fix frida-compile path issue so this works directly.
frida-compile %parent%.js -o %parent%.compiled.js

popd