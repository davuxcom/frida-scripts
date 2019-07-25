"use strict";

// OBJECTIVE: 
// Wait 5 seconds
// Use .net to get an hwnd for our process
// Set the window property store AppId on that hwnd
// Taskbar will recognize the change and show a unique button for this window

const Win32 = require('../common/win32');
const Struct = require('../common/struct');
const GUID = require('../common/guid');
const COM = require('../common/com');
const CLR = require('../common/dotnet');
const System = CLR.GetNamespace("System");

// Add some custom types. [size, readFunc, writeFunc]
Struct.TypeMap['pwstr'] = [Process.pointerSize, 
    function(addr) { return Memory.readUtf16String(Memory.readPointer(addr)); },     
    function(addr, newValue) { 
        var stringRef = Memory.allocUtf16String(newValue);
        Memory.writePointer(addr, stringRef);
        return stringRef; // tied to object lifetime.
    }
];
Struct.TypeMap['guid'] = [16, 
    GUID.read, 
    function (addr, newValue) { Memory.copy(addr, GUID.alloc(newValue), 16); }
];
 
// API from windows headers
var PROPKEY = {
    fmtid: 'guid',
    pid: 'ulong'
}

var PKEY_AppUserModel_Id = new Struct(PROPKEY);
PKEY_AppUserModel_Id.fmtid = "9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3";
PKEY_AppUserModel_Id.pid = 5;

var Shell32 = {
    SHGetPropertyStoreForWindow: new NativeFunction(Module.findExportByName("shell32.dll", "SHGetPropertyStoreForWindow"), 'uint', ['int','pointer', 'pointer']),
};

var VT_LPWSTR = 31;
var PROPVARIANT = {
    vt: 'uint16',
    reserved1: 'uchar',
    reserved2: 'uchar',
    reserved3: 'ulong',
    union: {
        intVal: 'int',
        pwszVal: 'pwstr',
    },
    extra: 'ulong'
};

var IPropertyStore = new COM.Interface(COM.IUnknown, {
    // HRESULT SetValue([in] REFPROPERTYKEY key, [in] REFPROPVARIANT propvar);
    SetValue: [3, ['pointer', 'pointer']],
}, "886d8eeb-8cf2-4446-8d02-cdba1dbdcf99");


function SetAppIdForWindow(hwnd, appId) {
    var propStore = new COM.Pointer(IPropertyStore);
    COM.ThrowIfFailed(Shell32.SHGetPropertyStoreForWindow(hwnd, IPropertyStore.IID, propStore.GetAddressOf()));

    var propVar = new Struct(PROPVARIANT);
    propVar.vt = VT_LPWSTR;
    propVar.pwszVal = appId;
    console.log(propVar.pwszVal);
    console.log(propVar.intVal);

    COM.ThrowIfFailed(propStore.SetValue(PKEY_AppUserModel_Id.Get(), propVar.Get()));
}

setTimeout(function() {
    function CheckForMainWindow() {
        var hwnd = System.Diagnostics.Process.GetCurrentProcess().MainWindowHandle.value;
        if (hwnd > 0) {
            SetAppIdForWindow(hwnd, "Notepad.2");
        } else {
            setTimeout(CheckForMainWindow, 1);
        }
    }
    CheckForMainWindow();
},5000);