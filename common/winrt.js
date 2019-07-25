const Struct = require('./struct');
const GUID = require('./guid');
const HSTRING = require('./hstring');
const Win32 = require('./win32');

function FindHiddenExport(moduleName, procName) {
    var Kernel32 = {
        LoadLibrary: new NativeFunction(Module.findExportByName("kernel32.dll", "LoadLibraryW"), 'pointer', ['pointer'], Win32.Abi),
        GetProcAddress: new NativeFunction(Module.findExportByName("kernel32.dll", "GetProcAddress"), 'pointer', ['pointer', 'pointer'], Win32.Abi),
    };
    var moduleAddr = Kernel32.LoadLibrary(Memory.allocUtf16String(moduleName));
    if (moduleAddr == 0x0) { throw Error("Didn't load " + moduleName); }
    return Kernel32.GetProcAddress(moduleAddr, Memory.allocAnsiString(procName));
}

var ComBase = {
    RoInitialize: new NativeFunction(FindHiddenExport("combase.dll", "RoInitialize"), 'uint', ['uint'], Win32.Abi),
    RoActivateInstance: new NativeFunction(FindHiddenExport("combase.dll", "RoActivateInstance"), 'uint', ['pointer', 'pointer'], Win32.Abi),
    RoGetActivationFactory: new NativeFunction(FindHiddenExport("combase.dll", "RoGetActivationFactory"), 'uint', ['pointer', 'pointer', 'pointer'], Win32.Abi),
};

module.exports = {
    Initialize: function () { ThrowIfFailed(ComBase.RoInitialize(1)); /*RO_INIT_MULTITHREADED*/ }, 
    ActivateInstance: function (activableClassId) {
        var ret = new COM.Pointer(COM.IInspectable);
        COM.ThrowIfFailed(ComBase.RoActivateInstance(HSTRING.alloc(activableClassId), ret.GetAddressOf()));
        //console.log("WinRT.ActivateInstance: " + activableClassId);
        return ret;
    },
    GetActivationFactory: function (activableClassId, idl) {
        var ret = new COM.Pointer(idl);
        COM.ThrowIfFailed(ComBase.RoGetActivationFactory(HSTRING.alloc(activableClassId), idl.IID, ret.GetAddressOf()));
        //console.log("WinRT.GetActivationFactory: " + activableClassId);
        return ret;
    },
    EventRegistrationToken: function () { return new Struct({ value: 'int64' }); },
    TypedEventHandler: function (callback, guidStr) {
        var eventHandler = new COM.RuntimeObject(GUID.alloc(guidStr));
        eventHandler.AddEntry(function (this_ptr, s, e) { // Invoke
            callback(new COM.Pointer(COM.IInspectable).Attach(s), new COM.Pointer(COM.IInspectable).Attach(e));
            return COM.S_OK;
        }, 'uint', ['pointer', 'pointer', 'pointer']);
        return eventHandler.GetAddress();
    },
};