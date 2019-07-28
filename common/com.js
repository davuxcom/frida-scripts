"use strict";

// GOAL: Build up an object model around COM interfaces. i.e. implement vtbl and friendly wrappers.

const Struct = require('./struct');
const GUID = require('./guid');
const Win32 = require('./win32');
const HSTRING = require('./hstring');

var S_OK = 0;
var S_FALSE = 1;
var E_NOINTERFACE = 0x80004002;

function Log(message) { if ("COMDebug" in global) console.log(message); }
function Succeeded(hr) { return parseInt(hr, 10) == S_OK || parseInt(hr, 10) == S_FALSE; }
function Failed(hr) { return !Succeeded(hr); }
function ThrowIfFailed(hr) {
    var HRESULTMap = [['E_ABORT', 0x80004004],
                       ['E_ACCESSDENIED', 0x80070005],
                       ['E_FAIL', 0x80004005],
                       ['E_HANDLE', 0x80070006],
                       ['E_INVALIDARG', 0x80070057],
                       ['E_NOINTERFACE', 0x80004002],
                       ['E_NOTIMPL', 0x80004001],
                       ['E_OUTOFMEMORY', 0x8007000E],
                       ['E_POINTER', 0x80004003],
                       ['E_UNEXPECTED', 0x8000FFFF]];
    if (Failed(hr)) {
        var friendlyStr = "";
        for (var i = 0; i < HRESULTMap.length; ++i) {
            if (hr == HRESULTMap[i][1]) friendlyStr = " " + HRESULTMap[i][0];
        }
        throw new Error('COMException 0x' + hr.toString(16) + friendlyStr);
    }
}

var IUnknown = {
    IID: GUID.alloc("00000000-0000-0000-C000-000000000046"),
    QueryInterface: [0, ['pointer', 'pointer']],
    AddRef: [1, []],
    Release: [2, []],
};

var IInspectable = {
    IID: GUID.alloc("AF86E2E0-B12D-4c6a-9C5A-D7AA65101E90"),
    // IUnknown
    QueryInterface: IUnknown.QueryInterface,
    AddRef: IUnknown.AddRef,
    Release: IUnknown.Release,
    // IInspectable
    GetIids: [3, ['pointer', 'pointer']],
    GetRuntimeClassName: [4, ['pointer']],
    GetTrustLevel: [5, ['pointer']],
};

var IAgileObject = new ComInterface(IUnknown, {
    // Marker interface, it has no methods.
}, "94EA2B94-E9CC-49E0-C0FF-EE64CA8F5B90");

var Ole32 = {
    CoInitializeEx: new NativeFunction(Module.findExportByName("Ole32.dll", "CoInitializeEx"), 'uint', ['pointer', 'uint'], Win32.Abi),
    CoCreateInstance: new NativeFunction(Module.findExportByName("Ole32.dll", "CoCreateInstance"), 'uint', ['pointer', 'pointer', 'uint', 'pointer', 'pointer'], Win32.Abi),
};

function ComInterface(baseInterface, methods, iid_str) {
    for (var method in methods) this[method] = methods[method];

    this.IID = GUID.alloc(iid_str);
    if (baseInterface.IID == IInspectable.IID) this.IInspectable = true;
}

function iunknown_ptr(address, idl) {
    function vtable_wrapper(address) {
        var getMethodAddress = function (ordinal) {
            var addr = Memory.readPointer(address); // vtbl
            return Memory.readPointer(addr.add(Process.pointerSize * ordinal)); // pointer to func
        }
        this.GetMethodAddress = getMethodAddress;

        this.Invoke = function (ordinal, paramTypes, params, tagName) {
            if (address == 0x0) { throw Error("Can't invoke method on null pointer"); }
            Log("com_ptr(" + address + ")->" + tagName + " (" + params + ")");
            
            // Add 'this' as first argument
            var localTypes = paramTypes.slice();
            localTypes.unshift('pointer');
            var localParams = params.slice();
            localParams.unshift(address);
            
            var fn = new NativeFunction(getMethodAddress(ordinal), 'uint', localTypes, Win32.Abi);
            return fn.apply(fn, localParams);
        };
    }
    var vtable = new vtable_wrapper(address);

    var calculateOrdinal = function (ordinal) {
        var countMethods = function (idl) {
            var count = -1; // IID will be the only non-method property.
            for (var method in idl) { ++count; }
            return count;
        }
        return ordinal + (idl.IInspectable ? countMethods(IInspectable) : countMethods(IUnknown));
    }

    this.InvokeMethod = function (ordinal, paramTypes, params, tagName) {
        return vtable.Invoke(calculateOrdinal(ordinal), paramTypes, params, tagName);
    }
    this.GetMethodAddress = function (ordinal) {
        return vtable.GetMethodAddress(calculateOrdinal(ordinal));
    }

    // IUnknown
    this.QueryInterface = function (iid, ppv) { return vtable.Invoke(IUnknown.QueryInterface[0], IUnknown.QueryInterface[1], [iid, ppv], "QueryInterface"); }
    this.AddRef = function () { return vtable.Invoke(IUnknown.AddRef[0], IUnknown.AddRef[1], [], "AddRef"); }
    this.Release = function () { return vtable.Invoke(IUnknown.Release[0], IUnknown.Release[1], [], "Release"); }

    // IInspectable
    this.GetIids = function () {
        var size_ptr = new Struct({value: 'uint'});
        var iids_ptr = new Struct({value: 'pointer'});
        ThrowIfFailed(vtable.Invoke(IInspectable.GetIids[0], IInspectable.GetIids[1], [size_ptr.Get(), iids_ptr.Get()], "GetIids"));
        var ret = [];
        for (var i = 0; i < size_ptr.value; ++i) {
          ret.push(GUID.read(iids_ptr.value.add(i * Process.pointerSize)));
        }
        return ret;
    }
    this.GetRuntimeClassName = function () {
        var class_name_ptr = new Struct({ 'value': 'pointer' });
        if (Succeeded(vtable.Invoke(IInspectable.GetRuntimeClassName[0], IInspectable.GetRuntimeClassName[1], [class_name_ptr.Get()], "GetRuntimeClassName"))) {
            return HSTRING.read(class_name_ptr.value);
        } else {
            return "[GetRuntimeClassName Failed]";
        }
    }
    this.GetTrustLevel = function () {
        var trust_ptr = new Struct({ 'value': 'pointer' });
        ThrowIfFailed(vtable.Invoke(IInspectable.GetTrustLevel[0], IInspectable.GetTrustLevel[1], [trust_ptr.Get()], "GetTrustLevel"));
        return trust_ptr.value == 0 ? "BaseTrust" : trust_ptr.value == 1 ? "PartialTrust" : "FullTrust";
    }
}

function com_ptr(idl) {
    var _ptr = new Struct({ 'value': 'pointer' }); // the real reference is here

    var resolve_ptr = function () { return new iunknown_ptr(_ptr.value, idl); }
    this.Release = function () { return resolve_ptr().Release(); }
    this.GetAddressOf = function () { return _ptr.Get(); }
    this.Get = function () { return _ptr.value; }
    this.As = function (otherIdl) {
        var ret = new com_ptr(otherIdl);
        ThrowIfFailed(resolve_ptr().QueryInterface(otherIdl.IID, ret.GetAddressOf()));
        return ret;
    }
    this.Attach = function (addr) {
        _ptr.value = addr;
        return this;
    }
    this.GetIids = function() { return resolve_ptr().GetIids(); }
    this.GetRuntimeClassName = function() { return resolve_ptr().GetRuntimeClassName(); }
    this.GetTrustLevel = function() { return resolve_ptr().GetTrustLevel(); }
    this.toString = function () {
        var iinspectable_extra = idl.IInspectable && (_ptr.value != 0x0) ?
            " " + resolve_ptr().GetRuntimeClassName() + " ids=" + resolve_ptr().GetIids() + " " + resolve_ptr().GetTrustLevel() : "";
        return "[com_ptr " + _ptr.Get() + iinspectable_extra + "]";
    }

    var self = this;
    var CreateMethod = function (methodName) {
        var removed_methods = ["QueryInterface", "AddRef", "Release", "GetIids", "GetRuntimeClassName", "GetTrustLevel", "IID", "IInspectable"];
        for (var i = 0; i < removed_methods.length; ++i) {
            if (removed_methods[i] == method) {
                return;
            }
        }

        var MethodProc = function () {
            return resolve_ptr().InvokeMethod(idl[methodName][0], idl[methodName][1], Array.prototype.slice.call(arguments, 0), methodName, idl[methodName][2]);
        }
        MethodProc.GetAddressOf = function () {
            return resolve_ptr().GetMethodAddress(idl[methodName][0]);
        }
        self[methodName] = MethodProc;
    }

    // Add IDL methods onto this object.
    for (var method in idl) { CreateMethod(method); }
}

function RuntimeComObject(iid) {
    var vtable_entries = [];
    var iids = [IUnknown.IID, IAgileObject.IID, iid];
    var refCount = 1;

    this.AddEntry = function (callback, retType, paramTypes) {
        vtable_entries.push(new NativeCallback(callback, retType, paramTypes, Win32.Abi));
    };

    this.AddIid = function (iid) { iids.push(iid); };

    this.GetAddress = function () {
        var vTable = Memory.alloc(Process.pointerSize * vtable_entries.length);

        for (var i = 0; i < vtable_entries.length; ++i) {
            var vTableEntry = vTable.add(Process.pointerSize * i);
            Memory.writePointer(vTableEntry, vtable_entries[i]);
        }

        var com_object_pointer = new Struct({ 'value': 'pointer' });
        com_object_pointer.value = vTable;
        
        // Avoid garbage collection:
        this.savedvTable = vTable;
        this.savedAddress = com_object_pointer;
        return com_object_pointer.Get();
    };

    // QueryInterface
    this.AddEntry(function (this_ptr, riid, ppv) {
        var find_guid = GUID.read(riid);
        for (var i = 0; i < iids.length; ++i) {
            if (GUID.read(iids[i]) == find_guid) {
                ++refCount;
                Memory.writePointer(ppv, this_ptr);
                Log("RuntimeComObject QueryInterface S_OK: " + find_guid);
                return S_OK;
            }
        }
        console.error("RuntimeComObject QueryInterface E_NOINTERFACE: " + find_guid);
        return E_NOINTERFACE;
    }, 'uint', ['pointer', 'pointer', 'pointer']);
    // AddRef
    this.AddEntry(function (this_ptr) { return ++refCount; }, 'ulong', ['pointer']);
    // Release
    this.AddEntry(function (this_ptr) { return --refCount; }, 'ulong', ['pointer']);
}

module.exports = {
    S_OK: S_OK,
    ApartmentType: { // COINIT
        STA: 0x2,
        MTA: 0x0
    },
    ClassContext: { // CLSCTX
        InProc: 0x1,
        Local: 0x4,
    },
    IUnknown: IUnknown,
    IInspectable: IInspectable,
    Pointer: com_ptr,
    Interface: ComInterface,
    RuntimeObject: RuntimeComObject,
    Succeeded: Succeeded,
    Failed: Failed,
    ThrowIfFailed: ThrowIfFailed,
    CreateInstance: function (clsid, clsctx, idl) {
        var ret = new com_ptr(idl);
        ThrowIfFailed(Ole32.CoCreateInstance(clsid, NULL, clsctx, idl.IID, ret.GetAddressOf()));
        return ret;
    },
    Initialize: function (apartment) {
        ThrowIfFailed(Ole32.CoInitializeEx(NULL, apartment));
    },
}