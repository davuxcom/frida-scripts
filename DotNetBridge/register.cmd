
cd %~dp0

"%WinDir%\Microsoft.NET\Framework64\v4.0.30319\RegAsm.exe" -tlb -codebase .\bin\x64\Debug\DotNetBridge.dll
"%WinDir%\Microsoft.NET\Framework\v4.0.30319\RegAsm.exe" -tlb -codebase .\bin\x86\Debug\DotNetBridge.dll

pause