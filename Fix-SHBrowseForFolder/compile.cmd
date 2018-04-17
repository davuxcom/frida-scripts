@echo off
cd "%~dp0"

del /q Fix-SHBrowseForFolder.compiled.js
type ..\common\windows-platform.js ..\common\struct.js Fix-SHBrowseForFolder.js > Fix-SHBrowseForFolder.compiled.js