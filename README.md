# Frida scripts for Windows application hooking
This repository contains scripts for working with [Frida](https://www.frida.re/docs/home/) on Windows.  The objective of Frida scripts is to inject into a third-party target process and modify behavior.

Scripts are provided for interacting with COM, WinRT and .NET APIs directly from javascript Frida scripts.

- Learn more about [Frida](https://www.frida.re/docs/home/), a dynamic code instrumentation toolkit.
- Install Frida `npm install -g frida frida-compile`
- Review the [Frida JavaScript API](https://www.frida.re/docs/javascript-api), which provides access to native functions and memory manipulation.  Scripts here are based on this API.

### Introduction to Frida scripts on Windows
The workflow is this:
- A target app is running on the machine
- A crafted javascript file (the script) compiled using `frida-compile`, merging in common resources.
- The script is attached and injected into the target (e.g. `frida -p 1234 -l myscript.compiled.js`)
- A custom set of instructions in the script manipulate memory in the target using Frida APIs, as well as higher level APIs like com.js and dotnet.js to call more complex APIs (e.g. opening a named pipe or streaming data to a log file)
- The target app and script both operate concurrently from the process space of the target

#### Example: attach to a running process
We attach to a running instance of notepad by looking in task manager for the `PID` (say `1447` in this case):

```
frida -p 1447 -l myscript.compiled.js
```

Frida will then start and attach to the target:

```
     ____
    / _  |   Frida 11.0.12 - A world-class dynamic instrumentation toolkit
   | (_| |
    > _  |   Commands:
   /_/ |_|       help      -> Displays the help system
   . . . .       object?   -> Display information about 'object'
   . . . .       exit/quit -> Exit
   . . . .
   . . . .   More info at http://www.frida.re/docs/home/
Attaching...

[Local::PID::1447]->

```

At this point as long as no errors are present in the output, the script is attached and ready to go. Scripts in this repository usualy print `Begin` or `Ready` to signal the script is actually loaded. If frida quits, there may be a parse error in the script.

- The [Frida](https://www.frida.re/docs/home/) console has commands and features, but we don't need to use it for scripts here.
- You can also launch and attach to processes using other methods.

## Script: Replace SHBrowseForFolder with IFileDialog (COM)
[Fix-SHBrowseForFolder](./Fix-SHBrowseForFolder) replaces the legacy folder dialog with the modern new dialog, enabling path entry.

![Legacy SHBrowseForFolder IFileDialog selection dialog](./Fix-SHBrowseForFolder/gfx/dialogs.png)

(Left) Legacy SHBrowseForFolder dialog, (Right) modern IFileDialog dialog.

#### [View and install Fix-SHBrowseForFolder script](./Fix-SHBrowseForFolder)

## Script: Assign a unique taskbar identity (.NET & COM)
Group a specific window differently on the taskbar by assigning a unique identity:

![Taskbar showing two notepad buttons](./Fix-TaskbarIdentity/gfx/taskbar.png)

#### [View and install Fix-TaskbarIdentity script](./Fix-TaskbarIdentity)

## Script: Un-fullscreen XboxApp (WinRT)
Undo fullscreen when a modern app attempts to enter fullscreen mode.  Hook WinRT API.

#### [View and install Fix-XboxAppGoesFullscreen script](./Fix-XboxAppGoesFullscreen)

## Test suite: Validate DotNetBridge
Verify that DotNetBridge is working properly by exercising calling .net APIs from the system and a locally compiled library.

#### [View and install Test-DotNetBridge script](./Test-DotNetBridge)

## Test suite: Validate WinRT
Verify WinRT APIs are working.

#### [View and install Test-WinRT script](./Test-WinRT)

## Common scripts

### [Learn more about common scripts](./common)

#### COM Example
Define a COM or WinRT interface:
```js
var CLSID_FileOpenDialog = GUID.alloc("DC1C5A9C-E88A-4dde-A5A1-60F82A20AEF7");
var IFileDialog = new COM.Interface(COM.IUnknown, {
	Show: [0, ['uint']],
	SetOptions: [6, ['uint']],
	GetResult: [17, ['pointer']],
}, "42f85136-db7e-439c-85f1-e4075d135fc8");
```
Each entry value is an ordinal in the interface vtable and a set of function argument types.

Create an object and work with the resulting COM interfaces:
```js
COM.Initialize(COM.ApartmentType.STA);

var modalWindow = COM.CreateInstance(CLSID_FileOpenDialog, COM.ClassContext.InProc, IFileDialog);
modalWindow.SetOptions(FOS_PICKFOLDERS);
modalWindow.Show(browseinfo.hwndOwner);

var shellItem = new COM.Pointer(IShellItem);
COM.ThrowIfFailed(modalWindow.GetResult(shellItem.GetAddressOf()));

var pidl = Memory.alloc(Process.pointerSize);
COM.ThrowIfFailed(SHGetIDListFromObject(shellItem.Get(), pidl));
```

#### DotNet Example
Call .NET APIs directly from javascript.
```js
const CLR = require("../common/dotnet");
const System = new CLR.Namespace("System");
System.IO.File.WriteAllText(path, "log data");
```

#### Struct Example
Create a [BROWSEINFOW](https://docs.microsoft.com/en-us/windows/win32/api/shlobj_core/ns-shlobj_core-browseinfow) struct at `browseinfoPtr`:
```js
var browseinfo = new Struct({
    'hwndOwner':'int',
    'pidlRoot':'pointer',
    'pszDisplayName':'pointer',
    'lpszTitle':'pointer',
    'ulFlags':'uint',
    'lpfn':'pointer',
    'lParam':'long',
    'iImage':'int',
}, browseinfoPtr);
```

Then read or write as object properties:
```js
console.log("Flags: 0x" + browseinfo.ulFlags.toString(16));
```