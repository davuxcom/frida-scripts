@echo off
:CheckPowerShellExecutionPolicy
FOR /F "tokens=*" %%i IN ('powershell -noprofile -command Get-ExecutionPolicy') DO Set PSExecMode=%%i
if /I "%PSExecMode%"=="unrestricted" goto :RunPowerShellScript

rem On exit, ERRORLEVEL will be nonzero if not elevated, and 0 if elevated.
"%SYSTEMROOT%\system32\icacls.exe" "%SYSTEMROOT%\system32\config\system" > nul 2>&1
if not "%ERRORLEVEL%"=="0" (
	echo Elevation required to change PowerShell execution policy from [%PSExecMode%] to Unrestricted
	powershell -NoProfile -Command "start-process -Wait -Verb 'RunAs' -FilePath 'powershell.exe' -ArgumentList '-NoProfile Set-ExecutionPolicy Unrestricted'"
) else (
	powershell -NoProfile Set-ExecutionPolicy Unrestricted
)
:RunPowerShellScript
set POWERSHELL_BAT_ARGS=%*
if defined POWERSHELL_BAT_ARGS set POWERSHELL_BAT_ARGS=%POWERSHELL_BAT_ARGS:"=\"%
PowerShell -Command Invoke-Expression $('$args=@(^&{$args} %POWERSHELL_BAT_ARGS%);'+[String]::Join([Environment]::NewLine,$((Get-Content '%~f0' ^| select -skip 18) -notmatch '^^@@^|^^:'))) & goto :EOF

# manual_assert(line=19)

cd $PSScriptRoot

$proc = Start-Process "notepad.exe" -PassThru
frida -p $proc.Id -l Test-DotNetBridge.compiled.js
