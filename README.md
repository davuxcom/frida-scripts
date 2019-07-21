# Frida scripts for Windows application hooking
This repository contains scripts for working with Frida on Windows.  The objective of Frida scripts is to inject into a third-party target process and modify behavior.

[Win32.js](./common/win32.js) and [DotNet.js](./common/dotnet.js) add powerful base APIs for interacting with COM, WinRT and .NET APIs directly from javascript Frida scripts.

- Check out and install [Frida](https://www.frida.re/docs/home/), a dynamic code instrumentation toolkit.
- Everything here is built on top of the [Frida JavaScript API](https://www.frida.re/docs/javascript-api), which provides access to native functions and memory manipulation.

### Quick walkthrough

The workflow is this:
- A target app is running on the machine
- A crafted javascript file (the script) is attached and injected into the target
- The script has a custom script to manipulate memory in the target using Frida APIs, as well as higher level APIs like win32.js and dotnet.js to call more complex APIs (e.g. opening a named pipe or streaming data to a log file)
- The target app and script both operate concurrently from the process space of the target

#### Example: attach
We attach to a running instance of notepad by looking in task manager for the `PID` (say `1447` in this case):

```
frida -p 1447 -l myscript.js
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

At this point as long as no errors are present, the script is attached and ready to go. Scripts in this repository usualy print `Begin` or `Ready` to signal the script is actually loaded. If frida quits, there may be a parse error in the script.


## Replace calls to SHBrowseForFolder with IFileDialog
[Fix-SHBrowseForFolder](./Fix-SHBrowseForFolder) replaces the legacy folder dialog with the modern new dialog, enabling path entry.

![Legacy SHBrowseForFolder folder selection dialog](./Fix-SHBrowseForFolder/gfx/SHBrowseForFolder.png)

Legacy SHBrowseForFolder folder selection dialog 

![Modern IFileDialog folder selection dialog](./Fix-SHBrowseForFolder/gfx/IFileDialog.png)

Modern IFileDialog folder selection dialog

### [View and install Fix-SHBrowseForFolder script](./Fix-SHBrowseForFolder)

## Assign a unique taskbar identity
Group a specific window differently on the taskbar:

![Taskbar showing two notepad buttons](./Fix-TaskbarIdentity/gfx/taskbar.png)

### [View and install Fix-TaskbarIdentity script](./Fix-TaskbarIdentity)

## Common scripts

### [See README for all common scripts](./common)

### DotNet.js

Call .net APIs directly from javascript.

```js
System.IO.File.WriteAllText(path, "log data");
```

### Win32.js
Win32.js has features for working with `GUID`, `HSTRING`, `BSTR`, C-style structs as well as calling COM and WinRT APIs.

#### Examples

Initialize COM (CoInitialize)
```js
COM.Initialize(COM.ApartmentType.STA);
```

Allocate memory and fill in a GUID:
```js
var CLSID_FileOpenDialog = Win32.GUID.alloc("DC1C5A9C-E88A-4dde-A5A1-60F82A20AEF7");
```

Define a COM interface based on IUnknown:
```js
var IFileDialog = new COM.Interface(COM.IUnknown, {
	Show: [0, ['uint']],
	SetOptions: [6, ['uint']],
	GetResult: [17, ['pointer']],
}, "42f85136-db7e-439c-85f1-e4075d135fc8");
```
Each entry value is an ordinal in the interface and a set of function argument types.

Create an object and work with the resulting COM interfaces:
```js
var modalWindow = COM.CreateInstance(CLSID_FileOpenDialog, COM.ClassContext.InProc, IFileDialog);
modalWindow.SetOptions(FOS_PICKFOLDERS);
modalWindow.Show(browseinfo.hwndOwner);

var shellItem = new COM.Pointer(IShellItem);
COM.ThrowIfFailed(modalWindow.GetResult(shellItem.GetAddressOf()));

var pidl = Memory.alloc(Process.pointerSize);
COM.ThrowIfFailed(SHGetIDListFromObject(shellItem.Get(), pidl));
```

Create a [BROWSEINFOW](https://docs.microsoft.com/en-us/windows/win32/api/shlobj_core/ns-shlobj_core-browseinfow) struct at `browseinfoPtr`:
```js
var browseinfo = new Win32.Struct({
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

Then read or write as javascript object properties:
```js
console.log("Flags: 0x" + browseinfo.ulFlags.toString(16));
```