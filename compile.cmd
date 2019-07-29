@echo off

pushd %~dp0

set "scriptRoot=%~dp0\..\DotNetBridge\bin\"
set "scriptRoot=%scriptRoot:\=/%"

rem add our path so we can locate the library at runtime
echo {ScriptRoot: "%scriptRoot%"} > local_settings.json

popd