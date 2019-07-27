const Struct = require('./struct');
const GUID = require('./guid');
const HSTRING = require('./hstring');
const Win32 = require('./win32');
const COM = require('./com');

var ComBase = {
    RoInitialize: new NativeFunction(Win32.FindHiddenExport("combase.dll", "RoInitialize"), 'uint', ['uint'], Win32.Abi),
    RoActivateInstance: new NativeFunction(Win32.FindHiddenExport("combase.dll", "RoActivateInstance"), 'uint', ['pointer', 'pointer'], Win32.Abi),
    RoGetActivationFactory: new NativeFunction(Win32.FindHiddenExport("combase.dll", "RoGetActivationFactory"), 'uint', ['pointer', 'pointer', 'pointer'], Win32.Abi),
};

module.exports = {
    Initialize: function () { COM.ThrowIfFailed(ComBase.RoInitialize(1)); /*RO_INIT_MULTITHREADED*/ }, 
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