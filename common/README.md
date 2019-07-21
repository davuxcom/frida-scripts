
# Common scripts

## DotNet.js
DotNet.js uses the DotNetBridge.dll COM component registered on the machine to add .net types to Frida scripts.

### Using .net

```js
CLR.Init();
CLR.AddNamespace("System");

// and then call any API like so:
System.Threading.Thread.Sleep(1000);
System.Diagnostics.Trace.WriteLine("hello");
```

#### Enable trace listener thread
Connect `Trace.WriteLine()` to `console.log()` for debugging purposes:
```js
CLR.EnableTraceListener();
```

### Event handlers

```js
var eventToken = System.AppDomain.CurrentDomain.AssemblyLoad += new System.AssemblyLoadEventHandler(function (s, e) { asmLoaded = true;});
```

### See more examples

#### [Test-DotNetBridge.js](../Test-DotNetBridge/Test-DotNetBridge.js)

## Win32.js

### Win32.GUID
Read and write GUID data:
```js
var guidPtr = Win32.GUID.alloc("{6fdf6ffc-ed77-94fa-407e-a7b86ed9e59d}");
var guidStr = Win32.GUID.read(guidPtr);
```

### Win32.Abi
Returns `win64` or `stdcall`.

### Win32.Struct
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

### WinRT.Initialize
```js
WinRT.Initialize(); // RO_INIT_MULTITHREADED
```

### WinRT.ActivateInstance
```js
var coreApplication = WinRT.GetActivationFactory("Windows.ApplicationModel.Core.CoreApplication", ICoreImmersiveApplication);
var mainView = new COM.Pointer(ICoreApplicationView);
ThrowIfFailed(coreApplication.get_MainView(mainView.GetAddressOf()));
```

### WinRT.TypedEventHandler
TODO

### WinRT.EventRegistrationToken
TODO

### WinRT.HSTRING 
Read and write HSTRING data:
```js
var hstr = WinRT.HSTRING.alloc("plain text");
var hstrStringText = WinRT.HSTRING.read(hstr);
```

### COM.Initialize
Initialize COM (CoInitialize)
```js
COM.Initialize(COM.ApartmentType.STA);
```

## COM.CreateInstance
Create objects with defined interfaces.
```js
var IFileDialog = new COM.Interface(COM.IUnknown, {
	Show: [0, ['uint']],
	SetOptions: [6, ['uint']],
	GetResult: [17, ['pointer']],
}, "42f85136-db7e-439c-85f1-e4075d135fc8");
var modalWindow = COM.CreateInstance(CLSID_FileOpenDialog, COM.ClassContext.InProc, IFileDialog);
```

### COM constants

Misc COM constants, enums and interfaces:
```js
COM.S_OK
COM.ApartmentType.STA // or MTA
COM.ClassContext.InProc // or Local

COM.IUnknown
COM.IInspectable

```

### COM Flow control
```js
if (COM.Succeeded(CallSomeComApi())) {
	// call succeeded.
}


if (COM.Failed(CallSomeComApi())) {
	// call failed.
}


COM.ThrowIfFailed(CallSomeComApi());
// call succeeded.
```

### COM.Pointer
```js
var shellItem = new COM.Pointer(IShellItem);
COM.ThrowIfFailed(modalWindow.GetResult(shellItem.GetAddressOf()));
```

### COM.Interface
```js
var IFileDialog = new COM.Interface(COM.IUnknown, {
	Show: [0, ['uint']],
	SetOptions: [6, ['uint']],
	GetResult: [17, ['pointer']],
}, "42f85136-db7e-439c-85f1-e4075d135fc8");

var ICoreApplicationView = new COM.Interface(COM.IInspectable, {
	get_CoreWindow: [0, ['pointer']],
}, "638BB2DB-451D-4661-B099-414F34FFB9F1");
```

### COM.RuntimeComObject
```js
// Build a callback object.
var dispatcherFrame = new COM.RuntimeObject(IDispatchedHandler.IID);
// HRESULT IDispatchedHandler.Invoke(void);
dispatcherFrame.AddEntry(function (this_ptr) { callback(); return COM.S_OK; }, 'uint', ['pointer']);

ThrowIfFailed(coreDispatcher.RunAsync(CoreDispatcherPriority.Normal, dispatcherFrame.GetAddress(), Memory.alloc(Process.pointerSize)));
```

### COM.BSTR
Read and write BSTR data:
```js
var bstr = COM.BSTR.alloc("plain text");
var bstrStringText = COM.BSTR.read(bstr);
COM.BSTR.free(bstr);
```