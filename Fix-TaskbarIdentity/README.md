# Script: Assign a unique taskbar identity

This script locates gets the 'main' hwnd for the current (injected) process, and sets a unique AppId on that window, ensuring the taskbar will show it as a unique button.

## How to use this script

- Install Frida (`npm install frida`)
- Execute `compile.cmd` to merge the scripts
- Execute `run.cmd` to launch and attach Frida
- Observe that `notepad.exe` has a unique button in the taskbar, and doesn't group with other notepad.exe instances.

![Taskbar showing two notepad buttons](./gfx/taskbar.png)
